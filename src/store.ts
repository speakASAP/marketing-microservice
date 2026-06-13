import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { Campaign, CampaignApprovalStatus, DeliveryResult, ExecutionRun, Segment } from "./types";

export const segments = new Map<string, Segment>();
export const campaigns = new Map<string, Campaign>();
export const runs = new Map<string, ExecutionRun>();
export const sendHistory = new Map<string, string[]>();

export interface MarketingStore {
  init(): Promise<void>;
  reset(): Promise<void>;
  getSegment(id: string): Promise<Segment | undefined>;
  listSegments(): Promise<Segment[]>;
  saveSegment(segment: Segment): Promise<Segment>;
  deleteSegment(id: string): Promise<boolean>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  listCampaigns(): Promise<Campaign[]>;
  saveCampaign(campaign: Campaign): Promise<Campaign>;
  deleteCampaign(id: string): Promise<boolean>;
  findRunByIdempotency(campaignId: string, idempotencyKey: string): Promise<ExecutionRun | undefined>;
  listRuns(): Promise<ExecutionRun[]>;
  saveRun(run: ExecutionRun): Promise<ExecutionRun>;
  claimDueScheduledCampaigns(schedulerOwner: string, now: string, lockUntil: string, limit: number): Promise<Campaign[]>;
  completeScheduledCampaign(campaignId: string, scheduleAt: string | undefined, status: Campaign["status"]): Promise<Campaign | undefined>;
  getSendHistory(recipientRef: string): Promise<string[]>;
  recordSend(recipientRef: string, campaignId: string, runId: string, sentAt: string): Promise<void>;
}

export class InMemoryMarketingStore implements MarketingStore {
  async init(): Promise<void> {}

  async reset(): Promise<void> {
    segments.clear();
    campaigns.clear();
    runs.clear();
    sendHistory.clear();
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    return segments.get(id);
  }

  async listSegments(): Promise<Segment[]> {
    return Array.from(segments.values());
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

  async listCampaigns(): Promise<Campaign[]> {
    return Array.from(campaigns.values());
  }

  async saveCampaign(campaign: Campaign): Promise<Campaign> {
    campaigns.set(campaign.campaignId, campaign);
    return campaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return campaigns.delete(id);
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

  async getSendHistory(recipientRef: string): Promise<string[]> {
    return sendHistory.get(recipientRef) ?? [];
  }

  async recordSend(recipientRef: string, _campaignId: string, _runId: string, sentAt: string): Promise<void> {
    const history = sendHistory.get(recipientRef) ?? [];
    history.push(sentAt);
    sendHistory.set(recipientRef, history);
  }
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
    await this.pool.query("truncate table marketing_send_history, marketing_idempotency_keys, marketing_suppression_evidence, marketing_delivery_outcomes, marketing_campaign_runs, marketing_campaigns, marketing_segments restart identity cascade");
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    const result = await this.pool.query("select * from marketing_segments where segment_id = $1", [id]);
    return result.rows[0] ? rowToSegment(result.rows[0]) : undefined;
  }

  async listSegments(): Promise<Segment[]> {
    const result = await this.pool.query("select * from marketing_segments order by created_at asc, segment_id asc");
    return result.rows.map(rowToSegment);
  }

  async saveSegment(segment: Segment): Promise<Segment> {
    await this.pool.query(
      `insert into marketing_segments (segment_id, name, source_types, rules, is_dynamic, estimated_count)
       values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
       on conflict (segment_id) do update set
         name = excluded.name,
         source_types = excluded.source_types,
         rules = excluded.rules,
         is_dynamic = excluded.is_dynamic,
         estimated_count = excluded.estimated_count,
         updated_at = now()`,
      [segment.segmentId, segment.name, JSON.stringify(segment.sourceTypes), JSON.stringify(segment.rules), segment.isDynamic, segment.estimatedCount ?? null]
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

  async listCampaigns(): Promise<Campaign[]> {
    const result = await this.pool.query("select * from marketing_campaigns order by created_at asc, campaign_id asc");
    return result.rows.map(rowToCampaign);
  }

  async saveCampaign(campaign: Campaign): Promise<Campaign> {
    await this.pool.query(
      `insert into marketing_campaigns (
        campaign_id, tenant, name, segment_id, description, purpose, primary_channel,
        fallback_channels, channel_key, template_ref, schedule_at, throttle_per_minute,
        frequency_cap_per_day, message, status, approval_status, approved_by, approved_at, approval_note,
        scheduler_lock_owner, scheduler_lock_until, last_scheduled_run_at, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       on conflict (campaign_id) do update set
         tenant = excluded.tenant,
         name = excluded.name,
         segment_id = excluded.segment_id,
         description = excluded.description,
         purpose = excluded.purpose,
         primary_channel = excluded.primary_channel,
         fallback_channels = excluded.fallback_channels,
         channel_key = excluded.channel_key,
         template_ref = excluded.template_ref,
         schedule_at = excluded.schedule_at,
         throttle_per_minute = excluded.throttle_per_minute,
         frequency_cap_per_day = excluded.frequency_cap_per_day,
         message = excluded.message,
         status = excluded.status,
         approval_status = excluded.approval_status,
         approved_by = excluded.approved_by,
         approved_at = excluded.approved_at,
         approval_note = excluded.approval_note,
         scheduler_lock_owner = excluded.scheduler_lock_owner,
         scheduler_lock_until = excluded.scheduler_lock_until,
         last_scheduled_run_at = excluded.last_scheduled_run_at,
         updated_at = excluded.updated_at`,
      [
        campaign.campaignId,
        campaign.tenant,
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

  private async getRun(id: string): Promise<ExecutionRun | undefined> {
    const runResult = await this.pool.query("select * from marketing_campaign_runs where id = $1", [id]);
    if (!runResult.rows[0]) return undefined;
    const outcomes = await this.pool.query("select * from marketing_delivery_outcomes where run_id = $1 order by processed_at asc, delivery_id asc", [id]);
    return rowToRun(runResult.rows[0], outcomes.rows.map(rowToDeliveryResult));
  }
}

function rowToSegment(row: Record<string, unknown>): Segment {
  return {
    segmentId: String(row.segment_id),
    name: String(row.name),
    sourceTypes: asJsonArray(row.source_types),
    rules: asJsonObject(row.rules),
    isDynamic: Boolean(row.is_dynamic),
    estimatedCount: row.estimated_count === null ? null : Number(row.estimated_count)
  };
}

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    campaignId: String(row.campaign_id),
    tenant: String(row.tenant),
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
  sendHistory.clear();
  activeStore = new InMemoryMarketingStore();
}
