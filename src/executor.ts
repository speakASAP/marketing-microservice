import axios from "axios";
import { campaigns, runs, sendHistory, segments } from "./store";
import { logDecision } from "./logger";
import { Campaign, Contact, DeliveryResult, ExecutionRun } from "./types";
import { resolveSegmentRecipients, SourceFailure } from "./sources";

const CHUNK_SIZE = 30;
const DEFAULT_MAX_SEND_PER_RUN = 300;

function nowIso(): string {
  return new Date().toISOString();
}

function evaluateRecipient(campaign: Campaign, contact: Contact): { allowed: boolean; reason: string } {
  if (!contact.consent.marketing && campaign.purpose === "marketing") {
    return { allowed: false, reason: "consent_missing" };
  }
  if (contact.consent.unsubscribed) {
    return { allowed: false, reason: "unsubscribed" };
  }

  const history = sendHistory.get(contact.id) ?? [];
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

function sourceFailureResult(campaign: Campaign, failure: SourceFailure): DeliveryResult {
  return {
    deliveryId: crypto.randomUUID(),
    campaignId: campaign.campaignId,
    recipientRef: `${failure.source}:source`,
    recipientSource: failure.source,
    recipientAddress: "",
    requestedChannel: campaign.primaryChannel,
    effectiveChannel: campaign.primaryChannel,
    status: "failed",
    decisionReason: failure.reason,
    processedAt: nowIso(),
    duration_ms: 0
  };
}

async function sendOne(
  contact: Contact,
  campaign: Campaign,
  effectiveChannel: Contact["preferredChannel"],
  notificationUrl: string,
  requestHeaders: Record<string, string> | undefined
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
    headers: requestHeaders,
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
    return batch.map((c) => ({
      deliveryId: crypto.randomUUID(),
      campaignId: campaign.campaignId,
      recipientRef: toRecipientRef(c),
      recipientSource: c.owner,
      recipientAddress: c.email ?? c.phone ?? "",
      requestedChannel: campaign.primaryChannel,
      effectiveChannel: channelSelection.get(c.id)?.channel ?? c.preferredChannel,
      status: "failed",
      decisionReason: "notification_url_missing",
      processedAt: nowIso(),
      duration_ms
    }));
  }

  logDecision("notification_chunk_send_started", {
    campaignId: campaign.campaignId,
    runId,
    chunkIndex,
    chunkSize: batch.length,
    endpoint: `${notificationUrl}/notifications/send`
  });

  const results: DeliveryResult[] = await Promise.all(
    batch.map(async (c) => {
      const effectiveChannel = channelSelection.get(c.id)?.channel ?? c.preferredChannel;
      try {
        await sendOne(c, campaign, effectiveChannel, notificationUrl, requestHeaders);
        return {
          deliveryId: crypto.randomUUID(),
          campaignId: campaign.campaignId,
          recipientRef: toRecipientRef(c),
          recipientSource: c.owner,
          recipientAddress: c.email ?? c.phone ?? "",
          requestedChannel: campaign.primaryChannel,
          effectiveChannel,
          status: "sent" as const,
          decisionReason: "sent_via_notifications",
          processedAt: nowIso(),
          duration_ms: Date.now() - started
        };
      } catch (error) {
        return {
          deliveryId: crypto.randomUUID(),
          campaignId: campaign.campaignId,
          recipientRef: toRecipientRef(c),
          recipientSource: c.owner,
          recipientAddress: c.email ?? c.phone ?? "",
          requestedChannel: campaign.primaryChannel,
          effectiveChannel,
          status: "failed" as const,
          decisionReason: `notifications_error:${(error as Error).message}`,
          processedAt: nowIso(),
          duration_ms: Date.now() - started
        };
      }
    })
  );

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

export async function executeCampaign(campaignId: string, idempotencyKey: string): Promise<ExecutionRun> {
  const existing = Array.from(runs.values()).find(
    (r) => r.campaignId === campaignId && r.idempotencyKey === idempotencyKey
  );
  if (existing) {
    return existing;
  }

  const campaign = campaigns.get(campaignId);
  if (!campaign) {
    throw new Error("campaign_not_found");
  }

  const segment = segments.get(campaign.segmentId);
  if (!segment) {
    throw new Error("segment_not_found");
  }

  const recipientResolution = await resolveSegmentRecipients(segment, campaign);
  const recipients = recipientResolution.recipients;

  const run: ExecutionRun = {
    id: crypto.randomUUID(),
    campaignId,
    idempotencyKey,
    startedAt: nowIso(),
    status: "running",
    totalRecipients: recipients.length,
    totalSent: 0,
    results: recipientResolution.failures.map((failure) => sourceFailureResult(campaign, failure))
  };
  runs.set(run.id, run);

  logDecision("campaign_execution_started", {
    campaignId,
    runId: run.id,
    recipientCount: recipients.length
  });

  const approved: Contact[] = [];
  const channelSelection = new Map<string, { channel: Contact["preferredChannel"]; reason: string }>();
  for (const recipient of recipients) {
    const channel = resolveEffectiveChannel(campaign, recipient);
    channelSelection.set(recipient.id, channel);
    const decision = evaluateRecipient(campaign, recipient);
    logDecision("recipient_decision", {
      campaignId,
      runId: run.id,
      recipientId: recipient.id,
      decision: decision.reason,
      preferredChannel: recipient.preferredChannel,
      effectiveChannel: channel.channel,
      channelResolutionReason: channel.reason
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
  }

  const configuredMaxSendPerRun = Number(process.env.CAMPAIGN_MAX_SEND_PER_RUN ?? DEFAULT_MAX_SEND_PER_RUN);
  const maxSendPerRun =
    Number.isFinite(configuredMaxSendPerRun) && configuredMaxSendPerRun > 0
      ? Math.floor(configuredMaxSendPerRun)
      : DEFAULT_MAX_SEND_PER_RUN;
  if (approved.length > maxSendPerRun) {
    logDecision("campaign_guardrail_triggered", {
      campaignId,
      runId: run.id,
      guardrail: "max_send_per_run",
      approvedCount: approved.length,
      cappedTo: maxSendPerRun
    });
    approved.splice(maxSendPerRun);
  }
  const chunks = chunk(approved, CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i += 1) {
    const batch = chunks[i];
    const chunkResults = await sendChunk(campaign, run.id, i, batch, channelSelection);
    run.results.push(...chunkResults);
  }

  for (const result of run.results) {
    if (result.status === "sent") {
      const recipientId = result.recipientRef.split(":").slice(1).join(":");
      const history = sendHistory.get(recipientId) ?? [];
      history.push(result.processedAt);
      sendHistory.set(recipientId, history);
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

  logDecision("campaign_execution_completed", {
    campaignId,
    runId: run.id,
    totalRecipients: run.totalRecipients,
    totalSent: run.totalSent,
    totalSkipped: run.results.filter((r) => r.status === "skipped").length,
    totalFailed: run.results.filter((r) => r.status === "failed").length,
    statusCounts,
    reasonCounts
  });

  return run;
}
