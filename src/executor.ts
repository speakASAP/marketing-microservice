import axios from "axios";
import { getStore } from "./store";
import { logDecision } from "./logger";
import { Campaign, Contact, DeliveryResult, ExecutionRun } from "./types";
import { resolveSegmentRecipients, SourceFailure } from "./sources";
import { registryScopeFrom, validateRegistryScope } from "./registry";
import { evaluateProductionGovernance } from "./production-governance";

const PLATFORM_MAX_CHUNK_SIZE = 30;
const DEFAULT_MAX_SEND_PER_RUN = 300;

let throttleWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function setThrottleWaitForTest(wait: (ms: number) => Promise<void>): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("throttle_wait_override_is_test_only");
  }
  throttleWait = wait;
}

export interface ExecuteCampaignOptions {
  dryRun?: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function evaluateRecipient(campaign: Campaign, contact: Contact, effectiveChannel: Contact["preferredChannel"]): Promise<{ allowed: boolean; reason: string }> {
  if (!contact.consent.marketing && campaign.purpose === "marketing") {
    return { allowed: false, reason: "consent_missing" };
  }
  if (campaign.purpose === "marketing" && contact.consent.channels?.[effectiveChannel] === false) {
    return { allowed: false, reason: "channel_consent_missing" };
  }
  if (contact.consent.unsubscribed) {
    return { allowed: false, reason: "unsubscribed" };
  }

  const history = await getStore().getSendHistory(toRecipientRef(contact));
  const recent = history.filter((stamp) => {
    return Date.now() - new Date(stamp).getTime() < 24 * 60 * 60 * 1000;
  });

  if (recent.length >= campaign.frequencyCapPerDay) {
    return { allowed: false, reason: "frequency_cap" };
  }

  return { allowed: true, reason: "eligible" };
}

function resolveEffectiveChannel(
  campaign: Campaign,
  contact: Contact
): { channel: Contact["preferredChannel"]; reason: string } {
  if (campaign.purpose === "transactional-not-marketing") {
    if (contact.preferredChannel !== campaign.primaryChannel) {
      return {
        channel: campaign.primaryChannel,
        reason: "transactional_primary_override"
      };
    }
    return { channel: contact.preferredChannel, reason: "preferred_channel_applied" };
  }

  if (contact.preferredChannel === campaign.primaryChannel) {
    return { channel: contact.preferredChannel, reason: "preferred_channel_applied" };
  }

  if (contact.fallbackChannels.includes(campaign.primaryChannel)) {
    return { channel: campaign.primaryChannel, reason: "campaign_primary_in_fallback" };
  }

  return { channel: contact.preferredChannel, reason: "preferred_channel_mismatch_kept" };
}

function toRecipientRef(contact: Contact): string {
  return `${contact.owner === "auth" ? "auth" : "lead"}:${contact.id}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function configuredMaxSendPerRun(): number {
  const configured = Number(process.env.CAMPAIGN_MAX_SEND_PER_RUN ?? DEFAULT_MAX_SEND_PER_RUN);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_SEND_PER_RUN;
}

function configuredChunkSize(): number {
  const configured = Number(process.env.CAMPAIGN_NOTIFICATION_CHUNK_SIZE ?? PLATFORM_MAX_CHUNK_SIZE);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : PLATFORM_MAX_CHUNK_SIZE;
}

function throttleDelayMs(campaign: Campaign): number {
  const throttlePerMinute = campaign.throttlePerMinute ?? 0;
  if (!Number.isFinite(throttlePerMinute) || throttlePerMinute <= 0) return 0;
  return Math.ceil(60_000 / throttlePerMinute);
}

function assertCampaignExecutable(campaign: Campaign): void {
  if (campaign.approvalStatus !== "approved" || !campaign.approvedBy || !campaign.approvedAt) {
    throw new Error("campaign_not_approved");
  }
  if (["draft", "paused", "archived", "failed"].includes(campaign.status)) {
    throw new Error(`campaign_status_not_executable:${campaign.status}`);
  }
}

function sourceFailureResult(campaign: Campaign, failure: SourceFailure): DeliveryResult {
  return {
    deliveryId: crypto.randomUUID(),
    campaignId: campaign.campaignId,
    recipientRef: `${failure.source}:source`,
    recipientSource: failure.source,
    recipientAddress: "",
    requestedChannel: campaign.primaryChannel,
    effectiveChannel: campaign.primaryChannel,
    status: failure.status ?? "failed",
    decisionReason: failure.reason,
    processedAt: nowIso(),
    duration_ms: 0
  };
}

function correlationId(runId: string, recipientRef: string): string {
  return "marketing:" + runId + ":" + recipientRef;
}

function guardrailResult(campaign: Campaign, reason: string): DeliveryResult {
  return {
    deliveryId: crypto.randomUUID(),
    campaignId: campaign.campaignId,
    recipientRef: "system:guardrail",
    recipientSource: "system",
    recipientAddress: "",
    requestedChannel: campaign.primaryChannel,
    effectiveChannel: campaign.primaryChannel,
    status: "failed",
    decisionReason: reason,
    processedAt: nowIso(),
    duration_ms: 0
  };
}

async function sendOne(
  contact: Contact,
  campaign: Campaign,
  effectiveChannel: Contact["preferredChannel"],
  notificationUrl: string,
  requestHeaders: Record<string, string> | undefined,
  correlationId: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    recipient: contact.email ?? contact.phone ?? "",
    message: campaign.message.body,
    type: "custom",
    channel: effectiveChannel,
    service: "marketing-microservice",
    purpose: campaign.purpose,
  };
  if (campaign.message.subject) {
    payload.subject = campaign.message.subject;
  }
  if (campaign.channelKey) {
    payload.channelKey = campaign.channelKey;
  }
  await axios.post(`${notificationUrl}/notifications/send`, payload, {
    timeout: 5000,
    headers: {
      ...(requestHeaders ?? {}),
      "x-correlation-id": correlationId
    },
  });
}

async function sendChunk(
  campaign: Campaign,
  runId: string,
  chunkIndex: number,
  batch: Contact[],
  channelSelection: Map<string, { channel: Contact["preferredChannel"]; reason: string }>
): Promise<DeliveryResult[]> {
  const started = Date.now();
  const notificationUrl = process.env.NOTIFICATION_SERVICE_URL;
  const notificationServiceToken = process.env.NOTIFICATION_SERVICE_TOKEN;
  const requestHeaders = notificationServiceToken
    ? { Authorization: `Bearer ${notificationServiceToken}` }
    : undefined;

  if (!notificationUrl) {
    logDecision("notification_chunk_failed", {
      campaignId: campaign.campaignId,
      runId,
      chunkIndex,
      chunkSize: batch.length,
      reason: "notification_url_missing",
      duration_ms: Date.now() - started
    });
    const duration_ms = Date.now() - started;
    return batch.map((c) => {
      const recipientRef = toRecipientRef(c);
      const currentCorrelationId = correlationId(runId, recipientRef);
      return {
        deliveryId: crypto.randomUUID(),
        campaignId: campaign.campaignId,
        recipientRef,
        recipientSource: c.owner,
        recipientAddress: c.email ?? c.phone ?? "",
        requestedChannel: campaign.primaryChannel,
        effectiveChannel: channelSelection.get(c.id)?.channel ?? c.preferredChannel,
        status: "failed",
        decisionReason: "notification_url_missing",
        processedAt: nowIso(),
        duration_ms,
        correlationId: currentCorrelationId
      };
    });
  }

  logDecision("notification_chunk_send_started", {
    campaignId: campaign.campaignId,
    runId,
    chunkIndex,
    chunkSize: batch.length,
    endpoint: `${notificationUrl}/notifications/send`,
    duration_ms: Date.now() - started
  });

  const delayMs = throttleDelayMs(campaign);
  const sendContact = async (c: Contact): Promise<DeliveryResult> => {
    const effectiveChannel = channelSelection.get(c.id)?.channel ?? c.preferredChannel;
    const recipientRef = toRecipientRef(c);
    const currentCorrelationId = correlationId(runId, recipientRef);
    try {
      await sendOne(c, campaign, effectiveChannel, notificationUrl, requestHeaders, currentCorrelationId);
      return {
        deliveryId: crypto.randomUUID(),
        campaignId: campaign.campaignId,
        recipientRef,
        recipientSource: c.owner,
        recipientAddress: c.email ?? c.phone ?? "",
        requestedChannel: campaign.primaryChannel,
        effectiveChannel,
        status: "sent" as const,
        decisionReason: "sent_via_notifications",
        processedAt: nowIso(),
        duration_ms: Date.now() - started,
        correlationId: currentCorrelationId
      };
    } catch (error) {
      return {
        deliveryId: crypto.randomUUID(),
        campaignId: campaign.campaignId,
        recipientRef,
        recipientSource: c.owner,
        recipientAddress: c.email ?? c.phone ?? "",
        requestedChannel: campaign.primaryChannel,
        effectiveChannel,
        status: "failed" as const,
        decisionReason: `notifications_error:${(error as Error).message}`,
        processedAt: nowIso(),
        duration_ms: Date.now() - started,
        correlationId: currentCorrelationId
      };
    }
  };

  const results: DeliveryResult[] = [];
  if (delayMs > 0) {
    for (let i = 0; i < batch.length; i += 1) {
      if (i > 0) {
        await throttleWait(delayMs);
      }
      results.push(await sendContact(batch[i]));
    }
  } else {
    results.push(...(await Promise.all(batch.map(sendContact))));
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  const failedCount = results.length - sentCount;
  const duration_ms = Date.now() - started;
  if (failedCount === 0) {
    logDecision("notification_chunk_send_completed", {
      campaignId: campaign.campaignId,
      runId,
      chunkIndex,
      chunkSize: batch.length,
      sentCount,
      duration_ms
    });
  } else {
    logDecision("notification_chunk_send_partial", {
      campaignId: campaign.campaignId,
      runId,
      chunkIndex,
      chunkSize: batch.length,
      sentCount,
      failedCount,
      duration_ms
    });
  }
  return results;
}

export async function executeCampaign(
  campaignId: string,
  idempotencyKey: string,
  options: ExecuteCampaignOptions = {}
): Promise<ExecutionRun> {
  const dryRun = options.dryRun === true;
  const store = getStore();
  const effectiveIdempotencyKey = dryRun ? `dry-run:${idempotencyKey}` : idempotencyKey;
  const existing = await store.findRunByIdempotency(campaignId, effectiveIdempotencyKey);
  if (existing) {
    return existing;
  }

  const campaign = await store.getCampaign(campaignId);
  if (!campaign) {
    throw new Error("campaign_not_found");
  }
  if (!dryRun) {
    assertCampaignExecutable(campaign);
  }

  const segment = await store.getSegment(campaign.segmentId);
  if (!segment) {
    throw new Error("segment_not_found");
  }

  const registryValidation = await validateRegistryScope(registryScopeFrom(campaign));
  if (!registryValidation.ok) {
    if (!dryRun) {
      throw new Error(registryValidation.reason + (registryValidation.details ? ":" + registryValidation.details : ""));
    }
    const run: ExecutionRun = {
      id: crypto.randomUUID(),
      campaignId,
      idempotencyKey: effectiveIdempotencyKey,
      startedAt: nowIso(),
      completedAt: nowIso(),
      status: "dry_run_completed",
      dryRun,
      approvalEvidence: null,
      totalRecipients: 0,
      totalSent: 0,
      results: [guardrailResult(campaign, registryValidation.reason)]
    };
    await store.saveRun(run);
    logDecision("campaign_registry_validation_failed", {
      campaignId,
      runId: run.id,
      dryRun,
      reason: registryValidation.reason,
      details: registryValidation.details ?? null,
      duration_ms: 0
    });
    return run;
  }

  const segmentRegistryValidation = await validateRegistryScope(registryScopeFrom(segment));
  if (!segmentRegistryValidation.ok) {
    if (!dryRun) {
      throw new Error(segmentRegistryValidation.reason + (segmentRegistryValidation.details ? ":" + segmentRegistryValidation.details : ""));
    }
    const run: ExecutionRun = {
      id: crypto.randomUUID(),
      campaignId,
      idempotencyKey: effectiveIdempotencyKey,
      startedAt: nowIso(),
      completedAt: nowIso(),
      status: "dry_run_completed",
      dryRun,
      approvalEvidence: null,
      totalRecipients: 0,
      totalSent: 0,
      results: [guardrailResult(campaign, segmentRegistryValidation.reason)]
    };
    await store.saveRun(run);
    logDecision("segment_registry_validation_failed", {
      campaignId,
      segmentId: segment.segmentId,
      runId: run.id,
      dryRun,
      reason: segmentRegistryValidation.reason,
      details: segmentRegistryValidation.details ?? null,
      duration_ms: 0
    });
    return run;
  }

  const recipientResolution = await resolveSegmentRecipients(segment, campaign);
  const recipients = recipientResolution.recipients;

  const run: ExecutionRun = {
    id: crypto.randomUUID(),
    campaignId,
    idempotencyKey: effectiveIdempotencyKey,
    startedAt: nowIso(),
    status: "running",
    dryRun,
    approvalEvidence: dryRun
      ? null
      : {
          approvalStatus: campaign.approvalStatus,
          approvedBy: campaign.approvedBy ?? null,
          approvedAt: campaign.approvedAt ?? null
        },
    totalRecipients: recipients.length,
    totalSent: 0,
    results: recipientResolution.failures.map((failure) => sourceFailureResult(campaign, failure))
  };
  await store.saveRun(run);

  const productionGovernance = evaluateProductionGovernance(campaign, recipients);
  if (!dryRun && productionGovernance.evidence.enforced && recipientResolution.failures.length > 0) {
    run.results.push(guardrailResult(campaign, "production_governance_source_failure"));
    run.completedAt = nowIso();
    run.status = "failed";
    await store.saveRun(run);
    logDecision("production_governance_blocked", {
      campaignId,
      runId: run.id,
      reason: "production_governance_source_failure",
      sourceFailures: recipientResolution.failures.map((failure) => failure.source),
      duration_ms: 0
    });
    return run;
  }

  logDecision("production_governance_evaluated", { campaignId, runId: run.id, enforced: productionGovernance.evidence.enforced, riskClass: productionGovernance.evidence.riskClass, riskReasons: productionGovernance.evidence.riskReasons, policyRef: productionGovernance.evidence.policyRef, duration_ms: 0 });
  if (!dryRun && !productionGovernance.ok) {
    run.results.push(guardrailResult(campaign, productionGovernance.reason));
    run.completedAt = nowIso();
    run.status = "failed";
    await store.saveRun(run);
    logDecision("production_governance_blocked", { campaignId, runId: run.id, reason: productionGovernance.reason, riskClass: productionGovernance.evidence.riskClass, duration_ms: 0 });
    return run;
  }

  logDecision(dryRun ? "campaign_dry_run_started" : "campaign_execution_started", {
    campaignId,
    runId: run.id,
    recipientCount: recipients.length,
    approvalStatus: campaign.approvalStatus,
    approvedBy: campaign.approvedBy ?? null,
    duration_ms: 0
  });

  const approved: Contact[] = [];
  const channelSelection = new Map<string, { channel: Contact["preferredChannel"]; reason: string }>();
  for (const recipient of recipients) {
    const channel = resolveEffectiveChannel(campaign, recipient);
    channelSelection.set(recipient.id, channel);
    const decision = await evaluateRecipient(campaign, recipient, channel.channel);
    logDecision("recipient_decision", {
      campaignId,
      runId: run.id,
      dryRun,
      recipientId: recipient.id,
      decision: decision.reason,
      preferredChannel: recipient.preferredChannel,
      effectiveChannel: channel.channel,
      channelResolutionReason: channel.reason,
      duration_ms: 0
    });
    if (!decision.allowed) {
      run.results.push({
        deliveryId: crypto.randomUUID(),
        campaignId: campaign.campaignId,
        recipientRef: toRecipientRef(recipient),
        recipientSource: recipient.owner,
        recipientAddress: recipient.email ?? recipient.phone ?? "",
        requestedChannel: campaign.primaryChannel,
        effectiveChannel: channel.channel,
        status: "skipped",
        decisionReason: decision.reason,
        processedAt: nowIso(),
        duration_ms: 0
      });
      continue;
    }
    approved.push(recipient);
    if (dryRun) {
      run.results.push({
        deliveryId: crypto.randomUUID(),
        campaignId: campaign.campaignId,
        recipientRef: toRecipientRef(recipient),
        recipientSource: recipient.owner,
        recipientAddress: recipient.email ?? recipient.phone ?? "",
        requestedChannel: campaign.primaryChannel,
        effectiveChannel: channel.channel,
        status: "would_send",
        decisionReason: "dry_run_would_send",
        processedAt: nowIso(),
        duration_ms: 0
      });
    }
  }

  const maxSendPerRun = configuredMaxSendPerRun();
  if (approved.length > maxSendPerRun) {
    const reason = `max_send_per_run_exceeded:${approved.length}>${maxSendPerRun}`;
    logDecision("campaign_guardrail_triggered", {
      campaignId,
      runId: run.id,
      dryRun,
      guardrail: "max_send_per_run",
      approvedCount: approved.length,
      maxSendPerRun,
      duration_ms: 0
    });
    run.results.push(guardrailResult(campaign, reason));
    run.completedAt = nowIso();
    run.status = dryRun ? "dry_run_completed" : "failed";
    await store.saveRun(run);
    return run;
  }

  if (dryRun) {
    run.completedAt = nowIso();
    run.status = "dry_run_completed";
    await store.saveRun(run);
    logDecision("campaign_dry_run_completed", {
      campaignId,
      runId: run.id,
      totalRecipients: run.totalRecipients,
      wouldSend: run.results.filter((r) => r.status === "would_send").length,
      totalSkipped: run.results.filter((r) => r.status === "skipped").length,
      totalFailed: run.results.filter((r) => r.status === "failed").length,
      duration_ms: new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
    });
    return run;
  }

  const notificationChunkSize = configuredChunkSize();
  if (notificationChunkSize > PLATFORM_MAX_CHUNK_SIZE) {
    const reason = `notification_chunk_size_exceeds_platform_limit:${notificationChunkSize}>${PLATFORM_MAX_CHUNK_SIZE}`;
    logDecision("campaign_guardrail_triggered", {
      campaignId,
      runId: run.id,
      guardrail: "notification_chunk_size",
      configuredChunkSize: notificationChunkSize,
      platformMaxChunkSize: PLATFORM_MAX_CHUNK_SIZE,
      duration_ms: 0
    });
    run.results.push(guardrailResult(campaign, reason));
    run.completedAt = nowIso();
    run.status = "failed";
    await store.saveRun(run);
    return run;
  }

  const chunks = chunk(approved, notificationChunkSize);
  for (let i = 0; i < chunks.length; i += 1) {
    const batch = chunks[i];
    const chunkResults = await sendChunk(campaign, run.id, i, batch, channelSelection);
    run.results.push(...chunkResults);
  }

  for (const result of run.results) {
    if (result.status === "sent") {
      await store.recordSend(result.recipientRef, campaignId, run.id, result.processedAt);
      run.totalSent += 1;
    }
  }

  run.completedAt = nowIso();
  run.status = "completed";
  const reasonCounts = run.results.reduce<Record<string, number>>((acc, current) => {
    const reason = current.decisionReason;
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  const statusCounts = run.results.reduce<Record<string, number>>((acc, current) => {
    acc[current.status] = (acc[current.status] ?? 0) + 1;
    return acc;
  }, {});

  await store.saveRun(run);

  logDecision("campaign_execution_completed", {
    campaignId,
    runId: run.id,
    approvedBy: campaign.approvedBy ?? null,
    approvedAt: campaign.approvedAt ?? null,
    totalRecipients: run.totalRecipients,
    totalSent: run.totalSent,
    totalSkipped: run.results.filter((r) => r.status === "skipped").length,
    totalFailed: run.results.filter((r) => r.status === "failed").length,
    statusCounts,
    reasonCounts,
    duration_ms: new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  });

  return run;
}
