import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { buildJourneyStepDecisionEvidence } from "./journey-audit";
import {
  APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY,
  ORDER_RUN_ATTRIBUTION_BLOCKER,
  ORDERS_EVENTS_EXCHANGE,
  ORDERS_ORDER_CREATED_V1,
  OrdersLifecycleSignal,
  OrdersLifecycleStats
} from "./order-lifecycle-events";
import { Campaign, CampaignApprovalStatus, DeliveryResult, ExecutionRun, Journey, JourneyStepClaim, Segment } from "./types";

export const segments = new Map<string, Segment>();
export const campaigns = new Map<string, Campaign>();
export const runs = new Map<string, ExecutionRun>();
export const journeys = new Map<string, Journey>();
export const journeyStepClaims = new Map<string, JourneyStepClaim>();
export const sendHistory = new Map<string, string[]>();
export const orderLifecycleEvents = new Map<string, StoredOrdersLifecycleEvent>();

export interface StoredOrdersLifecycleEvent extends OrdersLifecycleSignal {
  receivedAt: string;
}

export interface StoredOrdersLifecycleEventResult {
  accepted: boolean;
  duplicate: boolean;
  event: StoredOrdersLifecycleEvent;
}

export interface MarketingStore {
  init(): Promise<void>;
  reset(): Promise<void>;
  getSegment(id: string): Promise<Segment | undefined>;
  listSegments(filters?: Partial<Pick<Segment, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">>): Promise<Segment[]>;
  saveSegment(segment: Segment): Promise<Segment>;
  deleteSegment(id: string): Promise<boolean>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  listCampaigns(filters?: Partial<Pick<Campaign, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">>): Promise<Campaign[]>;
  saveCampaign(campaign: Campaign): Promise<Campaign>;
  deleteCampaign(id: string): Promise<boolean>;
  getJourney(id: string): Promise<Journey | undefined>;
  listJourneys(filters?: Partial<Pick<Journey, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">>): Promise<Journey[]>;
  saveJourney(journey: Journey): Promise<Journey>;
  deleteJourney(id: string): Promise<boolean>;
  findRunByIdempotency(campaignId: string, idempotencyKey: string): Promise<ExecutionRun | undefined>;
  listRuns(): Promise<ExecutionRun[]>;
  saveRun(run: ExecutionRun): Promise<ExecutionRun>;
  claimDueScheduledCampaigns(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<Campaign[]>;
  completeScheduledCampaign(campaignId: string, scheduleAt: string | undefined, status: Campaign["status"]): Promise<Campaign | undefined>;
  claimDueJourneySteps(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<JourneyStepClaim[]>;
  completeJourneyStepClaim(claimId: string, runId: string | null, status: "completed" | "failed", error?: string | null): Promise<JourneyStepClaim | undefined>;
  getSendHistory(recipientRef: string): Promise<string[]>;
  recordSend(recipientRef: string, campaignId: string, runId: string, sentAt: string): Promise<void>;
  recordOrdersLifecycleEvent(signal: OrdersLifecycleSignal, receivedAt: string): Promise<StoredOrdersLifecycleEventResult>;
  getOrdersLifecycleStats(): Promise<OrdersLifecycleStats>;
}

export class InMemoryMarketingStore implements MarketingStore {
  async init(): Promise<void> {}

  async reset(): Promise<void> {
    segments.clear();
    campaigns.clear();
    runs.clear();
    journeys.clear();
    journeyStepClaims.clear();
    sendHistory.clear();
    orderLifecycleEvents.clear();
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    return segments.get(id);
  }

  async listSegments(filters: Partial<Pick<Segment, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">> = {}): Promise<Segment[]> {
    return Array.from(segments.values()).filter((segment) => matchesScopeFilters(segment, filters));
  }

  async saveSegment(segment: Segment): Promise<Segment> {
    segments.set(segment.segmentId, segment);
    return segment;
  }

  async deleteSegment(id: string): Promise<boolean> {
    return segments.delete(id);
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return campaigns.get(id);
  }

  async listCampaigns(filters: Partial<Pick<Campaign, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">> = {}): Promise<Campaign[]> {
    return Array.from(campaigns.values()).filter((campaign) => matchesScopeFilters(campaign, filters));
  }

  async saveCampaign(campaign: Campaign): Promise<Campaign> {
    campaigns.set(campaign.campaignId, campaign);
    return campaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return campaigns.delete(id);
  }

  async getJourney(id: string): Promise<Journey | undefined> {
    return journeys.get(id);
  }

  async listJourneys(filters: Partial<Pick<Journey, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">> = {}): Promise<Journey[]> {
    return Array.from(journeys.values()).filter((journey) => matchesScopeFilters(journey, filters));
  }

  async saveJourney(journey: Journey): Promise<Journey> {
    journeys.set(journey.journeyId, journey);
    return journey;
  }

  async deleteJourney(id: string): Promise<boolean> {
    return journeys.delete(id);
  }


  async findRunByIdempotency(campaignId: string, idempotencyKey: string): Promise<ExecutionRun | undefined> {
    return Array.from(runs.values()).find((r) => r.campaignId === campaignId && r.idempotencyKey === idempotencyKey);
  }

  async listRuns(): Promise<ExecutionRun[]> {
    return Array.from(runs.values());
  }

  async saveRun(run: ExecutionRun): Promise<ExecutionRun> {
    runs.set(run.id, run);
    return run;
  }

  async claimDueScheduledCampaigns(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<Campaign[]> {
    const nowTime = new Date(now).getTime();
    const claimed: Campaign[] = [];
    const due = Array.from(campaigns.values())
      .filter((campaign) => {
        if (campaign.status !== "scheduled") return false;
        if (campaign.approvalStatus !== "approved" || !campaign.approvedBy || !campaign.approvedAt) return false;
        if (!campaign.scheduleAt || new Date(campaign.scheduleAt).getTime() > nowTime) return false;
        if (campaign.lastScheduledRunAt === campaign.scheduleAt) return false;
        if (campaign.schedulerLockUntil && new Date(campaign.schedulerLockUntil).getTime() > nowTime) return false;
        return true;
      })
      .sort((a, b) => String(a.scheduleAt).localeCompare(String(b.scheduleAt)))
      .slice(0, limit);

    for (const campaign of due) {
      const updated: Campaign = {
        ...campaign,
        schedulerLockOwner: schedulerOwner,
        schedulerLockUntil: lockUntil,
        updatedAt: now
      };
      campaigns.set(campaign.campaignId, updated);
      claimed.push(updated);
    }
    return claimed;
  }

  async completeScheduledCampaign(campaignId: string, scheduleAt: string | undefined, status: Campaign["status"]): Promise<Campaign | undefined> {
    const existing = campaigns.get(campaignId);
    if (!existing) return undefined;
    const updated: Campaign = {
      ...existing,
      status,
      lastScheduledRunAt: scheduleAt ?? existing.lastScheduledRunAt ?? null,
      schedulerLockOwner: null,
      schedulerLockUntil: null,
      updatedAt: new Date().toISOString()
    };
    campaigns.set(campaignId, updated);
    return updated;
  }

  async claimDueJourneySteps(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<JourneyStepClaim[]> {
    const nowTime = new Date(now).getTime();
    const claimed: JourneyStepClaim[] = [];
    const dueSteps = Array.from(journeys.values())
      .filter((journey) => journey.status === "active" && journey.approvalStatus === "approved" && Boolean(journey.approvedBy) && Boolean(journey.approvedAt) && Boolean(journey.activatedAt))
      .flatMap((journey) => journey.steps.map((step) => {
        const dueAt = new Date(new Date(journey.activatedAt as string).getTime() + step.delayMinutes * 60_000).toISOString();
        return { journey, step, dueAt };
      }))
      .filter(({ dueAt }) => new Date(dueAt).getTime() <= nowTime)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.journey.journeyId.localeCompare(b.journey.journeyId) || a.step.stepId.localeCompare(b.step.stepId));

    for (const due of dueSteps) {
      if (claimed.length >= limit) break;
      const id = journeyStepClaimId(due.journey.journeyId, due.step.stepId, due.dueAt);
      const existing = journeyStepClaims.get(id);
      if (existing?.status === "completed" || existing?.status === "failed") continue;
      if (existing?.schedulerLockUntil && new Date(existing.schedulerLockUntil).getTime() > nowTime) continue;
      const claim: JourneyStepClaim = {
        id,
        journeyId: due.journey.journeyId,
        stepId: due.step.stepId,
        campaignId: due.step.campaignId,
        dueAt: due.dueAt,
        schedulerOwner,
        schedulerLockUntil: lockUntil,
        status: "claimed",
        runId: existing?.runId ?? null,
        error: null,
        claimedAt: now,
        completedAt: null,
        decisionEvidence: buildJourneyStepDecisionEvidence(due.journey, due.step, due.dueAt, now),
        journey: due.journey,
        step: due.step
      };
      journeyStepClaims.set(id, claim);
      claimed.push(claim);
    }
    return claimed;
  }

  async completeJourneyStepClaim(claimId: string, runId: string | null, status: "completed" | "failed", error?: string | null): Promise<JourneyStepClaim | undefined> {
    const existing = journeyStepClaims.get(claimId);
    if (!existing) return undefined;
    const completed: JourneyStepClaim = {
      ...existing,
      status,
      runId,
      error: error ?? null,
      completedAt: new Date().toISOString(),
      schedulerLockUntil: new Date().toISOString()
    };
    journeyStepClaims.set(claimId, completed);
    return completed;
  }

  async getSendHistory(recipientRef: string): Promise<string[]> {
    return sendHistory.get(recipientRef) ?? [];
  }

  async recordSend(recipientRef: string, _campaignId: string, _runId: string, sentAt: string): Promise<void> {
    const history = sendHistory.get(recipientRef) ?? [];
    history.push(sentAt);
    sendHistory.set(recipientRef, history);
  }

  async recordOrdersLifecycleEvent(signal: OrdersLifecycleSignal, receivedAt: string): Promise<StoredOrdersLifecycleEventResult> {
    const event: StoredOrdersLifecycleEvent = { ...signal, receivedAt };
    const duplicate = orderLifecycleEvents.has(signal.eventId);
    if (!duplicate) {
      orderLifecycleEvents.set(signal.eventId, event);
    }
    return { accepted: !duplicate, duplicate, event: orderLifecycleEvents.get(signal.eventId) ?? event };
  }

  async getOrdersLifecycleStats(): Promise<OrdersLifecycleStats> {
    return buildOrdersLifecycleStats(Array.from(orderLifecycleEvents.values()));
  }
}

function matchesScopeFilters<T extends { tenantId: string; appId: string; brandId: string; businessId?: string | null; productLine?: string | null; lifecycleScope?: string | null; environment?: string | null }>(value: T, filters: Partial<Pick<T, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">>): boolean {
  return Object.entries(filters).every(([key, expected]) => expected === undefined || String(value[key as keyof T] ?? "") === String(expected));
}

function scopeFiltersWhere(filters: Partial<Pick<Segment, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">>): { where: string; values: string[] } {
  const columns: Record<string, string> = { tenantId: "tenant_id", appId: "app_id", brandId: "brand_id", businessId: "business_id", productLine: "product_line", lifecycleScope: "lifecycle_scope", environment: "environment" };
  const clauses: string[] = [];
  const values: string[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = filters[key as keyof typeof filters];
    if (value !== undefined) {
      values.push(String(value));
      clauses.push(column + " = $" + values.length);
    }
  }
  return { where: clauses.length > 0 ? " where " + clauses.join(" and ") : "", values };
}

function asJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") return JSON.parse(value) as T[];
  return [];
}

function asJsonObject<T extends object>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function journeyStepDecisionEvidence(
  value: unknown,
  journey: Journey,
  step: Journey["steps"][number],
  dueAt: string
): JourneyStepClaim["decisionEvidence"] {
  if (value !== null && value !== undefined) {
    const evidence = asJsonObject<Partial<JourneyStepClaim["decisionEvidence"]>>(value);
    if (evidence.decision === "execute_campaign_step" && typeof evidence.idempotencyKey === "string") {
      return evidence as JourneyStepClaim["decisionEvidence"];
    }
  }
  return buildJourneyStepDecisionEvidence(journey, step, dueAt);
}

function iso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

export class PostgresMarketingStore implements MarketingStore {
  private readonly pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? new Pool(getPostgresPoolConfig());
  }

  async init(): Promise<void> {
    if (process.env.DB_AUTO_CREATE === "true" || process.env.DB_SYNC === "true") {
      const migrationsDir = path.resolve(process.cwd(), "migrations");
      const migrationFiles = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
      for (const file of migrationFiles) {
        await this.pool.query(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
      }
    }
  }

  async reset(): Promise<void> {
    await this.pool.query("truncate table marketing_order_lifecycle_events, marketing_journey_step_claims, marketing_journeys, marketing_send_history, marketing_idempotency_keys, marketing_suppression_evidence, marketing_delivery_outcomes, marketing_campaign_runs, marketing_campaigns, marketing_segments restart identity cascade");
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    const result = await this.pool.query("select * from marketing_segments where segment_id = $1", [id]);
    return result.rows[0] ? rowToSegment(result.rows[0]) : undefined;
  }

  async listSegments(filters: Partial<Pick<Segment, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">> = {}): Promise<Segment[]> {
    const scoped = scopeFiltersWhere(filters);
    const result = await this.pool.query("select * from marketing_segments" + scoped.where + " order by created_at asc, segment_id asc", scoped.values);
    return result.rows.map(rowToSegment);
  }

  async saveSegment(segment: Segment): Promise<Segment> {
    await this.pool.query(
      "insert into marketing_segments (segment_id, tenant_id, app_id, brand_id, business_id, environment, default_locale, timezone, product_line, lifecycle_scope, legal_sender_identity, policy_ref, name, source_types, rules, is_dynamic, estimated_count) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17) on conflict (segment_id) do update set tenant_id = excluded.tenant_id, app_id = excluded.app_id, brand_id = excluded.brand_id, business_id = excluded.business_id, environment = excluded.environment, default_locale = excluded.default_locale, timezone = excluded.timezone, product_line = excluded.product_line, lifecycle_scope = excluded.lifecycle_scope, legal_sender_identity = excluded.legal_sender_identity, policy_ref = excluded.policy_ref, name = excluded.name, source_types = excluded.source_types, rules = excluded.rules, is_dynamic = excluded.is_dynamic, estimated_count = excluded.estimated_count, updated_at = now()",
      [
        segment.segmentId,
        segment.tenantId,
        segment.appId,
        segment.brandId,
        segment.businessId ?? null,
        segment.environment ?? null,
        segment.defaultLocale ?? null,
        segment.timezone ?? null,
        segment.productLine ?? null,
        segment.lifecycleScope ?? null,
        segment.legalSenderIdentity ?? null,
        segment.policyRef ?? null,
        segment.name,
        JSON.stringify(segment.sourceTypes),
        JSON.stringify(segment.rules),
        segment.isDynamic,
        segment.estimatedCount ?? null
      ]
    );
    return segment;
  }

  async deleteSegment(id: string): Promise<boolean> {
    const result = await this.pool.query("delete from marketing_segments where segment_id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const result = await this.pool.query("select * from marketing_campaigns where campaign_id = $1", [id]);
    return result.rows[0] ? rowToCampaign(result.rows[0]) : undefined;
  }

  async listCampaigns(filters: Partial<Pick<Campaign, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">> = {}): Promise<Campaign[]> {
    const scoped = scopeFiltersWhere(filters);
    const result = await this.pool.query("select * from marketing_campaigns" + scoped.where + " order by created_at asc, campaign_id asc", scoped.values);
    return result.rows.map(rowToCampaign);
  }

  async saveCampaign(campaign: Campaign): Promise<Campaign> {
    await this.pool.query(
      "insert into marketing_campaigns (campaign_id, tenant, tenant_id, app_id, brand_id, business_id, environment, default_locale, timezone, product_line, lifecycle_scope, legal_sender_identity, policy_ref, name, segment_id, description, purpose, primary_channel, fallback_channels, channel_key, template_ref, schedule_at, throttle_per_minute, frequency_cap_per_day, catalog_metadata, message, status, approval_status, approved_by, approved_at, approval_note, scheduler_lock_owner, scheduler_lock_until, last_scheduled_run_at, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21, $22, $23, $24, $25::jsonb, $26::jsonb, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36) on conflict (campaign_id) do update set tenant = excluded.tenant, tenant_id = excluded.tenant_id, app_id = excluded.app_id, brand_id = excluded.brand_id, business_id = excluded.business_id, environment = excluded.environment, default_locale = excluded.default_locale, timezone = excluded.timezone, product_line = excluded.product_line, lifecycle_scope = excluded.lifecycle_scope, legal_sender_identity = excluded.legal_sender_identity, policy_ref = excluded.policy_ref, name = excluded.name, segment_id = excluded.segment_id, description = excluded.description, purpose = excluded.purpose, primary_channel = excluded.primary_channel, fallback_channels = excluded.fallback_channels, channel_key = excluded.channel_key, template_ref = excluded.template_ref, schedule_at = excluded.schedule_at, throttle_per_minute = excluded.throttle_per_minute, frequency_cap_per_day = excluded.frequency_cap_per_day, catalog_metadata = excluded.catalog_metadata, message = excluded.message, status = excluded.status, approval_status = excluded.approval_status, approved_by = excluded.approved_by, approved_at = excluded.approved_at, approval_note = excluded.approval_note, scheduler_lock_owner = excluded.scheduler_lock_owner, scheduler_lock_until = excluded.scheduler_lock_until, last_scheduled_run_at = excluded.last_scheduled_run_at, updated_at = excluded.updated_at",
      [
        campaign.campaignId,
        campaign.tenant,
        campaign.tenantId,
        campaign.appId,
        campaign.brandId,
        campaign.businessId ?? null,
        campaign.environment ?? null,
        campaign.defaultLocale ?? null,
        campaign.timezone ?? null,
        campaign.productLine ?? null,
        campaign.lifecycleScope ?? null,
        campaign.legalSenderIdentity ?? null,
        campaign.policyRef ?? null,
        campaign.name,
        campaign.segmentId,
        campaign.description ?? null,
        campaign.purpose,
        campaign.primaryChannel,
        JSON.stringify(campaign.fallbackChannels),
        campaign.channelKey ?? null,
        campaign.templateRef,
        campaign.scheduleAt ?? null,
        campaign.throttlePerMinute ?? null,
        campaign.frequencyCapPerDay,
        JSON.stringify(campaign.catalogMetadata ?? null),
        JSON.stringify(campaign.message),
        campaign.status,
        campaign.approvalStatus ?? "pending",
        campaign.approvedBy ?? null,
        campaign.approvedAt ?? null,
        campaign.approvalNote ?? null,
        campaign.schedulerLockOwner ?? null,
        campaign.schedulerLockUntil ?? null,
        campaign.lastScheduledRunAt ?? null,
        campaign.createdAt,
        campaign.updatedAt
      ]
    );
    return campaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await this.pool.query("delete from marketing_campaigns where campaign_id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }


  async getJourney(id: string): Promise<Journey | undefined> {
    const result = await this.pool.query("select * from marketing_journeys where journey_id = $1", [id]);
    return result.rows[0] ? rowToJourney(result.rows[0]) : undefined;
  }

  async listJourneys(filters: Partial<Pick<Journey, "tenantId" | "appId" | "brandId" | "businessId" | "productLine" | "lifecycleScope" | "environment">> = {}): Promise<Journey[]> {
    const scoped = scopeFiltersWhere(filters);
    const result = await this.pool.query("select * from marketing_journeys" + scoped.where + " order by created_at asc, journey_id asc", scoped.values);
    return result.rows.map(rowToJourney);
  }

  async saveJourney(journey: Journey): Promise<Journey> {
    await this.pool.query(
      "insert into marketing_journeys (journey_id, tenant_id, app_id, brand_id, business_id, environment, default_locale, timezone, product_line, lifecycle_scope, legal_sender_identity, policy_ref, name, description, trigger, steps, exit_rules, suppression_rules, status, approval_status, approved_by, approved_at, approval_note, activated_at, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20, $21, $22, $23, $24, $25, $26) on conflict (journey_id) do update set tenant_id = excluded.tenant_id, app_id = excluded.app_id, brand_id = excluded.brand_id, business_id = excluded.business_id, environment = excluded.environment, default_locale = excluded.default_locale, timezone = excluded.timezone, product_line = excluded.product_line, lifecycle_scope = excluded.lifecycle_scope, legal_sender_identity = excluded.legal_sender_identity, policy_ref = excluded.policy_ref, name = excluded.name, description = excluded.description, trigger = excluded.trigger, steps = excluded.steps, exit_rules = excluded.exit_rules, suppression_rules = excluded.suppression_rules, status = excluded.status, approval_status = excluded.approval_status, approved_by = excluded.approved_by, approved_at = excluded.approved_at, approval_note = excluded.approval_note, activated_at = excluded.activated_at, updated_at = excluded.updated_at",
      [
        journey.journeyId,
        journey.tenantId,
        journey.appId,
        journey.brandId,
        journey.businessId ?? null,
        journey.environment ?? null,
        journey.defaultLocale ?? null,
        journey.timezone ?? null,
        journey.productLine ?? null,
        journey.lifecycleScope ?? null,
        journey.legalSenderIdentity ?? null,
        journey.policyRef ?? null,
        journey.name,
        journey.description ?? null,
        JSON.stringify(journey.trigger),
        JSON.stringify(journey.steps),
        JSON.stringify(journey.exitRules),
        JSON.stringify(journey.suppressionRules),
        journey.status,
        journey.approvalStatus ?? "pending",
        journey.approvedBy ?? null,
        journey.approvedAt ?? null,
        journey.approvalNote ?? null,
        journey.activatedAt ?? null,
        journey.createdAt,
        journey.updatedAt
      ]
    );
    return journey;
  }

  async deleteJourney(id: string): Promise<boolean> {
    const result = await this.pool.query("delete from marketing_journeys where journey_id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findRunByIdempotency(campaignId: string, idempotencyKey: string): Promise<ExecutionRun | undefined> {
    const result = await this.pool.query(
      "select run_id from marketing_idempotency_keys where campaign_id = $1 and idempotency_key = $2",
      [campaignId, idempotencyKey]
    );
    if (!result.rows[0]) return undefined;
    return this.getRun(result.rows[0].run_id);
  }

  async listRuns(): Promise<ExecutionRun[]> {
    const result = await this.pool.query("select id from marketing_campaign_runs order by started_at desc, id desc");
    const storedRuns = await Promise.all(result.rows.map((row) => this.getRun(row.id)));
    return storedRuns.filter((run): run is ExecutionRun => Boolean(run));
  }

  async saveRun(run: ExecutionRun): Promise<ExecutionRun> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into marketing_campaign_runs (
          id, campaign_id, idempotency_key, started_at, completed_at, status, dry_run, approval_status, approved_by, approved_at, total_recipients, total_sent
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (id) do update set
           completed_at = excluded.completed_at,
           status = excluded.status,
           dry_run = excluded.dry_run,
           approval_status = excluded.approval_status,
           approved_by = excluded.approved_by,
           approved_at = excluded.approved_at,
           total_recipients = excluded.total_recipients,
           total_sent = excluded.total_sent,
           updated_at = now()`,
        [
          run.id,
          run.campaignId,
          run.idempotencyKey,
          run.startedAt,
          run.completedAt ?? null,
          run.status,
          run.dryRun === true,
          run.approvalEvidence?.approvalStatus ?? null,
          run.approvalEvidence?.approvedBy ?? null,
          run.approvalEvidence?.approvedAt ?? null,
          run.totalRecipients,
          run.totalSent
        ]
      );
      await client.query(
        `insert into marketing_idempotency_keys (campaign_id, idempotency_key, run_id)
         values ($1, $2, $3)
         on conflict (campaign_id, idempotency_key) do nothing`,
        [run.campaignId, run.idempotencyKey, run.id]
      );
      await client.query("delete from marketing_delivery_outcomes where run_id = $1", [run.id]);
      await client.query("delete from marketing_suppression_evidence where run_id = $1", [run.id]);
      for (const outcome of run.results) {
        await client.query(
          `insert into marketing_delivery_outcomes (
            delivery_id, run_id, campaign_id, recipient_ref, recipient_source, recipient_address,
            requested_channel, effective_channel, status, decision_reason, processed_at, duration_ms, correlation_id
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            outcome.deliveryId,
            run.id,
            outcome.campaignId,
            outcome.recipientRef,
            outcome.recipientSource,
            outcome.recipientAddress,
            outcome.requestedChannel,
            outcome.effectiveChannel,
            outcome.status,
            outcome.decisionReason,
            outcome.processedAt,
            outcome.duration_ms,
            outcome.correlationId ?? null
          ]
        );
        if (outcome.status === "skipped" || outcome.status === "failed") {
          await client.query(
            `insert into marketing_suppression_evidence (id, run_id, campaign_id, recipient_ref, recipient_source, reason, evidence, recorded_at)
             values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
            [
              crypto.randomUUID(),
              run.id,
              outcome.campaignId,
              outcome.recipientRef,
              outcome.recipientSource,
              outcome.decisionReason,
              JSON.stringify({ status: outcome.status, requestedChannel: outcome.requestedChannel, effectiveChannel: outcome.effectiveChannel }),
              outcome.processedAt
            ]
          );
        }
      }
      await client.query("commit");
      return run;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async claimDueScheduledCampaigns(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<Campaign[]> {
    const result = await this.pool.query(
      `with due as (
        select campaign_id
        from marketing_campaigns
        where status = 'scheduled'
          and approval_status = 'approved'
          and approved_by is not null
          and approved_at is not null
          and schedule_at is not null
          and schedule_at <= $1
          and (last_scheduled_run_at is null or last_scheduled_run_at <> schedule_at)
          and (scheduler_lock_until is null or scheduler_lock_until <= $1)
        order by schedule_at asc, campaign_id asc
        limit $4
        for update skip locked
      )
      update marketing_campaigns c
      set scheduler_lock_owner = $2,
          scheduler_lock_until = $3,
          updated_at = now()
      from due
      where c.campaign_id = due.campaign_id
      returning c.*`,
      [now, schedulerOwner, lockUntil, limit]
    );
    return result.rows.map(rowToCampaign);
  }

  async completeScheduledCampaign(campaignId: string, scheduleAt: string | undefined, status: Campaign["status"]): Promise<Campaign | undefined> {
    const result = await this.pool.query(
      `update marketing_campaigns
       set status = $3,
           last_scheduled_run_at = coalesce($2, last_scheduled_run_at),
           scheduler_lock_owner = null,
           scheduler_lock_until = null,
           updated_at = now()
       where campaign_id = $1
       returning *`,
      [campaignId, scheduleAt ?? null, status]
    );
    return result.rows[0] ? rowToCampaign(result.rows[0]) : undefined;
  }

  async claimDueJourneySteps(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<JourneyStepClaim[]> {
    const result = await this.pool.query(
      `with due as (
        select
          j.journey_id,
          step.value->>'stepId' as step_id,
          step.value->>'campaignId' as campaign_id,
          j.activated_at + make_interval(mins => ((step.value->>'delayMinutes')::int)) as due_at
        from marketing_journeys j
        cross join lateral jsonb_array_elements(j.steps) as step(value)
        where j.status = 'active'
          and j.approval_status = 'approved'
          and j.approved_by is not null
          and j.approved_at is not null
          and j.activated_at is not null
          and j.activated_at + make_interval(mins => ((step.value->>'delayMinutes')::int)) <= $1
        order by due_at asc, j.journey_id asc, step.value->>'stepId' asc
        limit $4
      ), claimed as (
        insert into marketing_journey_step_claims (
          id, journey_id, step_id, campaign_id, due_at, scheduler_lock_owner, scheduler_lock_until, status, claimed_at
        )
        select
          'journey-step:' || journey_id || ':' || step_id || ':' || to_char(due_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          journey_id,
          step_id,
          campaign_id,
          due_at,
          $2,
          $3,
          'claimed',
          $1
        from due
        on conflict (journey_id, step_id, due_at) do update
          set scheduler_lock_owner = excluded.scheduler_lock_owner,
              scheduler_lock_until = excluded.scheduler_lock_until,
              status = 'claimed',
              error = null,
              claimed_at = excluded.claimed_at,
              updated_at = now()
          where marketing_journey_step_claims.status = 'claimed'
            and marketing_journey_step_claims.scheduler_lock_until <= $1
        returning *
      )
      select * from claimed order by due_at asc, journey_id asc, step_id asc`,
      [now, schedulerOwner, lockUntil, limit]
    );

    const claims: JourneyStepClaim[] = [];
    for (const row of result.rows) {
      const claim = await this.rowToJourneyStepClaim(row);
      if (claim) {
        await this.pool.query("update marketing_journey_step_claims set decision_evidence = $2::jsonb, updated_at = now() where id = $1", [claim.id, JSON.stringify(claim.decisionEvidence)]);
        claims.push(claim);
      }
    }
    return claims;
  }

  async completeJourneyStepClaim(claimId: string, runId: string | null, status: "completed" | "failed", error?: string | null): Promise<JourneyStepClaim | undefined> {
    const result = await this.pool.query(
      `update marketing_journey_step_claims
       set status = $2,
           run_id = $3,
           error = $4,
           completed_at = now(),
           scheduler_lock_until = now(),
           updated_at = now()
       where id = $1
       returning *`,
      [claimId, status, runId, error ?? null]
    );
    return result.rows[0] ? this.rowToJourneyStepClaim(result.rows[0]) : undefined;
  }

  async getSendHistory(recipientRef: string): Promise<string[]> {
    const result = await this.pool.query(
      "select sent_at from marketing_send_history where recipient_ref = $1 order by sent_at desc",
      [recipientRef]
    );
    return result.rows.map((row) => iso(row.sent_at)).filter((value): value is string => Boolean(value));
  }

  async recordSend(recipientRef: string, campaignId: string, runId: string, sentAt: string): Promise<void> {
    await this.pool.query(
      "insert into marketing_send_history (id, recipient_ref, campaign_id, run_id, sent_at) values ($1, $2, $3, $4, $5)",
      [crypto.randomUUID(), recipientRef, campaignId, runId, sentAt]
    );
  }

  async recordOrdersLifecycleEvent(signal: OrdersLifecycleSignal, receivedAt: string): Promise<StoredOrdersLifecycleEventResult> {
    const result = await this.pool.query(
      `insert into marketing_order_lifecycle_events (
        event_id, event_type, event_version, order_id, occurred_at, received_at, channel, status, previous_status, campaign_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (event_id) do nothing
       returning *`,
      [
        signal.eventId,
        signal.eventType,
        signal.eventVersion,
        signal.orderId,
        signal.occurredAt,
        receivedAt,
        signal.channel ?? null,
        signal.status ?? null,
        signal.previousStatus ?? null,
        signal.campaignId ?? null
      ]
    );

    const duplicate = (result.rowCount ?? 0) === 0;
    if (!duplicate) {
      return { accepted: true, duplicate: false, event: rowToStoredOrdersLifecycleEvent(result.rows[0]) };
    }

    const existing = await this.pool.query("select * from marketing_order_lifecycle_events where event_id = $1", [signal.eventId]);
    return {
      accepted: false,
      duplicate: true,
      event: existing.rows[0] ? rowToStoredOrdersLifecycleEvent(existing.rows[0]) : { ...signal, receivedAt }
    };
  }

  async getOrdersLifecycleStats(): Promise<OrdersLifecycleStats> {
    const result = await this.pool.query("select * from marketing_order_lifecycle_events order by occurred_at asc, event_id asc");
    return buildOrdersLifecycleStats(result.rows.map(rowToStoredOrdersLifecycleEvent));
  }

  private async getRun(id: string): Promise<ExecutionRun | undefined> {
    const runResult = await this.pool.query("select * from marketing_campaign_runs where id = $1", [id]);
    if (!runResult.rows[0]) return undefined;
    const outcomes = await this.pool.query("select * from marketing_delivery_outcomes where run_id = $1 order by processed_at asc, delivery_id asc", [id]);
    return rowToRun(runResult.rows[0], outcomes.rows.map(rowToDeliveryResult));
  }

  private async rowToJourneyStepClaim(row: Record<string, unknown>): Promise<JourneyStepClaim | undefined> {
    const journey = await this.getJourney(String(row.journey_id));
    if (!journey) return undefined;
    const step = journey.steps.find((item) => item.stepId === String(row.step_id));
    if (!step) return undefined;
    return {
      id: String(row.id),
      journeyId: String(row.journey_id),
      stepId: String(row.step_id),
      campaignId: String(row.campaign_id),
      dueAt: iso(row.due_at) ?? new Date().toISOString(),
      schedulerOwner: String(row.scheduler_lock_owner),
      schedulerLockUntil: iso(row.scheduler_lock_until) ?? new Date().toISOString(),
      status: row.status as JourneyStepClaim["status"],
      runId: row.run_id === null || row.run_id === undefined ? null : String(row.run_id),
      error: row.error === null || row.error === undefined ? null : String(row.error),
      claimedAt: iso(row.claimed_at) ?? new Date().toISOString(),
      completedAt: iso(row.completed_at) ?? null,
      decisionEvidence: journeyStepDecisionEvidence(row.decision_evidence, journey, step, iso(row.due_at) ?? new Date().toISOString()),
      journey,
      step
    };
  }
}

function journeyStepClaimId(journeyId: string, stepId: string, dueAt: string): string {
  return `journey-step:${journeyId}:${stepId}:${dueAt}`;
}

function rowToSegment(row: Record<string, unknown>): Segment {
  return {
    segmentId: String(row.segment_id),
    tenantId: String(row.tenant_id ?? row.tenant ?? ""),
    appId: String(row.app_id ?? ""),
    brandId: String(row.brand_id ?? ""),
    businessId: row.business_id === null || row.business_id === undefined ? null : String(row.business_id),
    environment: row.environment === null || row.environment === undefined ? null : row.environment as Segment["environment"],
    defaultLocale: row.default_locale === null || row.default_locale === undefined ? null : String(row.default_locale),
    timezone: row.timezone === null || row.timezone === undefined ? null : String(row.timezone),
    productLine: row.product_line === null || row.product_line === undefined ? null : String(row.product_line),
    lifecycleScope: row.lifecycle_scope === null || row.lifecycle_scope === undefined ? null : String(row.lifecycle_scope),
    legalSenderIdentity: row.legal_sender_identity === null || row.legal_sender_identity === undefined ? null : String(row.legal_sender_identity),
    policyRef: row.policy_ref === null || row.policy_ref === undefined ? null : String(row.policy_ref),
    name: String(row.name),
    sourceTypes: asJsonArray(row.source_types),
    rules: asJsonObject(row.rules),
    isDynamic: Boolean(row.is_dynamic),
    estimatedCount: row.estimated_count === null ? null : Number(row.estimated_count)
  };
}

function rowToStoredOrdersLifecycleEvent(row: Record<string, unknown>): StoredOrdersLifecycleEvent {
  return {
    eventType: String(row.event_type) as OrdersLifecycleSignal["eventType"],
    eventVersion: Number(row.event_version) as 1,
    eventId: String(row.event_id),
    occurredAt: iso(row.occurred_at) ?? new Date().toISOString(),
    receivedAt: iso(row.received_at) ?? new Date().toISOString(),
    orderId: String(row.order_id),
    channel: row.channel === null || row.channel === undefined ? undefined : String(row.channel),
    status: row.status === null || row.status === undefined ? undefined : String(row.status),
    previousStatus: row.previous_status === null || row.previous_status === undefined ? undefined : String(row.previous_status),
    campaignId: row.campaign_id === null || row.campaign_id === undefined ? undefined : String(row.campaign_id)
  };
}

function incrementRecord(record: Record<string, number>, key: string | undefined): void {
  if (!key) return;
  record[key] = (record[key] ?? 0) + 1;
}

function sortedNumberRecord(record: Record<string, number>): Record<string, number> {
  return Object.keys(record)
    .sort()
    .reduce<Record<string, number>>((accumulator, key) => {
      accumulator[key] = record[key];
      return accumulator;
    }, {});
}

function buildOrdersLifecycleStats(events: StoredOrdersLifecycleEvent[]): OrdersLifecycleStats {
  const byEventType: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byCampaignId: Record<string, number> = {};
  const orderIds = new Set<string>();
  const campaignByOrderId = new Map<string, string>();

  for (const event of events) {
    if (event.campaignId) campaignByOrderId.set(event.orderId, event.campaignId);
  }

  let campaignAttributionUpdates = 0;
  let unattributedOrderSignals = 0;
  for (const event of events) {
    incrementRecord(byEventType, event.eventType);
    incrementRecord(byChannel, event.channel);
    incrementRecord(byStatus, event.status);
    orderIds.add(event.orderId);
    const campaignId = event.campaignId ?? campaignByOrderId.get(event.orderId);
    if (campaignId) {
      campaignAttributionUpdates += 1;
      incrementRecord(byCampaignId, campaignId);
    } else {
      unattributedOrderSignals += 1;
    }
  }

  return {
    sourceOwner: "orders-microservice",
    consumerOwner: "marketing-microservice",
    exchange: ORDERS_EVENTS_EXCHANGE,
    bindings: {
      orderCreated: ORDERS_ORDER_CREATED_V1,
      orderStatusChanged: APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY
    },
    processedEventIds: events.map((event) => event.eventId).sort(),
    orderRefs: Array.from(orderIds).map((orderId) => `orders:order:${orderId}`).sort(),
    totals: {
      acceptedEvents: events.length,
      duplicateEvents: 0,
      rejectedEvents: 0,
      orderCreated: events.filter((event) => event.eventType === ORDERS_ORDER_CREATED_V1).length,
      orderStatusChanged: events.filter((event) => event.eventType === APPROVED_ORDERS_STATUS_CHANGE_ROUTING_KEY).length,
      unattributedOrderSignals,
      campaignAttributionUpdates
    },
    byEventType: sortedNumberRecord(byEventType),
    byChannel: sortedNumberRecord(byChannel),
    byStatus: sortedNumberRecord(byStatus),
    byCampaignId: sortedNumberRecord(byCampaignId),
    campaignRefs: Array.from(new Set(campaignByOrderId.values()))
      .map((campaignId) => `marketing:campaign:${campaignId}`)
      .sort(),
    blockers: [ORDER_RUN_ATTRIBUTION_BLOCKER]
  };
}

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    campaignId: String(row.campaign_id),
    tenant: String(row.tenant),
    tenantId: String(row.tenant_id ?? row.tenant ?? ""),
    appId: String(row.app_id ?? ""),
    brandId: String(row.brand_id ?? ""),
    businessId: row.business_id === null || row.business_id === undefined ? null : String(row.business_id),
    environment: row.environment === null || row.environment === undefined ? null : row.environment as Campaign["environment"],
    defaultLocale: row.default_locale === null || row.default_locale === undefined ? null : String(row.default_locale),
    timezone: row.timezone === null || row.timezone === undefined ? null : String(row.timezone),
    productLine: row.product_line === null || row.product_line === undefined ? null : String(row.product_line),
    lifecycleScope: row.lifecycle_scope === null || row.lifecycle_scope === undefined ? null : String(row.lifecycle_scope),
    legalSenderIdentity: row.legal_sender_identity === null || row.legal_sender_identity === undefined ? null : String(row.legal_sender_identity),
    policyRef: row.policy_ref === null || row.policy_ref === undefined ? null : String(row.policy_ref),
    name: String(row.name),
    segmentId: String(row.segment_id),
    description: row.description === null ? null : String(row.description),
    purpose: row.purpose as Campaign["purpose"],
    primaryChannel: row.primary_channel as Campaign["primaryChannel"],
    fallbackChannels: asJsonArray(row.fallback_channels),
    channelKey: row.channel_key === null ? undefined : String(row.channel_key),
    templateRef: String(row.template_ref),
    scheduleAt: iso(row.schedule_at),
    throttlePerMinute: row.throttle_per_minute === null ? null : Number(row.throttle_per_minute),
    frequencyCapPerDay: Number(row.frequency_cap_per_day),
    catalogMetadata: row.catalog_metadata === null || row.catalog_metadata === undefined ? null : asJsonObject(row.catalog_metadata),
    message: asJsonObject(row.message),
    status: row.status as Campaign["status"],
    approvalStatus: (row.approval_status as Campaign["approvalStatus"]) ?? "pending",
    approvedBy: row.approved_by === null || row.approved_by === undefined ? null : String(row.approved_by),
    approvedAt: iso(row.approved_at) ?? null,
    approvalNote: row.approval_note === null || row.approval_note === undefined ? null : String(row.approval_note),
    schedulerLockOwner: row.scheduler_lock_owner === null || row.scheduler_lock_owner === undefined ? null : String(row.scheduler_lock_owner),
    schedulerLockUntil: iso(row.scheduler_lock_until) ?? null,
    lastScheduledRunAt: iso(row.last_scheduled_run_at) ?? null,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString()
  };
}


function rowToJourney(row: Record<string, unknown>): Journey {
  return {
    journeyId: String(row.journey_id),
    tenantId: String(row.tenant_id ?? ""),
    appId: String(row.app_id ?? ""),
    brandId: String(row.brand_id ?? ""),
    businessId: row.business_id === null || row.business_id === undefined ? null : String(row.business_id),
    environment: row.environment === null || row.environment === undefined ? null : row.environment as Journey["environment"],
    defaultLocale: row.default_locale === null || row.default_locale === undefined ? null : String(row.default_locale),
    timezone: row.timezone === null || row.timezone === undefined ? null : String(row.timezone),
    productLine: row.product_line === null || row.product_line === undefined ? null : String(row.product_line),
    lifecycleScope: row.lifecycle_scope === null || row.lifecycle_scope === undefined ? null : String(row.lifecycle_scope),
    legalSenderIdentity: row.legal_sender_identity === null || row.legal_sender_identity === undefined ? null : String(row.legal_sender_identity),
    policyRef: row.policy_ref === null || row.policy_ref === undefined ? null : String(row.policy_ref),
    name: String(row.name),
    description: row.description === null || row.description === undefined ? null : String(row.description),
    trigger: asJsonObject(row.trigger),
    steps: asJsonArray(row.steps),
    exitRules: asJsonArray(row.exit_rules),
    suppressionRules: asJsonArray(row.suppression_rules),
    status: row.status as Journey["status"],
    approvalStatus: (row.approval_status as Journey["approvalStatus"]) ?? "pending",
    approvedBy: row.approved_by === null || row.approved_by === undefined ? null : String(row.approved_by),
    approvedAt: iso(row.approved_at) ?? null,
    approvalNote: row.approval_note === null || row.approval_note === undefined ? null : String(row.approval_note),
    activatedAt: iso(row.activated_at) ?? null,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString()
  };
}

function rowToDeliveryResult(row: Record<string, unknown>): DeliveryResult {
  return {
    deliveryId: String(row.delivery_id),
    campaignId: String(row.campaign_id),
    recipientRef: String(row.recipient_ref),
    recipientSource: row.recipient_source as DeliveryResult["recipientSource"],
    recipientAddress: String(row.recipient_address),
    requestedChannel: row.requested_channel as DeliveryResult["requestedChannel"],
    effectiveChannel: row.effective_channel as DeliveryResult["effectiveChannel"],
    status: row.status as DeliveryResult["status"],
    decisionReason: String(row.decision_reason),
    processedAt: iso(row.processed_at) ?? new Date().toISOString(),
    duration_ms: Number(row.duration_ms),
    correlationId: row.correlation_id === null || row.correlation_id === undefined ? undefined : String(row.correlation_id)
  };
}

function rowToRun(row: Record<string, unknown>, results: DeliveryResult[]): ExecutionRun {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    idempotencyKey: String(row.idempotency_key),
    startedAt: iso(row.started_at) ?? new Date().toISOString(),
    completedAt: iso(row.completed_at),
    status: row.status as ExecutionRun["status"],
    dryRun: Boolean(row.dry_run),
    schedulerOwner: null,
    approvalEvidence: row.approval_status
      ? {
          approvalStatus: row.approval_status as CampaignApprovalStatus,
          approvedBy: row.approved_by === null || row.approved_by === undefined ? null : String(row.approved_by),
          approvedAt: iso(row.approved_at) ?? null
        }
      : null,
    totalRecipients: Number(row.total_recipients),
    totalSent: Number(row.total_sent),
    results
  };
}

function getPostgresPoolConfig(): { connectionString?: string; host?: string; port?: number; user?: string; password?: string; database?: string } {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  };
}

function shouldUsePostgres(): boolean {
  return process.env.MARKETING_STORE === "postgres" || Boolean(process.env.DATABASE_URL) || Boolean(process.env.DB_HOST && process.env.DB_NAME);
}

let activeStore: MarketingStore = new InMemoryMarketingStore();

export function getStore(): MarketingStore {
  return activeStore;
}

export function setStoreForTest(store: MarketingStore): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("store_override_is_test_only");
  }
  activeStore = store;
}

export async function initializeConfiguredStore(): Promise<MarketingStore> {
  activeStore = shouldUsePostgres() ? new PostgresMarketingStore() : new InMemoryMarketingStore();
  await activeStore.init();
  return activeStore;
}

export function resetInMemoryState(): void {
  segments.clear();
  campaigns.clear();
  runs.clear();
  journeys.clear();
  journeyStepClaims.clear();
  sendHistory.clear();
  activeStore = new InMemoryMarketingStore();
}
