import axios from "axios";
import { campaigns, contacts, runs, sendHistory, segments } from "./store";
import { logDecision } from "./logger";
import { Campaign, Contact, DeliveryResult, ExecutionRun } from "./types";

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

async function sendChunk(
  campaign: Campaign,
  runId: string,
  chunkIndex: number,
  batch: Contact[],
  channelSelection: Map<string, { channel: Contact["preferredChannel"]; reason: string }>
): Promise<DeliveryResult[]> {
  const started = Date.now();
  const notificationUrl = process.env.NOTIFICATION_SERVICE_URL;
  const sendEndpoint = notificationUrl ? `${notificationUrl}/notifications/send` : "";
  const requestPayload = {
    purpose: campaign.purpose,
    channelKey: campaign.channelKey,
    notifications: batch.map((c) => ({
      recipientId: c.id,
      to: c.email,
      message: campaign.message,
      channel: channelSelection.get(c.id)?.channel ?? c.preferredChannel
    }))
  };

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
    endpoint: sendEndpoint
  });

  try {
    await axios.post(sendEndpoint, requestPayload, {
      timeout: 5000
    });
    const duration_ms = Date.now() - started;
    logDecision("notification_chunk_send_completed", {
      campaignId: campaign.campaignId,
      runId,
      chunkIndex,
      chunkSize: batch.length,
      sentCount: batch.length,
      duration_ms
    });
    return batch.map((c) => ({
      deliveryId: crypto.randomUUID(),
      campaignId: campaign.campaignId,
      recipientRef: toRecipientRef(c),
      recipientSource: c.owner,
      recipientAddress: c.email ?? c.phone ?? "",
      requestedChannel: campaign.primaryChannel,
      effectiveChannel: channelSelection.get(c.id)?.channel ?? c.preferredChannel,
      status: "sent",
      decisionReason: "sent_via_notifications",
      processedAt: nowIso(),
      duration_ms
    }));
  } catch (error) {
    const duration_ms = Date.now() - started;
    logDecision("notification_chunk_send_failed", {
      campaignId: campaign.campaignId,
      runId,
      chunkIndex,
      chunkSize: batch.length,
      duration_ms,
      error: (error as Error).message
    });
    return batch.map((c) => ({
      deliveryId: crypto.randomUUID(),
      campaignId: campaign.campaignId,
      recipientRef: toRecipientRef(c),
      recipientSource: c.owner,
      recipientAddress: c.email ?? c.phone ?? "",
      requestedChannel: campaign.primaryChannel,
      effectiveChannel: channelSelection.get(c.id)?.channel ?? c.preferredChannel,
      status: "failed",
      decisionReason: `notifications_error:${(error as Error).message}`,
      processedAt: nowIso(),
      duration_ms
    }));
  }
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

  const recipients = contacts.filter((contact) => {
    // Placeholder filter logic until external segment query integration is added.
    const ownerFilter = segment.rules.owner as string | undefined;
    if (!ownerFilter) return true;
    return contact.owner === ownerFilter;
  });

  const run: ExecutionRun = {
    id: crypto.randomUUID(),
    campaignId,
    idempotencyKey,
    startedAt: nowIso(),
    status: "running",
    totalRecipients: recipients.length,
    totalSent: 0,
    results: []
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
