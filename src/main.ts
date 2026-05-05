import "dotenv/config";
import express from "express";
import { campaigns, runs, segments } from "./store";
import { executeCampaign } from "./executor";
import { Campaign, Segment } from "./types";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: process.env.SERVICE_NAME ?? "marketing-microservice" });
});

app.post("/segments", (req, res) => {
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

  segments.set(segment.segmentId, segment);
  return res.status(201).json(segment);
});

app.get("/segments", (_req, res) => {
  res.json(Array.from(segments.values()));
});

app.put("/segments/:id", (req, res) => {
  const existing = segments.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "segment_not_found" });
  }

  const updated: Segment = {
    ...existing,
    ...req.body,
    segmentId: existing.segmentId
  };
  segments.set(updated.segmentId, updated);
  return res.json(updated);
});

app.delete("/segments/:id", (req, res) => {
  const existed = segments.delete(req.params.id);
  if (!existed) {
    return res.status(404).json({ error: "segment_not_found" });
  }
  return res.status(204).send();
});

app.post("/campaigns", (req, res) => {
  const now = new Date().toISOString();
  const body = req.body as Partial<Campaign>;
  if (!body.name || !body.segmentId || !body.tenant || !body.message?.body || !body.templateRef) {
    return res.status(400).json({ error: "name_segment_tenant_template_message_required" });
  }

  if (!segments.has(body.segmentId)) {
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
    createdAt: now,
    updatedAt: now
  };

  campaigns.set(campaign.campaignId, campaign);
  return res.status(201).json(campaign);
});

app.get("/campaigns", (_req, res) => {
  res.json(Array.from(campaigns.values()));
});

app.put("/campaigns/:id", (req, res) => {
  const existing = campaigns.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "campaign_not_found" });
  }

  const updated: Campaign = {
    ...existing,
    ...req.body,
    campaignId: existing.campaignId,
    updatedAt: new Date().toISOString()
  };
  campaigns.set(updated.campaignId, updated);
  return res.json(updated);
});

app.delete("/campaigns/:id", (req, res) => {
  const existed = campaigns.delete(req.params.id);
  if (!existed) {
    return res.status(404).json({ error: "campaign_not_found" });
  }
  return res.status(204).send();
});

app.post("/campaigns/:id/execute", async (req, res) => {
  const idempotencyKey = (req.headers["x-idempotency-key"] as string) || req.body?.idempotencyKey;
  if (!idempotencyKey) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }

  try {
    const run = await executeCampaign(req.params.id, idempotencyKey);
    return res.json(run);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/executions", (_req, res) => {
  res.json(Array.from(runs.values()));
});

const port = Number(process.env.PORT || 4600);
app.listen(port, () => {
  // Single startup line for container log checks.
  console.log(JSON.stringify({ event: "service_started", timestamp: new Date().toISOString(), port }));
});
