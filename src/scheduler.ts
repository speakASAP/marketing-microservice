import { executeCampaign } from "./executor";
import { logDecision } from "./logger";
import { getStore } from "./store";
import { ExecutionRun } from "./types";

const DEFAULT_SCHEDULER_BATCH_SIZE = 10;
const DEFAULT_SCHEDULER_LOCK_TTL_MS = 5 * 60 * 1000;

export interface SchedulerRunOptions {
  schedulerOwner?: string;
  now?: Date;
  batchSize?: number;
  lockTtlMs?: number;
}

export interface SchedulerRunResult {
  schedulerOwner: string;
  claimed: number;
  executed: number;
  failed: number;
  runs: ExecutionRun[];
  errors: Array<{ campaignId: string; error: string }>;
}

function configuredBatchSize(value?: number): number {
  const configured = value ?? Number(process.env.CAMPAIGN_SCHEDULER_BATCH_SIZE ?? DEFAULT_SCHEDULER_BATCH_SIZE);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_SCHEDULER_BATCH_SIZE;
}

function configuredLockTtl(value?: number): number {
  const configured = value ?? Number(process.env.CAMPAIGN_SCHEDULER_LOCK_TTL_MS ?? DEFAULT_SCHEDULER_LOCK_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_SCHEDULER_LOCK_TTL_MS;
}

function schedulerOwner(value?: string): string {
  return value ?? process.env.CAMPAIGN_SCHEDULER_OWNER ?? process.env.HOSTNAME ?? "marketing-scheduler";
}

export async function runDueScheduledCampaigns(options: SchedulerRunOptions = {}): Promise<SchedulerRunResult> {
  const owner = schedulerOwner(options.schedulerOwner);
  const now = options.now ?? new Date();
  const lockUntil = new Date(now.getTime() + configuredLockTtl(options.lockTtlMs));
  const store = getStore();
  const dueCampaigns = await store.claimDueScheduledCampaigns(owner, now.toISOString(), lockUntil.toISOString(), configuredBatchSize(options.batchSize));
  const result: SchedulerRunResult = {
    schedulerOwner: owner,
    claimed: dueCampaigns.length,
    executed: 0,
    failed: 0,
    runs: [],
    errors: []
  };

  logDecision("campaign_scheduler_claimed", {
    schedulerOwner: owner,
    claimed: dueCampaigns.length,
    lockUntil: lockUntil.toISOString()
  });

  for (const campaign of dueCampaigns) {
    const idempotencyKey = `scheduled:${campaign.campaignId}:${campaign.scheduleAt ?? now.toISOString()}`;
    try {
      const run = await executeCampaign(campaign.campaignId, idempotencyKey);
      result.runs.push(run);
      result.executed += 1;
      await store.completeScheduledCampaign(campaign.campaignId, campaign.scheduleAt, run.status === "failed" ? "failed" : "completed");
      logDecision("campaign_scheduler_executed", {
        schedulerOwner: owner,
        campaignId: campaign.campaignId,
        runId: run.id,
        runStatus: run.status,
        totalSent: run.totalSent
      });
    } catch (error) {
      const message = (error as Error).message;
      result.failed += 1;
      result.errors.push({ campaignId: campaign.campaignId, error: message });
      await store.completeScheduledCampaign(campaign.campaignId, campaign.scheduleAt, "failed");
      logDecision("campaign_scheduler_failed", {
        schedulerOwner: owner,
        campaignId: campaign.campaignId,
        reason: message
      });
    }
  }

  return result;
}
