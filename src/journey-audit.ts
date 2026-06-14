import { Journey, JourneyRuleEvidenceRef, JourneyStep, JourneyStepDecisionEvidence } from "./types";

function sortedObjectKeys(value?: Record<string, string | number | boolean> | null): string[] {
  return value ? Object.keys(value).sort() : [];
}

function exitRuleRefs(journey: Journey): JourneyRuleEvidenceRef[] {
  return journey.exitRules
    .map((rule) => ({
      ruleId: rule.ruleId,
      type: rule.type,
      segmentId: rule.segmentId ?? null,
      campaignId: rule.campaignId ?? null
    }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function suppressionRuleRefs(journey: Journey): JourneyRuleEvidenceRef[] {
  return journey.suppressionRules
    .map((rule) => ({
      ruleId: rule.ruleId,
      type: rule.type,
      segmentId: rule.segmentId ?? null,
      campaignId: rule.campaignId ?? null,
      windowMinutes: rule.windowMinutes ?? null
    }))
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

export function journeyStepIdempotencyKey(journeyId: string, stepId: string, dueAt: string): string {
  return "journey:" + journeyId + ":" + stepId + ":" + dueAt;
}

export function buildJourneyStepDecisionEvidence(
  journey: Journey,
  step: JourneyStep,
  dueAt: string,
  evaluatedAt = new Date().toISOString()
): JourneyStepDecisionEvidence {
  return {
    decision: "execute_campaign_step",
    reason: "step_due",
    evaluatedAt,
    journeyStatus: journey.status,
    journeyApprovalStatus: journey.approvalStatus,
    approvedBy: journey.approvedBy ?? null,
    approvedAt: journey.approvedAt ?? null,
    activatedAt: journey.activatedAt ?? null,
    dueAt,
    delayMinutes: step.delayMinutes,
    campaignId: step.campaignId,
    idempotencyKey: journeyStepIdempotencyKey(journey.journeyId, step.stepId, dueAt),
    conditionKeys: sortedObjectKeys(step.conditions),
    maxExecutionsPerRecipient: step.maxExecutionsPerRecipient ?? null,
    exitRuleRefs: exitRuleRefs(journey),
    suppressionRuleRefs: suppressionRuleRefs(journey)
  };
}
