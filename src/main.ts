import "dotenv/config";
import express from "express";
import { executeCampaign } from "./executor";
import { runDueScheduledCampaigns } from "./scheduler";
import { getStore, initializeConfiguredStore } from "./store";
import { Campaign, Segment } from "./types";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: process.env.SERVICE_NAME ?? "marketing-microservice" });
});

app.post("/segments", async (req, res) => {
  const body = req.body as Partial<Segment>;
  if (!body.name || !Array.isArray(body.sourceTypes) || !body.rules || body.isDynamic === undefined) {
    return res.status(400).json({ error: "name_sourceTypes_rules_isDynamic_required" });
  }

  const segment: Segment = {
    segmentId: crypto.randomUUID(),
    name: body.name,
    sourceTypes: body.sourceTypes,
    rules: body.rules,
    isDynamic: body.isDynamic,
    estimatedCount: body.estimatedCount ?? null
  };

  return res.status(201).json(await getStore().saveSegment(segment));
});

app.get("/segments", async (_req, res) => {
  res.json(await getStore().listSegments());
});

app.put("/segments/:id", async (req, res) => {
  const existing = await getStore().getSegment(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "segment_not_found" });
  }

  const updated: Segment = {
    ...existing,
    ...req.body,
    segmentId: existing.segmentId
  };
  return res.json(await getStore().saveSegment(updated));
});

app.delete("/segments/:id", async (req, res) => {
  const existed = await getStore().deleteSegment(req.params.id);
  if (!existed) {
    return res.status(404).json({ error: "segment_not_found" });
  }
  return res.status(204).send();
});

app.post("/campaigns", async (req, res) => {
  const now = new Date().toISOString();
  const body = req.body as Partial<Campaign>;
  if (!body.name || !body.segmentId || !body.tenant || !body.message?.body || !body.templateRef) {
    return res.status(400).json({ error: "name_segment_tenant_template_message_required" });
  }

  if (!(await getStore().getSegment(body.segmentId))) {
    return res.status(400).json({ error: "segment_not_found" });
  }

  const campaign: Campaign = {
    campaignId: crypto.randomUUID(),
    tenant: body.tenant,
    name: body.name,
    segmentId: body.segmentId,
    description: body.description ?? null,
    purpose: body.purpose ?? "marketing",
    primaryChannel: body.primaryChannel ?? "email",
    fallbackChannels: body.fallbackChannels ?? [],
    channelKey: body.channelKey,
    templateRef: body.templateRef,
    scheduleAt: body.scheduleAt,
    throttlePerMinute: body.throttlePerMinute ?? null,
    frequencyCapPerDay: body.frequencyCapPerDay ?? 1,
    message: body.message,
    status: body.status ?? "draft",
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    createdAt: now,
    updatedAt: now
  };

  return res.status(201).json(await getStore().saveCampaign(campaign));
});

app.get("/campaigns", async (_req, res) => {
  res.json(await getStore().listCampaigns());
});

app.put("/campaigns/:id", async (req, res) => {
  const existing = await getStore().getCampaign(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "campaign_not_found" });
  }

  const { approvalStatus, approvedBy, approvedAt, approvalNote, ...safeBody } = req.body ?? {};
  void approvalStatus;
  void approvedBy;
  void approvedAt;
  void approvalNote;

  const updated: Campaign = {
    ...existing,
    ...safeBody,
    campaignId: existing.campaignId,
    approvalStatus: existing.approvalStatus,
    approvedBy: existing.approvedBy ?? null,
    approvedAt: existing.approvedAt ?? null,
    approvalNote: existing.approvalNote ?? null,
    updatedAt: new Date().toISOString()
  };
  return res.json(await getStore().saveCampaign(updated));
});

app.post("/campaigns/:id/approve", async (req, res) => {
  const existing = await getStore().getCampaign(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "campaign_not_found" });
  }

  const approvedBy = req.body?.approvedBy ?? req.headers["x-owner-actor"];
  if (!approvedBy || Array.isArray(approvedBy)) {
    return res.status(400).json({ error: "approved_by_required" });
  }

  const updated: Campaign = {
    ...existing,
    status: existing.status === "draft" ? "scheduled" : existing.status,
    approvalStatus: "approved",
    approvedBy: String(approvedBy),
    approvedAt: new Date().toISOString(),
    approvalNote: req.body?.approvalNote ?? null,
    updatedAt: new Date().toISOString()
  };

  return res.json(await getStore().saveCampaign(updated));
});

app.delete("/campaigns/:id", async (req, res) => {
  const existed = await getStore().deleteCampaign(req.params.id);
  if (!existed) {
    return res.status(404).json({ error: "campaign_not_found" });
  }
  return res.status(204).send();
});

app.post("/campaigns/:id/execute", async (req, res) => {
  const dryRun = req.body?.dryRun === true;
  const idempotencyKey = (req.headers["x-idempotency-key"] as string) || req.body?.idempotencyKey || (dryRun ? crypto.randomUUID() : undefined);
  if (!idempotencyKey) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }

  try {
    const run = await executeCampaign(req.params.id, idempotencyKey, { dryRun });
    return res.json(run);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/campaigns/:id/dry-run", async (req, res) => {
  const idempotencyKey = (req.headers["x-idempotency-key"] as string) || req.body?.idempotencyKey || crypto.randomUUID();

  try {
    const run = await executeCampaign(req.params.id, idempotencyKey, { dryRun: true });
    return res.json(run);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/executions", async (_req, res) => {
  res.json(await getStore().listRuns());
});

app.post("/scheduler/run-due", async (req, res) => {
  try {
    const result = await runDueScheduledCampaigns({
      schedulerOwner: req.body?.schedulerOwner ?? (req.headers["x-scheduler-owner"] as string | undefined),
      batchSize: req.body?.batchSize,
      lockTtlMs: req.body?.lockTtlMs
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

const port = Number(process.env.PORT || 4600);
initializeConfiguredStore()
  .then(() => {
    app.listen(port, () => {
      // Single startup line for container log checks.
      console.log(JSON.stringify({ event: "service_started", timestamp: new Date().toISOString(), port }));
    });
  })
  .catch((error) => {
    console.error(JSON.stringify({ event: "service_start_failed", timestamp: new Date().toISOString(), error: (error as Error).message }));
    process.exit(1);
  });
