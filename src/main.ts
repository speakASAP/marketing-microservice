import "dotenv/config";
import { startCredentialSelfReporter } from "./credential-self-reporter";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { buildMarketingAnalyticsCsv, buildMarketingAnalyticsReadModel, AnalyticsBuildOptions, AnalyticsFactType, ExternalAttributionFact } from "./analytics";
import { renderAdminAnalyticsDashboard } from "./admin-analytics-dashboard";
import { getDefaultCampaignBlueprint, getHolidayDiscountCampaignContentContract, listDefaultCampaignBlueprints, CampaignBlueprintFilter } from "./campaign-blueprints";
import { AdminUserSession, adminSessionResponse, requireAdminAuth } from "./admin-auth";
import { renderAdminCampaignsConsole, renderAdminSegmentsConsole } from "./admin-campaign-segment-console";
import {
  adminAuditEvidence,
  adminOutcomeSearch,
  adminRunDetail,
  adminRunSummary as goal17AdminRunSummary,
  filterAdminRuns,
  renderAdminAuditConsole,
  renderAdminRunsConsole
} from "./admin-ops-views";
import { ADMIN_SHELL_ROUTES, renderAdminShell } from "./admin-shell";
import { executeCampaign } from "./executor";
import { logDecision } from "./logger";
import { readNotificationChannelRegistry } from "./notification-channel-registry";
import { startOrdersEventsConsumer } from "./orders-events-consumer";
import { runDueScheduledCampaigns } from "./scheduler";
import { getStore, initializeConfiguredStore } from "./store";
import { Campaign, Channel, ExecutionRun, Journey, JourneyStep, Segment } from "./types";
import { registryScopeFrom, validateRegistryScope } from "./registry";
import { forwardUnsubscribeWrite } from "./preferences";
import {
  requireServiceAuth,
  sendContractError,
  sourceOwnerService,
  validateCampaignBody,
  validateExecutionBody,
  validateHolidayDiscountCampaignContentContract,
  validatePreferenceOwner,
  validatePreferenceRequest,
  validateJourneyBody,
  validateSchedulerBody,
  validateSegmentBody
} from "./api-contracts";

export const app = express();
app.use(express.json());

const sourcePublicRoot = path.resolve(process.cwd(), "public");
const builtPublicRoot = path.join(__dirname, "public");
const publicRoot = fs.existsSync(builtPublicRoot) ? builtPublicRoot : sourcePublicRoot;
const landingPagePath = path.join(publicRoot, "index.html");
const authCallbackPagePath = path.join(publicRoot, "auth-callback.html");

app.use("/assets", express.static(path.join(publicRoot, "assets"), {
  index: false,
  immutable: true,
  maxAge: "1h"
}));

app.get(["/", "/landing"], (_req, res) => {
  res.sendFile(landingPagePath);
});

function normalizedPublicUrl(envKey: string, fallback: string): string {
  return (process.env[envKey] || fallback).replace(/\/$/, "");
}

function secureCookieSuffix(): string {
  return process.env.MARKETING_AUTH_COOKIE_SECURE === "false" ? "" : "; Secure";
}

function authStateCookie(state: string): string {
  return `marketing_auth_state=${encodeURIComponent(state)}; Path=/auth/callback; Max-Age=600; SameSite=Lax${secureCookieSuffix()}`;
}

function authEntryRedirectUrl(mode: "login" | "register", state: string): string {
  const authBaseUrl = normalizedPublicUrl("AUTH_SERVICE_PUBLIC_URL", "https://auth.alfares.cz");
  const marketingBaseUrl = normalizedPublicUrl("MARKETING_PUBLIC_URL", "https://marketing.alfares.cz");
  const url = new URL(`/${mode}`, authBaseUrl);
  url.searchParams.set("return_url", `${marketingBaseUrl}/auth/callback`);
  url.searchParams.set("client_id", "marketing-microservice");
  url.searchParams.set("state", state);
  return url.toString();
}

function redirectToAuthEntry(mode: "login" | "register", res: express.Response): void {
  const state = crypto.randomUUID();
  res.setHeader("set-cookie", authStateCookie(state));
  res.redirect(302, authEntryRedirectUrl(mode, state));
}

app.get("/auth/login", (_req, res) => {
  redirectToAuthEntry("login", res);
});

app.get("/auth/register", (_req, res) => {
  redirectToAuthEntry("register", res);
});

app.get("/auth/callback", (_req, res) => {
  const cookieName = process.env.AUTH_ADMIN_ACCESS_TOKEN_COOKIE || "auth_access_token";
  const html = fs.readFileSync(authCallbackPagePath, "utf8").replace(/__AUTH_COOKIE_NAME__/g, cookieName);
  res.type("html").send(html);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: process.env.SERVICE_NAME ?? "marketing-microservice" });
});

app.get(ADMIN_SHELL_ROUTES.map((route) => route.path).filter((route) => !["/admin/campaigns", "/admin/segments", "/admin/runs", "/admin/audit", "/admin/analytics"].includes(route)), requireAdminAuth("viewer"), (req, res) => {
  res.type("html").send(renderAdminShell(res.locals.adminSession, req.path));
});

app.get("/admin/api/session", requireAdminAuth("viewer"), (_req, res) => {
  res.json(adminSessionResponse(res.locals.adminSession));
});

function adminActor(session: AdminUserSession): string {
  return session.user.email ?? session.user.id ?? "marketing-admin";
}

function adminRunSummary(run: ExecutionRun): Record<string, unknown> {
  return {
    id: run.id,
    campaignId: run.campaignId,
    idempotencyKey: run.idempotencyKey,
    status: run.status,
    dryRun: run.dryRun,
    totalRecipients: run.totalRecipients,
    totalSent: run.totalSent,
    statusCounts: countRunStatuses(run),
    decisionReasonCounts: countRunReasons(run),
    startedAt: run.startedAt,
    completedAt: run.completedAt
  };
}

app.get("/admin/campaigns", requireAdminAuth("viewer"), (_req, res) => {
  res.type("html").send(renderAdminCampaignsConsole(res.locals.adminSession));
});

app.get("/admin/segments", requireAdminAuth("viewer"), (_req, res) => {
  res.type("html").send(renderAdminSegmentsConsole(res.locals.adminSession));
});

app.get("/admin/runs", requireAdminAuth("viewer"), (_req, res) => {
  res.type("html").send(renderAdminRunsConsole(res.locals.adminSession));
});

app.get("/admin/audit", requireAdminAuth("viewer"), (_req, res) => {
  res.type("html").send(renderAdminAuditConsole(res.locals.adminSession));
});

app.get("/admin/analytics", requireAdminAuth("viewer"), (_req, res) => {
  res.type("html").send(renderAdminAnalyticsDashboard(res.locals.adminSession));
});

app.get("/admin/api/segments", requireAdminAuth("viewer"), async (req, res) => {
  res.json(await getStore().listSegments(req.query as Record<string, string>));
});

app.get("/admin/api/segments/:id", requireAdminAuth("viewer"), async (req, res) => {
  const segment = await getStore().getSegment(String(req.params.id));
  if (!segment) return res.status(404).json({ error: "segment_not_found" });
  return res.json(segment);
});

app.post("/admin/api/segments", requireAdminAuth("admin"), async (req, res) => {
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
  logDecision("admin_segment_created", {
    segmentId: saved.segmentId,
    sourceTypes: saved.sourceTypes,
    isDynamic: saved.isDynamic,
    actor: adminActor(res.locals.adminSession as AdminUserSession),
    duration_ms: 0
  });
  return res.status(201).json(saved);
});

app.put("/admin/api/segments/:id", requireAdminAuth("admin"), async (req, res) => {
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
  logDecision("admin_segment_updated", {
    segmentId: saved.segmentId,
    sourceTypes: saved.sourceTypes,
    isDynamic: saved.isDynamic,
    actor: adminActor(res.locals.adminSession as AdminUserSession),
    duration_ms: 0
  });
  return res.json(saved);
});

app.get("/admin/api/campaigns", requireAdminAuth("viewer"), async (req, res) => {
  res.json(await getStore().listCampaigns(req.query as Record<string, string>));
});

app.get("/admin/api/campaigns/:id", requireAdminAuth("viewer"), async (req, res) => {
  const campaign = await getStore().getCampaign(String(req.params.id));
  if (!campaign) return res.status(404).json({ error: "campaign_not_found" });
  return res.json(campaign);
});

app.post("/admin/api/campaigns", requireAdminAuth("admin"), async (req, res) => {
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
    catalogMetadata: body.catalogMetadata ?? null,
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
  logDecision("admin_campaign_created", {
    campaignId: saved.campaignId,
    tenant: saved.tenant,
    segmentId: saved.segmentId,
    purpose: saved.purpose,
    primaryChannel: saved.primaryChannel,
    status: saved.status,
    approvalStatus: saved.approvalStatus,
    actor: adminActor(res.locals.adminSession as AdminUserSession),
    duration_ms: 0
  });
  return res.status(201).json(saved);
});

app.put("/admin/api/campaigns/:id", requireAdminAuth("admin"), async (req, res) => {
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
  logDecision("admin_campaign_updated", {
    campaignId: saved.campaignId,
    tenant: saved.tenant,
    segmentId: saved.segmentId,
    purpose: saved.purpose,
    primaryChannel: saved.primaryChannel,
    status: saved.status,
    approvalStatus: saved.approvalStatus,
    scheduleAt: saved.scheduleAt ?? null,
    actor: adminActor(res.locals.adminSession as AdminUserSession),
    duration_ms: 0
  });
  return res.json(saved);
});

app.post("/admin/api/campaigns/:id/status", requireAdminAuth("admin"), async (req, res) => {
  const requestedStatus = req.body?.status;
  if (!["draft", "scheduled", "paused", "archived"].includes(requestedStatus)) {
    return res.status(400).json({ error: "invalid_campaign_status_request", fields: { status: "must_be_draft_scheduled_paused_or_archived" } });
  }
  const validation = validateCampaignBody({ status: requestedStatus, scheduleAt: req.body?.scheduleAt }, true);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }
  const existing = await getStore().getCampaign(String(req.params.id));
  if (!existing) {
    return res.status(404).json({ error: "campaign_not_found" });
  }
  if (requestedStatus === "scheduled" && !validation.value.scheduleAt && !existing.scheduleAt) {
    return res.status(400).json({ error: "invalid_campaign_status_request", fields: { scheduleAt: "required_to_schedule_campaign" } });
  }
  const saved = await getStore().saveCampaign({
    ...existing,
    ...validation.value,
    status: requestedStatus,
    updatedAt: new Date().toISOString()
  });
  logDecision("admin_campaign_status_updated", {
    campaignId: saved.campaignId,
    status: saved.status,
    scheduleAt: saved.scheduleAt ?? null,
    approvalStatus: saved.approvalStatus,
    actor: adminActor(res.locals.adminSession as AdminUserSession),
    duration_ms: 0
  });
  return res.json(saved);
});

app.get("/admin/api/runs", requireAdminAuth("viewer"), async (req, res) => {
  const runs = filterAdminRuns(await getStore().listRuns(), req.query as Record<string, unknown>);
  res.json(runs.map(goal17AdminRunSummary));
});

app.get("/admin/api/runs/:id", requireAdminAuth("viewer"), async (req, res) => {
  const run = (await getStore().listRuns()).find((item) => item.id === String(req.params.id));
  if (!run) return res.status(404).json({ error: "run_not_found" });
  return res.json(adminRunDetail(run));
});

app.get("/admin/api/outcomes", requireAdminAuth("viewer"), async (req, res) => {
  res.json(adminOutcomeSearch(await getStore().listRuns(), req.query as Record<string, unknown>));
});

app.get("/admin/api/preferences/:owner/:recipientId", requireAdminAuth("viewer"), async (req, res) => {
  if (!validatePreferenceOwner(req.params.owner) || !req.params.recipientId) {
    return res.status(400).json({ error: "invalid_preference_request", fields: { owner: "must_be_auth_or_leads", recipientId: "required_non_empty_string" } });
  }
  const owner = req.params.owner;
  return res.json({
    status: "external_source_owned",
    owner,
    recipientId: req.params.recipientId,
    readOwner: sourceOwnerService(owner),
    writeOwner: sourceOwnerService(owner),
    message: "Marketing admin shows source ownership metadata only; contact, preference, consent, and unsubscribe truth remain with the source owner."
  });
});

app.post("/admin/api/preferences/unsubscribe", requireAdminAuth("operator"), async (req, res) => {
  const validation = validatePreferenceRequest(req.body);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }
  const request = validation.value;
  const writeResult = await forwardUnsubscribeWrite(request);
  logDecision("admin_unsubscribe_intake_requested", {
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

app.get("/admin/api/channels", requireAdminAuth("viewer"), async (_req, res) => {
  res.json(await readNotificationChannelRegistry());
});

app.get("/admin/api/audit", requireAdminAuth("viewer"), async (req, res) => {
  res.json(adminAuditEvidence(await getStore().listRuns(), req.query as Record<string, unknown>));
});

app.get("/admin/api/analytics/summary", requireAdminAuth("viewer"), async (req, res) => {
  const options = analyticsOptionsFromQuery(req.query as Record<string, unknown>);
  if (!options.ok) return res.status(400).json({ error: "invalid_analytics_request", fields: options.fields });
  const campaigns = await getStore().listCampaigns(campaignScopeFiltersFromQuery(req.query as Record<string, unknown>));
  const runs = await getStore().listRuns();
  return res.json(buildMarketingAnalyticsReadModel(campaigns, runs, options.value));
});

app.post("/admin/api/analytics/summary", requireAdminAuth("viewer"), async (req, res) => {
  const facts = externalAttributionFactsFromBody(req.body ?? {});
  if (!facts.ok) return res.status(400).json({ error: "invalid_analytics_request", fields: facts.fields });
  const options = analyticsOptionsFromQuery(req.query as Record<string, unknown>, facts.value);
  if (!options.ok) return res.status(400).json({ error: "invalid_analytics_request", fields: options.fields });
  const campaigns = await getStore().listCampaigns(campaignScopeFiltersFromQuery(req.query as Record<string, unknown>));
  const runs = await getStore().listRuns();
  return res.json(buildMarketingAnalyticsReadModel(campaigns, runs, options.value));
});

app.get("/admin/api/analytics/export.csv", requireAdminAuth("viewer"), async (req, res) => {
  const options = analyticsOptionsFromQuery(req.query as Record<string, unknown>);
  if (!options.ok) return res.status(400).json({ error: "invalid_analytics_request", fields: options.fields });
  const campaigns = await getStore().listCampaigns(campaignScopeFiltersFromQuery(req.query as Record<string, unknown>));
  const runs = await getStore().listRuns();
  const readModel = buildMarketingAnalyticsReadModel(campaigns, runs, options.value);
  res.setHeader("content-type", "text/csv; charset=utf-8");
  return res.send(buildMarketingAnalyticsCsv(readModel));
});

app.post("/admin/api/campaigns/:id/approve", requireAdminAuth("admin"), async (req, res) => {
  const existing = await getStore().getCampaign(String(req.params.id));
  if (!existing) return res.status(404).json({ error: "campaign_not_found" });
  if (req.body?.approvalNote !== undefined && req.body.approvalNote !== null && typeof req.body.approvalNote !== "string") {
    return res.status(400).json({ error: "invalid_approval_request", fields: { approvalNote: "must_be_string_or_null" } });
  }

  const session = res.locals.adminSession as AdminUserSession;
  const now = new Date().toISOString();
  const saved = await getStore().saveCampaign({
    ...existing,
    status: existing.status === "draft" ? "scheduled" : existing.status,
    approvalStatus: "approved",
    approvedBy: adminActor(session),
    approvedAt: now,
    approvalNote: req.body?.approvalNote ?? null,
    updatedAt: now
  });
  logDecision("admin_campaign_approved", {
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

app.post("/admin/api/campaigns/:id/dry-run", requireAdminAuth("operator"), async (req, res) => {
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
    logDecision("admin_campaign_dry_run_requested", {
      campaignId: String(req.params.id),
      runId: run.id,
      idempotencyKey: run.idempotencyKey,
      runStatus: run.status,
      totalRecipients: run.totalRecipients,
      totalSent: run.totalSent,
      duration_ms: 0
    });
    return res.json(adminRunSummary(run));
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

function queryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0] === undefined ? undefined : String(value[0]);
  return value === undefined ? undefined : String(value);
}

function blueprintFiltersFromQuery(query: Record<string, unknown>): CampaignBlueprintFilter {
  const filters: CampaignBlueprintFilter = {};
  for (const key of ["appId", "productLine", "purpose", "campaignFamily", "lifecycleStage", "audienceKey", "catalogCategory", "catalogTag"] as const) {
    const value = queryValue(query[key]);
    if (value !== undefined) {
      (filters as Record<string, string>)[key] = value;
    }
  }
  return filters;
}

function campaignScopeFiltersFromQuery(query: Record<string, unknown>): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const key of ["tenantId", "appId", "brandId", "businessId", "productLine", "lifecycleScope", "environment"] as const) {
    const value = queryValue(query[key]);
    if (value !== undefined) filters[key] = value;
  }
  return filters;
}

const ANALYTICS_FACT_TYPES = new Set<AnalyticsFactType>(["delivered", "converted", "attributed_value"]);
const ANALYTICS_CHANNELS = new Set<Channel>(["email", "telegram", "whatsapp"]);

type AnalyticsOptionsResult = { ok: true; value: AnalyticsBuildOptions } | { ok: false; fields: Record<string, string> };
type ExternalFactsResult = { ok: true; value: ExternalAttributionFact[] } | { ok: false; fields: Record<string, string> };

function analyticsOptionsFromQuery(query: Record<string, unknown>, facts?: ExternalAttributionFact[]): AnalyticsOptionsResult {
  const fields: Record<string, string> = {};
  const options: AnalyticsBuildOptions = { ...campaignScopeFiltersFromQuery(query) };
  for (const key of ["segmentId", "campaignId", "from", "to"] as const) {
    const value = queryValue(query[key]);
    if (value !== undefined) (options as Record<string, string>)[key] = value;
  }
  const channel = queryValue(query.channel);
  if (channel !== undefined) {
    if (!ANALYTICS_CHANNELS.has(channel as Channel)) fields.channel = "unsupported_value";
    else options.channel = channel as Channel;
  }
  for (const key of ["from", "to"] as const) {
    const value = options[key];
    if (value !== undefined && !isValidIsoDate(value)) fields[key] = "required_iso_utc";
  }
  if (facts !== undefined) options.externalAttributionFacts = facts;
  return Object.keys(fields).length === 0 ? { ok: true, value: options } : { ok: false, fields };
}

function externalAttributionFactsFromBody(body: unknown): ExternalFactsResult {
  const source = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.externalAttributionFacts) ? body.externalAttributionFacts : [];
  const facts: ExternalAttributionFact[] = [];
  const fields: Record<string, string> = {};
  source.forEach((item, index) => {
    if (!isRecord(item)) {
      fields[`externalAttributionFacts.${index}`] = "required_object";
      return;
    }
    const factType = item.factType;
    const sourceService = item.sourceService;
    const occurredAt = item.occurredAt;
    const campaignId = item.campaignId;
    if (typeof factType !== "string" || !ANALYTICS_FACT_TYPES.has(factType as AnalyticsFactType)) fields[`externalAttributionFacts.${index}.factType`] = "unsupported_value";
    if (typeof sourceService !== "string" || sourceService.trim() === "") fields[`externalAttributionFacts.${index}.sourceService`] = "required_string";
    if (typeof occurredAt !== "string" || !isValidIsoDate(occurredAt)) fields[`externalAttributionFacts.${index}.occurredAt`] = "required_iso_utc";
    if (typeof campaignId !== "string" || campaignId.trim() === "") fields[`externalAttributionFacts.${index}.campaignId`] = "required_string";
    if (item.runId !== undefined && item.runId !== null && typeof item.runId !== "string") fields[`externalAttributionFacts.${index}.runId`] = "must_be_string_or_null";
    if (item.correlationId !== undefined && item.correlationId !== null && typeof item.correlationId !== "string") fields[`externalAttributionFacts.${index}.correlationId`] = "must_be_string_or_null";
    if (item.count !== undefined && item.count !== null && typeof item.count !== "number") fields[`externalAttributionFacts.${index}.count`] = "must_be_number_or_null";
    if (item.value !== undefined && item.value !== null && typeof item.value !== "number") fields[`externalAttributionFacts.${index}.value`] = "must_be_number_or_null";
    if (item.currency !== undefined && item.currency !== null && typeof item.currency !== "string") fields[`externalAttributionFacts.${index}.currency`] = "must_be_string_or_null";
    if (Object.keys(fields).some((key) => key.startsWith(`externalAttributionFacts.${index}.`))) return;
    facts.push({
      factType: factType as AnalyticsFactType,
      sourceService: sourceService as string,
      occurredAt: occurredAt as string,
      campaignId: campaignId as string,
      runId: item.runId === undefined ? null : item.runId as string | null,
      correlationId: item.correlationId === undefined ? null : item.correlationId as string | null,
      count: item.count === undefined ? null : item.count as number | null,
      value: item.value === undefined ? null : item.value as number | null,
      currency: item.currency === undefined ? null : item.currency as string | null
    });
  });
  return Object.keys(fields).length === 0 ? { ok: true, value: facts } : { ok: false, fields };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function countRunReasons(run: ExecutionRun): Record<string, number> {
  return run.results.reduce<Record<string, number>>((acc, result) => {
    acc[result.decisionReason] = (acc[result.decisionReason] ?? 0) + 1;
    return acc;
  }, {});
}

function countRunStatuses(run: ExecutionRun): Record<string, number> {
  return run.results.reduce<Record<string, number>>((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1;
    return acc;
  }, {});
}

function journeyStepDueAt(startAt: string, step: JourneyStep): string {
  return new Date(new Date(startAt).getTime() + step.delayMinutes * 60_000).toISOString();
}

function campaignMatchesCatalogFilters(campaign: Campaign, query: Record<string, unknown>): boolean {
  const metadata = campaign.catalogMetadata ?? null;
  const checks: Record<string, string | null | undefined> = {
    purpose: campaign.purpose,
    campaignFamily: metadata?.campaignFamily,
    lifecycleStage: metadata?.lifecycleStage,
    audienceKey: metadata?.audienceKey,
    catalogCategory: metadata?.catalogCategory,
    sourceBlueprintId: metadata?.sourceBlueprintId
  };
  for (const [key, actual] of Object.entries(checks)) {
    const expected = queryValue(query[key]);
    if (expected !== undefined && String(actual ?? "") !== expected) return false;
  }
  const catalogTag = queryValue(query.catalogTag);
  if (catalogTag !== undefined && !(metadata?.catalogTags ?? []).includes(catalogTag)) return false;
  return true;
}

app.get("/campaign-catalog/blueprints", (req, res) => {
  res.json(listDefaultCampaignBlueprints(blueprintFiltersFromQuery(req.query as Record<string, unknown>)));
});

app.get("/campaign-catalog/blueprints/:blueprintId", (req, res) => {
  const blueprint = getDefaultCampaignBlueprint(String(req.params.blueprintId));
  if (!blueprint) {
    return res.status(404).json({ error: "blueprint_not_found" });
  }
  return res.json(blueprint);
});


app.get("/campaign-catalog/bpcp/holiday-discount-2026/content-contract", (_req, res) => {
  const validation = validateHolidayDiscountCampaignContentContract(getHolidayDiscountCampaignContentContract());
  if (!validation.ok) {
    return sendContractError(res, 500, validation.error);
  }
  return res.json(validation.value);
});

app.get("/campaign-catalog/campaigns", async (req, res) => {
  const query = req.query as Record<string, unknown>;
  const campaigns = await getStore().listCampaigns(campaignScopeFiltersFromQuery(query));
  res.json(campaigns.filter((campaign) => campaignMatchesCatalogFilters(campaign, query)));
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
    catalogMetadata: body.catalogMetadata ?? null,
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
    catalogMetadata: saved.catalogMetadata ?? null,
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
    catalogMetadata: saved.catalogMetadata ?? null,
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


async function validateJourneyReferences(journey: Partial<Journey>): Promise<{ ok: true } | { ok: false; error: string; fields?: Record<string, string> }> {
  const store = getStore();
  const fields: Record<string, string> = {};
  const segmentIds = new Set<string>();
  const campaignIds = new Set<string>();
  if (journey.trigger?.segmentId) segmentIds.add(journey.trigger.segmentId);
  for (const step of journey.steps ?? []) campaignIds.add(step.campaignId);
  for (const rule of journey.exitRules ?? []) {
    if (rule.segmentId) segmentIds.add(rule.segmentId);
    if (rule.campaignId) campaignIds.add(rule.campaignId);
  }
  for (const rule of journey.suppressionRules ?? []) {
    if (rule.segmentId) segmentIds.add(rule.segmentId);
    if (rule.campaignId) campaignIds.add(rule.campaignId);
  }
  for (const segmentId of segmentIds) {
    if (!(await store.getSegment(segmentId))) fields[`segment:${segmentId}`] = "segment_not_found";
  }
  for (const campaignId of campaignIds) {
    if (!(await store.getCampaign(campaignId))) fields[`campaign:${campaignId}`] = "campaign_not_found";
  }
  return Object.keys(fields).length > 0 ? { ok: false, error: "invalid_journey_references", fields } : { ok: true };
}


app.post("/journeys", requireServiceAuth, async (req, res) => {
  const validation = validateJourneyBody(req.body);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }

  const now = new Date().toISOString();
  const body = validation.value;
  const registryValidation = await validateRegistryScope(registryScopeFrom(body as Journey));
  if (!registryValidation.ok) {
    return res.status(400).json({ error: registryValidation.reason, details: registryValidation.details });
  }
  const referenceValidation = await validateJourneyReferences(body);
  if (!referenceValidation.ok) {
    return res.status(400).json({ error: referenceValidation.error, fields: referenceValidation.fields });
  }

  const journey: Journey = {
    journeyId: crypto.randomUUID(),
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
    description: body.description ?? null,
    trigger: body.trigger!,
    steps: body.steps!,
    exitRules: body.exitRules ?? [],
    suppressionRules: body.suppressionRules ?? [],
    status: "draft",
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    activatedAt: null,
    createdAt: now,
    updatedAt: now
  };
  const saved = await getStore().saveJourney(journey);
  logDecision("journey_created", {
    journeyId: saved.journeyId,
    tenantId: saved.tenantId,
    appId: saved.appId,
    brandId: saved.brandId,
    status: saved.status,
    stepCount: saved.steps.length,
    exitRuleCount: saved.exitRules.length,
    suppressionRuleCount: saved.suppressionRules.length,
    duration_ms: 0
  });
  return res.status(201).json(saved);
});

app.get("/journeys", async (req, res) => {
  res.json(await getStore().listJourneys(req.query as Record<string, string>));
});

app.get("/journeys/:id", async (req, res) => {
  const journey = await getStore().getJourney(String(req.params.id));
  if (!journey) return res.status(404).json({ error: "journey_not_found" });
  return res.json(journey);
});

app.put("/journeys/:id", requireServiceAuth, async (req, res) => {
  const validation = validateJourneyBody(req.body, true);
  if (!validation.ok) {
    return sendContractError(res, 400, validation.error);
  }
  const existing = await getStore().getJourney(String(req.params.id));
  if (!existing) return res.status(404).json({ error: "journey_not_found" });
  const updated: Journey = {
    ...existing,
    ...validation.value,
    journeyId: existing.journeyId,
    status: existing.status,
    approvalStatus: existing.approvalStatus,
    approvedBy: existing.approvedBy ?? null,
    approvedAt: existing.approvedAt ?? null,
    approvalNote: existing.approvalNote ?? null,
    activatedAt: existing.activatedAt ?? null,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };
  const registryValidation = await validateRegistryScope(registryScopeFrom(updated));
  if (!registryValidation.ok) {
    return res.status(400).json({ error: registryValidation.reason, details: registryValidation.details });
  }
  const referenceValidation = await validateJourneyReferences(updated);
  if (!referenceValidation.ok) {
    return res.status(400).json({ error: referenceValidation.error, fields: referenceValidation.fields });
  }
  const saved = await getStore().saveJourney(updated);
  logDecision("journey_updated", {
    journeyId: saved.journeyId,
    status: saved.status,
    stepCount: saved.steps.length,
    exitRuleCount: saved.exitRules.length,
    suppressionRuleCount: saved.suppressionRules.length,
    duration_ms: 0
  });
  return res.json(saved);
});


app.post("/journeys/:id/approve", requireServiceAuth, async (req, res) => {
  const existing = await getStore().getJourney(String(req.params.id));
  if (!existing) return res.status(404).json({ error: "journey_not_found" });
  if (existing.status === "archived") return res.status(400).json({ error: "journey_archived" });

  const approvedBy = req.body?.approvedBy ?? req.headers["x-owner-actor"];
  if (!approvedBy || Array.isArray(approvedBy) || typeof approvedBy !== "string" || approvedBy.trim().length === 0) {
    return res.status(400).json({ error: "approved_by_required" });
  }
  if (req.body?.approvalNote !== undefined && req.body.approvalNote !== null && typeof req.body.approvalNote !== "string") {
    return res.status(400).json({ error: "invalid_journey_approval_request", fields: { approvalNote: "must_be_string_or_null" } });
  }

  const saved = await getStore().saveJourney({
    ...existing,
    approvalStatus: "approved",
    approvedBy: approvedBy.trim(),
    approvedAt: new Date().toISOString(),
    approvalNote: req.body?.approvalNote ?? null,
    updatedAt: new Date().toISOString()
  });
  logDecision("journey_approved", {
    journeyId: saved.journeyId,
    approvalStatus: saved.approvalStatus,
    approvedBy: saved.approvedBy ?? null,
    approvedAt: saved.approvedAt ?? null,
    status: saved.status,
    duration_ms: 0
  });
  return res.json(saved);
});

app.post("/journeys/:id/dry-run", requireServiceAuth, async (req, res) => {
  const journey = await getStore().getJourney(String(req.params.id));
  if (!journey) return res.status(404).json({ error: "journey_not_found" });
  if (journey.status === "archived") return res.status(400).json({ error: "journey_archived" });

  const requestedStartAt = req.body?.previewStartAt ?? req.body?.now;
  if (requestedStartAt !== undefined && (typeof requestedStartAt !== "string" || !isValidIsoDate(requestedStartAt))) {
    return res.status(400).json({ error: "invalid_journey_dry_run_request", fields: { previewStartAt: "must_be_iso_8601_utc_string" } });
  }

  const previewStartAt = requestedStartAt ?? journey.activatedAt ?? new Date().toISOString();
  const startedAt = Date.now();
  const triggerSegment = journey.trigger.segmentId ? await getStore().getSegment(journey.trigger.segmentId) : undefined;
  const actions = [];
  const errors: Array<{ stepId: string; campaignId: string; error: string }> = [];

  for (const step of journey.steps) {
    const campaign = await getStore().getCampaign(step.campaignId);
    const dueAt = journeyStepDueAt(previewStartAt, step);
    if (!campaign) {
      errors.push({ stepId: step.stepId, campaignId: step.campaignId, error: "campaign_not_found" });
      actions.push({
        stepId: step.stepId,
        name: step.name,
        campaignId: step.campaignId,
        dueAt,
        delayMinutes: step.delayMinutes,
        isDue: new Date(dueAt).getTime() <= new Date(previewStartAt).getTime(),
        status: "blocked",
        reason: "campaign_not_found"
      });
      continue;
    }

    const dryRunKey = "journey-dry-run:" + journey.journeyId + ":" + step.stepId + ":" + crypto.randomUUID();
    const run = await executeCampaign(campaign.campaignId, dryRunKey, { dryRun: true });
    actions.push({
      stepId: step.stepId,
      name: step.name,
      campaignId: campaign.campaignId,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      campaignApprovalStatus: campaign.approvalStatus,
      dueAt,
      delayMinutes: step.delayMinutes,
      isDue: new Date(dueAt).getTime() <= new Date(previewStartAt).getTime(),
      status: "previewed",
      dryRunId: run.id,
      idempotencyKey: run.idempotencyKey,
      totalRecipients: run.totalRecipients,
      wouldSend: run.results.filter((result) => result.status === "would_send").length,
      totalSkipped: run.results.filter((result) => result.status === "skipped").length,
      totalFailed: run.results.filter((result) => result.status === "failed").length,
      statusCounts: countRunStatuses(run),
      reasonCounts: countRunReasons(run)
    });
  }

  const preview = {
    status: "dry_run_completed",
    dryRun: true,
    journeyId: journey.journeyId,
    journeyStatus: journey.status,
    approvalStatus: journey.approvalStatus,
    previewStartAt,
    generatedAt: new Date().toISOString(),
    enrollmentPreview: {
      triggerType: journey.trigger.type,
      triggerSegmentId: journey.trigger.segmentId ?? null,
      triggerSegmentName: triggerSegment?.name ?? null,
      triggerRules: journey.trigger.rules ?? null,
      estimatedCount: triggerSegment?.estimatedCount ?? null,
      sourceTypes: triggerSegment?.sourceTypes ?? []
    },
    nextActions: actions,
    errors
  };

  logDecision("journey_dry_run_preview_requested", {
    journeyId: journey.journeyId,
    journeyStatus: journey.status,
    approvalStatus: journey.approvalStatus,
    previewStartAt,
    stepCount: journey.steps.length,
    previewedStepCount: actions.filter((action) => action.status === "previewed").length,
    errorCount: errors.length,
    duration_ms: Date.now() - startedAt
  });

  return res.json(preview);
});

app.post("/journeys/:id/activate", requireServiceAuth, async (req, res) => {
  const existing = await getStore().getJourney(String(req.params.id));
  if (!existing) return res.status(404).json({ error: "journey_not_found" });
  if (existing.status === "archived") return res.status(400).json({ error: "journey_archived" });
  if (existing.approvalStatus !== "approved" || !existing.approvedBy || !existing.approvedAt) {
    return res.status(400).json({ error: "journey_not_approved" });
  }
  const now = new Date().toISOString();
  const saved = await getStore().saveJourney({
    ...existing,
    status: "active",
    activatedAt: now,
    updatedAt: now
  });
  logDecision("journey_activated", {
    journeyId: saved.journeyId,
    approvalStatus: saved.approvalStatus,
    approvedBy: saved.approvedBy ?? null,
    approvedAt: saved.approvedAt ?? null,
    activatedAt: saved.activatedAt ?? null,
    stepCount: saved.steps.length,
    duration_ms: 0
  });
  return res.json(saved);
});

app.delete("/journeys/:id", requireServiceAuth, async (req, res) => {
  const existed = await getStore().deleteJourney(String(req.params.id));
  if (!existed) return res.status(404).json({ error: "journey_not_found" });
  logDecision("journey_deleted", { journeyId: String(req.params.id), duration_ms: 0 });
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
      journeyStepsClaimed: result.journeySteps.claimed,
      journeyStepsExecuted: result.journeySteps.executed,
      journeyStepsFailed: result.journeySteps.failed,
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
  await startOrdersEventsConsumer();
  startCredentialSelfReporter();
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
