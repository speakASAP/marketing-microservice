import { Campaign, Contact, ProductionGovernanceMetadata, ProductionRiskClass } from "./types";

const RISK_RANK: Record<ProductionRiskClass, number> = { low: 1, standard: 2, high: 3, restricted: 4 };
const DEFAULT_LOW_MAX = 50;
const DEFAULT_STANDARD_MAX = 250;
const DEFAULT_HIGH_MAX = 1000;
const DEFAULT_QUIET_START_HOUR = 21;
const DEFAULT_QUIET_END_HOUR = 8;
const DEFAULT_EMERGENCY_OVERRIDE_MAX_HOURS = 4;

export type ProductionGovernanceEvidence = {
  enforced: boolean;
  riskClass: ProductionRiskClass;
  riskReasons: string[];
  policyRef: string;
  quietHourPolicy: string;
};

export type ProductionGovernanceResult =
  | { ok: true; evidence: ProductionGovernanceEvidence }
  | { ok: false; reason: string; evidence: ProductionGovernanceEvidence };

function configuredInt(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function configuredBoolean(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function configuredList(key: string, fallback: string[]): string[] {
  const value = process.env[key];
  if (!value || value.trim() === "") return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function governanceNow(): Date {
  const configured = process.env.MARKETING_PRODUCTION_GOVERNANCE_NOW;
  if (!configured) return new Date();
  const parsed = new Date(configured);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function campaignGovernance(campaign: Campaign): ProductionGovernanceMetadata {
  return campaign.catalogMetadata?.governance ?? {};
}

function maxRisk(a: ProductionRiskClass, b: ProductionRiskClass): ProductionRiskClass {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function riskFromRecipientCount(count: number): ProductionRiskClass {
  const lowMax = configuredInt("MARKETING_GOVERNANCE_LOW_MAX_RECIPIENTS", DEFAULT_LOW_MAX);
  const standardMax = configuredInt("MARKETING_GOVERNANCE_STANDARD_MAX_RECIPIENTS", DEFAULT_STANDARD_MAX);
  const highMax = configuredInt("MARKETING_GOVERNANCE_HIGH_MAX_RECIPIENTS", DEFAULT_HIGH_MAX);
  if (count <= lowMax) return "low";
  if (count <= standardMax) return "standard";
  if (count <= highMax) return "high";
  return "restricted";
}

function campaignInherentRisk(campaign: Campaign): ProductionRiskClass {
  const metadata = campaign.catalogMetadata;
  const lifecycle = metadata?.lifecycleStage;
  const family = metadata?.campaignFamily;
  const tags = metadata?.catalogTags ?? [];
  if (tags.includes("restricted") || tags.includes("compliance-sensitive") || tags.includes("emergency-broadcast")) return "restricted";
  if (["winback", "reactivation", "upsell", "cross_sell", "renewal"].includes(String(lifecycle ?? family ?? ""))) return "high";
  if (campaign.fallbackChannels.length > 0) return "standard";
  if (campaign.purpose === "retention") return "standard";
  return "low";
}

function classifyRisk(campaign: Campaign, recipientCount: number): { riskClass: ProductionRiskClass; riskReasons: string[] } {
  const metadata = campaignGovernance(campaign);
  let riskClass = metadata.riskClass ?? "low";
  const countRisk = riskFromRecipientCount(recipientCount);
  const inherentRisk = campaignInherentRisk(campaign);
  riskClass = maxRisk(maxRisk(riskClass, countRisk), inherentRisk);
  const riskReasons = new Set<string>(metadata.riskReasons ?? []);
  riskReasons.add("recipient_count:" + recipientCount);
  if (countRisk !== "low") riskReasons.add("recipient_count_class:" + countRisk);
  if (inherentRisk !== "low") riskReasons.add("campaign_class:" + inherentRisk);
  riskReasons.add("purpose:" + campaign.purpose);
  if (campaign.catalogMetadata?.lifecycleStage) riskReasons.add("lifecycle:" + campaign.catalogMetadata.lifecycleStage);
  return { riskClass, riskReasons: Array.from(riskReasons) };
}

export function isProductionGovernedCampaign(campaign: Campaign): boolean {
  if (process.env.MARKETING_PRODUCTION_GOVERNANCE_ENFORCEMENT === "false") return false;
  if (campaign.environment === "test" || campaign.environment === "development") return false;
  if (campaign.environment === "production") return true;
  if (process.env.NODE_ENV === "production") return true;
  return configuredBoolean("MARKETING_GOVERNANCE_TREAT_UNSCOPED_AS_PRODUCTION", true);
}

function isNonAutomationActor(actor: string | null | undefined): actor is string {
  if (!actor || actor.trim().length === 0) return false;
  return !/(^|[^a-z])(ai|codex|automation|test|bot|script)([^a-z]|$)/i.test(actor);
}

function validIso(value: string | null | undefined): value is string {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function futureIso(value: string | null | undefined, now: Date): boolean {
  return validIso(value) && new Date(value).getTime() > now.getTime();
}

function withinMaxHours(value: string | null | undefined, now: Date, maxHours: number): boolean {
  return validIso(value) && new Date(value).getTime() - now.getTime() <= maxHours * 60 * 60 * 1000;
}

function dryRunEvidenceIsCurrent(metadata: ProductionGovernanceMetadata, campaign: Campaign): boolean {
  if (!metadata.dryRunReviewedAt || (!metadata.dryRunRunId && !metadata.dryRunEvidenceRef)) return false;
  if (!validIso(metadata.dryRunReviewedAt)) return false;
  const campaignUpdatedAt = Date.parse(campaign.updatedAt);
  return !Number.isFinite(campaignUpdatedAt) || Date.parse(metadata.dryRunReviewedAt) >= campaignUpdatedAt;
}

function highRiskApproversAreValid(metadata: ProductionGovernanceMetadata): boolean {
  return Boolean(isNonAutomationActor(metadata.businessApprover) && isNonAutomationActor(metadata.governanceApprover) && metadata.businessApprover !== metadata.governanceApprover);
}

function restrictedExceptionIsValid(metadata: ProductionGovernanceMetadata, now: Date): boolean {
  return Boolean(isNonAutomationActor(metadata.restrictedExceptionApprovedBy) && metadata.restrictedExceptionReason && futureIso(metadata.restrictedExceptionExpiresAt, now) && highRiskApproversAreValid(metadata));
}

function emergencyOverrideIsValid(metadata: ProductionGovernanceMetadata, now: Date): boolean {
  const maxHours = configuredInt("MARKETING_GOVERNANCE_EMERGENCY_OVERRIDE_MAX_HOURS", DEFAULT_EMERGENCY_OVERRIDE_MAX_HOURS);
  return Boolean(isNonAutomationActor(metadata.emergencyOverrideApprovedBy) && metadata.emergencyOverrideReason && futureIso(metadata.emergencyOverrideExpiresAt, now) && withinMaxHours(metadata.emergencyOverrideExpiresAt, now, maxHours));
}

function localTimeParts(date: Date, timezone: string): { hour: number; weekday: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", hour12: false }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    if (!Number.isFinite(hour) || !weekday) return null;
    return { hour, weekday };
  } catch {
    return null;
  }
}

function quietHourReason(campaign: Campaign, now: Date): string | null {
  if (campaign.purpose === "transactional-not-marketing") return null;
  const timezone = campaign.timezone || process.env.MARKETING_GOVERNANCE_DEFAULT_TIMEZONE || null;
  if (!timezone) return "production_governance_timezone_missing";
  const parts = localTimeParts(now, timezone);
  if (!parts) return "production_governance_timezone_invalid";
  if (configuredBoolean("MARKETING_GOVERNANCE_BLOCK_WEEKENDS", true) && ["Sat", "Sun"].includes(parts.weekday)) return "production_governance_weekend_blocked";
  const start = configuredInt("MARKETING_GOVERNANCE_QUIET_START_HOUR", DEFAULT_QUIET_START_HOUR);
  const end = configuredInt("MARKETING_GOVERNANCE_QUIET_END_HOUR", DEFAULT_QUIET_END_HOUR);
  const inQuietHours = start > end ? parts.hour >= start || parts.hour < end : parts.hour >= start && parts.hour < end;
  return inQuietHours ? "production_governance_quiet_hours_blocked" : null;
}

function policyRef(campaign: Campaign, metadata: ProductionGovernanceMetadata): string {
  return metadata.riskPolicyRef ?? campaign.policyRef ?? process.env.MARKETING_GOVERNANCE_POLICY_REF ?? "docs/agents/contracts/production-governance-readiness-contract.md#conservative-defaults";
}

export function evaluateProductionGovernance(campaign: Campaign, recipients: Contact[]): ProductionGovernanceResult {
  const metadata = campaignGovernance(campaign);
  const { riskClass, riskReasons } = classifyRisk(campaign, recipients.length);
  const evidence: ProductionGovernanceEvidence = { enforced: isProductionGovernedCampaign(campaign), riskClass, riskReasons, policyRef: policyRef(campaign, metadata), quietHourPolicy: "local 21:00-08:00, weekends blocked unless emergency override" };
  if (!evidence.enforced) return { ok: true, evidence };
  const now = governanceNow();
  if (!isNonAutomationActor(campaign.approvedBy)) return { ok: false, reason: "production_governance_approval_actor_invalid", evidence };
  if (!dryRunEvidenceIsCurrent(metadata, campaign)) return { ok: false, reason: "production_governance_dry_run_evidence_missing", evidence };
  if (!metadata.readinessChecklistRef || !metadata.rollbackPlanRef) return { ok: false, reason: "production_governance_readiness_or_rollback_evidence_missing", evidence };
  if (RISK_RANK[riskClass] >= RISK_RANK.high && !highRiskApproversAreValid(metadata)) return { ok: false, reason: "production_governance_high_risk_approvers_missing", evidence };
  if (riskClass === "restricted" && !restrictedExceptionIsValid(metadata, now)) return { ok: false, reason: "production_governance_restricted_exception_missing", evidence };
  const quietReason = quietHourReason(campaign, now);
  if (quietReason && !emergencyOverrideIsValid(metadata, now)) return { ok: false, reason: quietReason, evidence };
  const approverDomainAllowlist = configuredList("MARKETING_GOVERNANCE_APPROVER_EMAIL_DOMAINS", []);
  if (approverDomainAllowlist.length > 0) {
    const approvers = [campaign.approvedBy, metadata.businessApprover, metadata.governanceApprover, metadata.restrictedExceptionApprovedBy, metadata.emergencyOverrideApprovedBy].filter(Boolean) as string[];
    const allAllowed = approvers.every((actor) => !actor.includes("@") || approverDomainAllowlist.some((domain) => actor.endsWith("@" + domain)));
    if (!allAllowed) return { ok: false, reason: "production_governance_approver_domain_not_allowed", evidence };
  }
  return { ok: true, evidence };
}
