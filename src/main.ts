import "dotenv/config";
import express from "express";
import { executeCampaign } from "./executor";
import { logDecision } from "./logger";
import { runDueScheduledCampaigns } from "./scheduler";
import { getStore, initializeConfiguredStore } from "./store";
import { Campaign, Segment } from "./types";
import { registryScopeFrom, validateRegistryScope } from "./registry";
import { forwardUnsubscribeWrite } from "./preferences";
import {
  requireServiceAuth,
  sendContractError,
  sourceOwnerService,
  validateCampaignBody,
  validateExecutionBody,
  validatePreferenceOwner,
  validatePreferenceRequest,
  validateSchedulerBody,
  validateSegmentBody
} from "./api-contracts";

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: process.env.SERVICE_NAME ?? "marketing-microservice" });
});

app.post("/segments", requireServiceAuth, async (req, res) => {
  const validation = validateSegmentBody(req.body);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }

  const body = validation.value;
  const registryValidation = await validateRegistryScope(registryScopeFrom(body as Segment));
  if (!registryValidation.ok) {
    return res.status(400).json({ error: registryValidation.reason, details: registryValidation.details });
  }
  const segment: Segment = {
    segmentId: crypto.randomUUID(),
    tenantId: body.tenantId!,
    appId: body.appId!,
    brandId: body.brandId!,
    businessId: body.businessId ?? null,
    environment: body.environment ?? null,
    defaultLocale: body.defaultLocale ?? null,
    timezone: body.timezone ?? null,
    productLine: body.productLine ?? null,
    lifecycleScope: body.lifecycleScope ?? null,
    legalSenderIdentity: body.legalSenderIdentity ?? null,
    policyRef: body.policyRef ?? null,
    name: body.name!,
    sourceTypes: body.sourceTypes!,
    rules: body.rules!,
    isDynamic: body.isDynamic!,
    estimatedCount: body.estimatedCount ?? null
  };

  const saved = await getStore().saveSegment(segment);
  logDecision("segment_created", {
    segmentId: saved.segmentId,
    sourceTypes: saved.sourceTypes,
    isDynamic: saved.isDynamic,
    duration_ms: 0
  });
  return res.status(201).json(saved);
});

app.get("/segments", async (req, res) => {
  res.json(await getStore().listSegments(req.query as Record<string, string>));
});

app.put("/segments/:id", requireServiceAuth, async (req, res) => {
  const validation = validateSegmentBody(req.body, true);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }

  const existing = await getStore().getSegment(String(req.params.id));
  if (!existing) {
    return res.status(404).json({ error: "segment_not_found" });
  }

  const updated: Segment = {
    ...existing,
    ...validation.value,
    segmentId: existing.segmentId
  };
  const registryValidation = await validateRegistryScope(registryScopeFrom(updated));
  if (!registryValidation.ok) {
    return res.status(400).json({ error: registryValidation.reason, details: registryValidation.details });
  }
  const saved = await getStore().saveSegment(updated);
  logDecision("segment_updated", {
    segmentId: saved.segmentId,
    sourceTypes: saved.sourceTypes,
    isDynamic: saved.isDynamic,
    duration_ms: 0
  });
  return res.json(saved);
});

app.delete("/segments/:id", requireServiceAuth, async (req, res) => {
  const existed = await getStore().deleteSegment(String(req.params.id));
  if (!existed) {
    return res.status(404).json({ error: "segment_not_found" });
  }
  logDecision("segment_deleted", { segmentId: String(req.params.id), duration_ms: 0 });
  return res.status(204).send();
});

app.post("/campaigns", requireServiceAuth, async (req, res) => {
  const validation = validateCampaignBody(req.body);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }

  const now = new Date().toISOString();
  const body = validation.value;
  if (!(await getStore().getSegment(body.segmentId!))) {
    return res.status(400).json({ error: "segment_not_found" });
  }
  const registryValidation = await validateRegistryScope(registryScopeFrom(body as Campaign));
  if (!registryValidation.ok) {
    return res.status(400).json({ error: registryValidation.reason, details: registryValidation.details });
  }

  const campaign: Campaign = {
    campaignId: crypto.randomUUID(),
    tenant: body.tenant!,
    tenantId: body.tenantId!,
    appId: body.appId!,
    brandId: body.brandId!,
    businessId: body.businessId ?? null,
    environment: body.environment ?? null,
    defaultLocale: body.defaultLocale ?? null,
    timezone: body.timezone ?? null,
    productLine: body.productLine ?? null,
    lifecycleScope: body.lifecycleScope ?? null,
    legalSenderIdentity: body.legalSenderIdentity ?? null,
    policyRef: body.policyRef ?? null,
    name: body.name!,
    segmentId: body.segmentId!,
    description: body.description ?? null,
    purpose: body.purpose ?? "marketing",
    primaryChannel: body.primaryChannel ?? "email",
    fallbackChannels: body.fallbackChannels ?? [],
    channelKey: body.channelKey,
    templateRef: body.templateRef!,
    scheduleAt: body.scheduleAt,
    throttlePerMinute: body.throttlePerMinute ?? null,
    frequencyCapPerDay: body.frequencyCapPerDay ?? 1,
    message: body.message!,
    status: body.status ?? "draft",
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    createdAt: now,
    updatedAt: now
  };

  const saved = await getStore().saveCampaign(campaign);
  logDecision("campaign_created", {
    campaignId: saved.campaignId,
    tenant: saved.tenant,
    segmentId: saved.segmentId,
    purpose: saved.purpose,
    primaryChannel: saved.primaryChannel,
    status: saved.status,
    approvalStatus: saved.approvalStatus,
    scheduleAt: saved.scheduleAt ?? null,
    throttlePerMinute: saved.throttlePerMinute ?? null,
    frequencyCapPerDay: saved.frequencyCapPerDay,
    duration_ms: 0
  });
  return res.status(201).json(saved);
});

app.get("/campaigns", async (req, res) => {
  res.json(await getStore().listCampaigns(req.query as Record<string, string>));
});

app.put("/campaigns/:id", requireServiceAuth, async (req, res) => {
  const validation = validateCampaignBody(req.body, true);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }

  const existing = await getStore().getCampaign(String(req.params.id));
  if (!existing) {
    return res.status(404).json({ error: "campaign_not_found" });
  }

  if (validation.value.segmentId && !(await getStore().getSegment(validation.value.segmentId))) {
    return res.status(400).json({ error: "segment_not_found" });
  }

  const updated: Campaign = {
    ...existing,
    ...validation.value,
    campaignId: existing.campaignId,
    approvalStatus: existing.approvalStatus,
    approvedBy: existing.approvedBy ?? null,
    approvedAt: existing.approvedAt ?? null,
    approvalNote: existing.approvalNote ?? null,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };
  const registryValidation = await validateRegistryScope(registryScopeFrom(updated));
  if (!registryValidation.ok) {
    return res.status(400).json({ error: registryValidation.reason, details: registryValidation.details });
  }
  const saved = await getStore().saveCampaign(updated);
  logDecision("campaign_updated", {
    campaignId: saved.campaignId,
    tenant: saved.tenant,
    segmentId: saved.segmentId,
    purpose: saved.purpose,
    primaryChannel: saved.primaryChannel,
    status: saved.status,
    approvalStatus: saved.approvalStatus,
    scheduleAt: saved.scheduleAt ?? null,
    throttlePerMinute: saved.throttlePerMinute ?? null,
    frequencyCapPerDay: saved.frequencyCapPerDay,
    duration_ms: 0
  });
  return res.json(saved);
});

app.post("/campaigns/:id/approve", requireServiceAuth, async (req, res) => {
  const existing = await getStore().getCampaign(String(req.params.id));
  if (!existing) {
    return res.status(404).json({ error: "campaign_not_found" });
  }

  const approvedBy = req.body?.approvedBy ?? req.headers["x-owner-actor"];
  if (!approvedBy || Array.isArray(approvedBy) || typeof approvedBy !== "string" || approvedBy.trim().length === 0) {
    return res.status(400).json({ error: "approved_by_required" });
  }
  if (req.body?.approvalNote !== undefined && req.body.approvalNote !== null && typeof req.body.approvalNote !== "string") {
    return res.status(400).json({ error: "invalid_approval_request", fields: { approvalNote: "must_be_string_or_null" } });
  }

  const updated: Campaign = {
    ...existing,
    status: existing.status === "draft" ? "scheduled" : existing.status,
    approvalStatus: "approved",
    approvedBy: approvedBy.trim(),
    approvedAt: new Date().toISOString(),
    approvalNote: req.body?.approvalNote ?? null,
    updatedAt: new Date().toISOString()
  };

  const saved = await getStore().saveCampaign(updated);
  logDecision("campaign_approved", {
    campaignId: saved.campaignId,
    tenant: saved.tenant,
    approvedBy: saved.approvedBy ?? null,
    approvedAt: saved.approvedAt ?? null,
    approvalStatus: saved.approvalStatus,
    status: saved.status,
    duration_ms: 0
  });
  return res.json(saved);
});

app.delete("/campaigns/:id", requireServiceAuth, async (req, res) => {
  const existed = await getStore().deleteCampaign(String(req.params.id));
  if (!existed) {
    return res.status(404).json({ error: "campaign_not_found" });
  }
  logDecision("campaign_deleted", { campaignId: String(req.params.id), duration_ms: 0 });
  return res.status(204).send();
});

app.post("/campaigns/:id/execute", requireServiceAuth, async (req, res) => {
  const bodyValidation = validateExecutionBody(req.body ?? {}, req.body?.dryRun !== true);
  if (!bodyValidation.ok) {
    return sendContractError(res, 400, bodyValidation.error);
  }

  const dryRun = bodyValidation.value.dryRun === true;
  const headerIdempotency = req.headers["x-idempotency-key"];
  if (Array.isArray(headerIdempotency)) {
    return res.status(400).json({ error: "invalid_execution_request", fields: { "x-idempotency-key": "must_be_single_header" } });
  }
  const idempotencyKey = headerIdempotency || bodyValidation.value.idempotencyKey || (dryRun ? crypto.randomUUID() : undefined);
  if (!idempotencyKey) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }

  try {
    const run = await executeCampaign(String(req.params.id), idempotencyKey, { dryRun });
    logDecision(dryRun ? "campaign_dry_run_requested" : "campaign_execution_requested", {
      campaignId: String(req.params.id),
      runId: run.id,
      idempotencyKey: run.idempotencyKey,
      runStatus: run.status,
      totalRecipients: run.totalRecipients,
      totalSent: run.totalSent,
      duration_ms: 0
    });
    return res.json(run);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/campaigns/:id/dry-run", requireServiceAuth, async (req, res) => {
  const bodyValidation = validateExecutionBody(req.body ?? {}, false);
  if (!bodyValidation.ok) {
    return sendContractError(res, 400, bodyValidation.error);
  }

  const headerIdempotency = req.headers["x-idempotency-key"];
  if (Array.isArray(headerIdempotency)) {
    return res.status(400).json({ error: "invalid_execution_request", fields: { "x-idempotency-key": "must_be_single_header" } });
  }
  const idempotencyKey = headerIdempotency || bodyValidation.value.idempotencyKey || crypto.randomUUID();

  try {
    const run = await executeCampaign(String(req.params.id), idempotencyKey, { dryRun: true });
    logDecision("campaign_dry_run_requested", {
      campaignId: String(req.params.id),
      runId: run.id,
      idempotencyKey: run.idempotencyKey,
      runStatus: run.status,
      totalRecipients: run.totalRecipients,
      totalSent: run.totalSent,
      duration_ms: 0
    });
    return res.json(run);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/executions", async (_req, res) => {
  res.json(await getStore().listRuns());
});

app.get("/preferences/:owner/:recipientId", async (req, res) => {
  if (!validatePreferenceOwner(req.params.owner) || !req.params.recipientId) {
    return res.status(400).json({ error: "invalid_preference_request", fields: { owner: "must_be_auth_or_leads", recipientId: "required_non_empty_string" } });
  }
  const owner = req.params.owner;
  return res.json({
    status: "external_source_owned",
    owner,
    recipientId: req.params.recipientId,
    readOwner: sourceOwnerService(owner),
    message: "Marketing reads preferences during campaign execution; preference truth remains with the source owner."
  });
});

app.post("/preferences/unsubscribe", async (req, res) => {
  const validation = validatePreferenceRequest(req.body);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }
  const request = validation.value;
  const writeResult = await forwardUnsubscribeWrite(request);
  logDecision("public_unsubscribe_requested", {
    owner: request.owner,
    recipientId: request.recipientId,
    channel: request.channel ?? null,
    purpose: request.purpose ?? "marketing",
    tenantId: request.tenantId ?? null,
    appId: request.appId ?? null,
    brandId: request.brandId ?? null,
    writeOwner: writeResult.writeOwner,
    sourceWriteStatus: writeResult.status,
    sourceStatus: writeResult.sourceStatus ?? null,
    sourceWriteReason: writeResult.reason ?? null,
    duration_ms: 0
  });
  return res.status(202).json({
    status: "accepted",
    owner: request.owner,
    recipientId: request.recipientId,
    channel: request.channel ?? null,
    purpose: request.purpose ?? "marketing",
    tenantId: request.tenantId ?? null,
    appId: request.appId ?? null,
    brandId: request.brandId ?? null,
    writeOwner: writeResult.writeOwner,
    sourceWriteStatus: writeResult.status,
    sourceStatus: writeResult.sourceStatus ?? null,
    sourceWriteReason: writeResult.reason ?? null,
    message: "Unsubscribe write ownership remains with the source owner; Marketing will honor visible unsubscribe state during execution."
  });
});

app.post("/scheduler/run-due", requireServiceAuth, async (req, res) => {
  const bodyValidation = validateSchedulerBody(req.body ?? {});
  if (!bodyValidation.ok) {
    return sendContractError(res, 400, bodyValidation.error);
  }

  try {
    const result = await runDueScheduledCampaigns({
      schedulerOwner: bodyValidation.value.schedulerOwner ?? (req.headers["x-scheduler-owner"] as string | undefined),
      batchSize: bodyValidation.value.batchSize,
      lockTtlMs: bodyValidation.value.lockTtlMs
    });
    logDecision("campaign_scheduler_run_due_requested", {
      schedulerOwner: result.schedulerOwner,
      claimed: result.claimed,
      executed: result.executed,
      failed: result.failed,
      duration_ms: 0
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

export async function startServer(): Promise<void> {
  const port = Number(process.env.PORT || 4600);
  await initializeConfiguredStore();
  app.listen(port, () => {
    console.log(JSON.stringify({ event: "service_started", timestamp: new Date().toISOString(), port }));
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(JSON.stringify({ event: "service_start_failed", timestamp: new Date().toISOString(), error: (error as Error).message }));
    process.exit(1);
  });
}
