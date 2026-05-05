import axios from "axios";
import { campaigns, contacts, runs, sendHistory, segments } from "./store";
import { logDecision } from "./logger";
import { Campaign, Contact, DeliveryResult, ExecutionRun } from "./types";

const CHUNK_SIZE = 30;

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function sendChunk(campaign: Campaign, batch: Contact[]): Promise<DeliveryResult[]> {
  const started = Date.now();
  const notificationUrl = process.env.NOTIFICATION_SERVICE_URL;
  const requestPayload = {
    purpose: campaign.purpose,
    channelKey: campaign.channelKey,
    notifications: batch.map((c) => ({
      recipientId: c.id,
      to: c.email,
      message: campaign.message,
      channel: c.preferredChannel
    }))
  };

  if (!notificationUrl) {
    const duration_ms = Date.now() - started;
    return batch.map((c) => ({
      recipientId: c.id,
      status: "failed",
      reason: "notification_url_missing",
      timestamp: nowIso(),
      duration_ms
    }));
  }

  try {
    await axios.post(`${notificationUrl}/notifications/send`, requestPayload, {
      timeout: 5000
    });
    const duration_ms = Date.now() - started;
    return batch.map((c) => ({
      recipientId: c.id,
      status: "sent",
      reason: "sent_via_notifications",
      timestamp: nowIso(),
      duration_ms
    }));
  } catch (error) {
    const duration_ms = Date.now() - started;
    return batch.map((c) => ({
      recipientId: c.id,
      status: "failed",
      reason: `notifications_error:${(error as Error).message}`,
      timestamp: nowIso(),
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
    const ownerFilter = segment.filters.owner as string | undefined;
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
  for (const recipient of recipients) {
    const decision = evaluateRecipient(campaign, recipient);
    logDecision("recipient_decision", {
      campaignId,
      runId: run.id,
      recipientId: recipient.id,
      decision: decision.reason
    });
    if (!decision.allowed) {
      run.results.push({
        recipientId: recipient.id,
        status: "skipped",
        reason: decision.reason,
        timestamp: nowIso(),
        duration_ms: 0
      });
      continue;
    }
    approved.push(recipient);
  }

  const chunks = chunk(approved, CHUNK_SIZE);
  for (const batch of chunks) {
    const chunkResults = await sendChunk(campaign, batch);
    run.results.push(...chunkResults);
  }

  for (const result of run.results) {
    if (result.status === "sent") {
      const history = sendHistory.get(result.recipientId) ?? [];
      history.push(result.timestamp);
      sendHistory.set(result.recipientId, history);
      run.totalSent += 1;
    }
  }

  run.completedAt = nowIso();
  run.status = "completed";

  logDecision("campaign_execution_completed", {
    campaignId,
    runId: run.id,
    totalRecipients: run.totalRecipients,
    totalSent: run.totalSent,
    totalSkipped: run.results.filter((r) => r.status === "skipped").length,
    totalFailed: run.results.filter((r) => r.status === "failed").length
  });

  return run;
}
