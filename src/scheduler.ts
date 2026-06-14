import { executeCampaign } from "./executor";
import { journeyStepIdempotencyKey } from "./journey-audit";
import { logDecision } from "./logger";
import { getStore } from "./store";
import { ExecutionRun, JourneyStepClaim } from "./types";

const DEFAULT_SCHEDULER_BATCH_SIZE = 10;
const DEFAULT_SCHEDULER_LOCK_TTL_MS = 5 * 60 * 1000;

export interface SchedulerRunOptions {
  schedulerOwner?: string;
  now?: Date;
  batchSize?: number;
  lockTtlMs?: number;
}

export interface JourneyStepDecisionAudit {
  journeyId: string;
  stepId: string;
  campaignId: string;
  dueAt: string;
  claimId: string;
  status: "completed" | "failed";
  runId: string | null;
  idempotencyKey: string | null;
  runStatus: ExecutionRun["status"] | null;
  totalRecipients: number;
  totalSent: number;
  totalSkipped: number;
  totalFailed: number;
  statusCounts: Record<string, number>;
  reasonCounts: Record<string, number>;
  exitRuleTypes: string[];
  suppressionRuleTypes: string[];
  stepConditionKeys: string[];
  maxExecutionsPerRecipient: number | null;
  decisionEvidence: JourneyStepClaim["decisionEvidence"];
  errorReason?: string;
}

export interface SchedulerRunResult {
  schedulerOwner: string;
  claimed: number;
  executed: number;
  failed: number;
  runs: ExecutionRun[];
  errors: Array<{ campaignId: string; error: string }>;
  journeySteps: {
    claimed: number;
    executed: number;
    failed: number;
    runs: ExecutionRun[];
    errors: Array<{ journeyId: string; stepId: string; campaignId: string; error: string }>;
    decisions: JourneyStepDecisionAudit[];
  };
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

function countRunStatuses(run: ExecutionRun): Record<string, number> {
  return run.results.reduce<Record<string, number>>((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1;
    return acc;
  }, {});
}

function countRunReasons(run: ExecutionRun): Record<string, number> {
  return run.results.reduce<Record<string, number>>((acc, result) => {
    acc[result.decisionReason] = (acc[result.decisionReason] ?? 0) + 1;
    return acc;
  }, {});
}

function summarizeJourneyStepDecision(
  claim: JourneyStepClaim,
  status: "completed" | "failed",
  run?: ExecutionRun,
  errorReason?: string
): JourneyStepDecisionAudit {
  return {
    journeyId: claim.journeyId,
    stepId: claim.stepId,
    campaignId: claim.campaignId,
    dueAt: claim.dueAt,
    claimId: claim.id,
    status,
    runId: run?.id ?? null,
    idempotencyKey: run?.idempotencyKey ?? null,
    runStatus: run?.status ?? null,
    totalRecipients: run?.totalRecipients ?? 0,
    totalSent: run?.totalSent ?? 0,
    totalSkipped: run?.results.filter((result) => result.status === "skipped").length ?? 0,
    totalFailed: run?.results.filter((result) => result.status === "failed").length ?? 0,
    statusCounts: run ? countRunStatuses(run) : {},
    reasonCounts: run ? countRunReasons(run) : errorReason ? { [errorReason]: 1 } : {},
    exitRuleTypes: claim.journey.exitRules.map((rule) => rule.type),
    suppressionRuleTypes: claim.journey.suppressionRules.map((rule) => rule.type),
    stepConditionKeys: Object.keys(claim.step.conditions ?? {}).sort(),
    maxExecutionsPerRecipient: claim.step.maxExecutionsPerRecipient ?? null,
    decisionEvidence: claim.decisionEvidence,
    ...(errorReason ? { errorReason } : {})
  };
}

function logJourneyStepDecision(schedulerOwner: string, decision: JourneyStepDecisionAudit): void {
  logDecision("journey_step_decision_audited", {
    schedulerOwner,
    ...decision,
    duration_ms: 0
  });
}

export async function runDueScheduledCampaigns(options: SchedulerRunOptions = {}): Promise<SchedulerRunResult> {
  const owner = schedulerOwner(options.schedulerOwner);
  const now = options.now ?? new Date();
  const lockUntil = new Date(now.getTime() + configuredLockTtl(options.lockTtlMs));
  const store = getStore();
  const batchSize = configuredBatchSize(options.batchSize);
  const dueCampaigns = await store.claimDueScheduledCampaigns(owner, now.toISOString(), lockUntil.toISOString(), batchSize);
  const dueJourneySteps = await store.claimDueJourneySteps(owner, now.toISOString(), lockUntil.toISOString(), batchSize);
  const result: SchedulerRunResult = {
    schedulerOwner: owner,
    claimed: dueCampaigns.length,
    executed: 0,
    failed: 0,
    runs: [],
    errors: [],
    journeySteps: {
      claimed: dueJourneySteps.length,
      executed: 0,
      failed: 0,
      runs: [],
      errors: [],
      decisions: []
    }
  };

  logDecision("campaign_scheduler_claimed", { schedulerOwner: owner, claimed: dueCampaigns.length, lockUntil: lockUntil.toISOString() });

  for (const campaign of dueCampaigns) {
    const idempotencyKey = `scheduled:${campaign.campaignId}:${campaign.scheduleAt ?? now.toISOString()}`;
    try {
      const run = await executeCampaign(campaign.campaignId, idempotencyKey);
      result.runs.push(run);
      result.executed += 1;
      await store.completeScheduledCampaign(campaign.campaignId, campaign.scheduleAt, run.status === "failed" ? "failed" : "completed");
      logDecision("campaign_scheduler_executed", { schedulerOwner: owner, campaignId: campaign.campaignId, runId: run.id, runStatus: run.status, totalSent: run.totalSent });
    } catch (error) {
      const message = (error as Error).message;
      result.failed += 1;
      result.errors.push({ campaignId: campaign.campaignId, error: message });
      await store.completeScheduledCampaign(campaign.campaignId, campaign.scheduleAt, "failed");
      logDecision("campaign_scheduler_failed", { schedulerOwner: owner, campaignId: campaign.campaignId, reason: message });
    }
  }

  logDecision("journey_step_scheduler_claimed", { schedulerOwner: owner, claimed: dueJourneySteps.length, lockUntil: lockUntil.toISOString() });

  for (const claim of dueJourneySteps) {
    const idempotencyKey = claim.decisionEvidence.idempotencyKey || journeyStepIdempotencyKey(claim.journeyId, claim.stepId, claim.dueAt);
    try {
      const run = await executeCampaign(claim.campaignId, idempotencyKey);
      result.journeySteps.runs.push(run);
      result.journeySteps.executed += 1;
      const claimStatus = run.status === "failed" ? "failed" : "completed";
      await store.completeJourneyStepClaim(claim.id, run.id, claimStatus);
      const decision = summarizeJourneyStepDecision(claim, claimStatus, run);
      result.journeySteps.decisions.push(decision);
      logDecision("journey_step_scheduler_executed", {
        schedulerOwner: owner,
        journeyId: claim.journeyId,
        stepId: claim.stepId,
        campaignId: claim.campaignId,
        runId: run.id,
        idempotencyKey: run.idempotencyKey,
        runStatus: run.status,
        totalSent: run.totalSent
      });
      logJourneyStepDecision(owner, decision);
    } catch (error) {
      const message = (error as Error).message;
      result.journeySteps.failed += 1;
      result.journeySteps.errors.push({ journeyId: claim.journeyId, stepId: claim.stepId, campaignId: claim.campaignId, error: message });
      await store.completeJourneyStepClaim(claim.id, null, "failed", message);
      const decision = summarizeJourneyStepDecision(claim, "failed", undefined, message);
      result.journeySteps.decisions.push(decision);
      logDecision("journey_step_scheduler_failed", { schedulerOwner: owner, journeyId: claim.journeyId, stepId: claim.stepId, campaignId: claim.campaignId, reason: message });
      logJourneyStepDecision(owner, decision);
    }
  }

  return result;
}
