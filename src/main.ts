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
  const now = new Date().toISOString();
  const body = req.body as Partial<Segment>;
  if (!body.name || !body.ownerApp) {
    return res.status(400).json({ error: "name_and_ownerApp_required" });
  }

  const segment: Segment = {
    id: crypto.randomUUID(),
    name: body.name,
    ownerApp: body.ownerApp,
    filters: body.filters ?? {},
    createdAt: now,
    updatedAt: now
  };

  segments.set(segment.id, segment);
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
    id: existing.id,
    updatedAt: new Date().toISOString()
  };
  segments.set(updated.id, updated);
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
  if (!body.name || !body.segmentId || !body.ownerApp || !body.message?.body) {
    return res.status(400).json({ error: "name_segment_owner_message_required" });
  }

  if (!segments.has(body.segmentId)) {
    return res.status(400).json({ error: "segment_not_found" });
  }

  const campaign: Campaign = {
    id: crypto.randomUUID(),
    name: body.name,
    segmentId: body.segmentId,
    ownerApp: body.ownerApp,
    purpose: body.purpose ?? "marketing",
    primaryChannel: body.primaryChannel ?? "email",
    fallbackChannels: body.fallbackChannels ?? [],
    channelKey: body.channelKey,
    scheduleAt: body.scheduleAt,
    frequencyCapPerDay: body.frequencyCapPerDay ?? 1,
    message: body.message,
    status: body.status ?? "draft",
    createdAt: now,
    updatedAt: now
  };

  campaigns.set(campaign.id, campaign);
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
    id: existing.id,
    updatedAt: new Date().toISOString()
  };
  campaigns.set(updated.id, updated);
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
