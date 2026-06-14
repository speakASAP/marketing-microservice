export type ContactOwner = "auth" | "leads";
export type ResultSource = ContactOwner | "orders" | "catalog" | "app_signals" | "crm_accounts" | "system";
export type Channel = "email" | "telegram" | "whatsapp";
export type Purpose = "marketing" | "retention" | "transactional-not-marketing";
export type SegmentSource = "auth_users" | "leads" | "orders" | "app_signals" | "crm_accounts";
export type RegistryEnvironment = "production" | "staging" | "development" | "test";
export type RegistryStatus = "active" | "suspended" | "archived" | "test-only";
export type CampaignLifecycleStage =
  | "acquisition"
  | "activation"
  | "onboarding"
  | "education"
  | "feature_adoption"
  | "retention"
  | "reactivation"
  | "winback"
  | "renewal"
  | "upsell"
  | "cross_sell"
  | "post_purchase"
  | "abandoned_intent"
  | "operational_notice";
export type CampaignFamily =
  | "acquisition"
  | "activation"
  | "onboarding"
  | "education"
  | "feature_adoption"
  | "retention"
  | "reactivation"
  | "winback"
  | "renewal"
  | "upsell"
  | "cross_sell"
  | "post_purchase"
  | "abandoned_intent"
  | "operational_notice";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "archived";
export type CampaignApprovalStatus = "pending" | "approved" | "revoked";
export type JourneyStatus = "draft" | "active" | "paused" | "archived";
export type JourneyTriggerType = "manual" | "segment_entry" | "app_signal";
export type JourneyExitRuleType = "segment_match" | "app_signal" | "campaign_engagement" | "manual";
export type JourneySuppressionRuleType = "recently_sent" | "frequency_cap" | "unsubscribed" | "segment_match";

export interface RegistryScope {
  tenantId: string;
  appId: string;
  brandId: string;
  businessId?: string | null;
  environment?: RegistryEnvironment | null;
  defaultLocale?: string | null;
  timezone?: string | null;
  productLine?: string | null;
  lifecycleScope?: string | null;
  legalSenderIdentity?: string | null;
  policyRef?: string | null;
}

export interface Segment extends RegistryScope {
  segmentId: string;
  name: string;
  sourceTypes: SegmentSource[];
  rules: Record<string, string | number | boolean>;
  isDynamic: boolean;
  estimatedCount?: number | null;
}

export interface CampaignCatalogMetadata {
  campaignFamily?: CampaignFamily | null;
  lifecycleStage?: CampaignLifecycleStage | null;
  audienceKey?: string | null;
  audienceLabel?: string | null;
  catalogCategory?: string | null;
  catalogTags?: string[];
  sourceBlueprintId?: string | null;
}

export interface CampaignBlueprint {
  blueprintId: string;
  appId: string;
  productLine?: string | null;
  name: string;
  description: string;
  campaignFamily: CampaignFamily;
  lifecycleStage: CampaignLifecycleStage;
  audienceKey: string;
  audienceLabel: string;
  catalogCategory: string;
  catalogTags: string[];
  purpose: Purpose;
  primaryChannel: Channel;
  fallbackChannels: Channel[];
  templateRef: string;
  segment: {
    name: string;
    sourceTypes: SegmentSource[];
    rules: Record<string, string | number | boolean>;
    isDynamic: boolean;
  };
  catalogMetadata: CampaignCatalogMetadata & {
    campaignFamily: CampaignFamily;
    lifecycleStage: CampaignLifecycleStage;
    audienceKey: string;
    audienceLabel: string;
    catalogCategory: string;
    catalogTags: string[];
    sourceBlueprintId: string;
  };
}

export interface Campaign extends RegistryScope {
  campaignId: string;
  tenant: string;
  name: string;
  segmentId: string;
  description?: string | null;
  purpose: Purpose;
  primaryChannel: Channel;
  fallbackChannels: Channel[];
  channelKey?: string;
  templateRef: string;
  scheduleAt?: string;
  throttlePerMinute?: number | null;
  frequencyCapPerDay: number;
  catalogMetadata?: CampaignCatalogMetadata | null;
  message: {
    subject?: string;
    body: string;
  };
  status: CampaignStatus;
  approvalStatus: CampaignApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  schedulerLockOwner?: string | null;
  schedulerLockUntil?: string | null;
  lastScheduledRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface JourneyTrigger {
  type: JourneyTriggerType;
  segmentId?: string | null;
  rules?: Record<string, string | number | boolean> | null;
}

export interface JourneyStep {
  stepId: string;
  name: string;
  campaignId: string;
  delayMinutes: number;
  conditions?: Record<string, string | number | boolean> | null;
  maxExecutionsPerRecipient?: number | null;
}

export interface JourneyExitRule {
  ruleId: string;
  type: JourneyExitRuleType;
  segmentId?: string | null;
  campaignId?: string | null;
  rules?: Record<string, string | number | boolean> | null;
}

export interface JourneySuppressionRule {
  ruleId: string;
  type: JourneySuppressionRuleType;
  segmentId?: string | null;
  campaignId?: string | null;
  windowMinutes?: number | null;
  rules?: Record<string, string | number | boolean> | null;
}

export interface Journey extends RegistryScope {
  journeyId: string;
  name: string;
  description?: string | null;
  trigger: JourneyTrigger;
  steps: JourneyStep[];
  exitRules: JourneyExitRule[];
  suppressionRules: JourneySuppressionRule[];
  status: JourneyStatus;
  approvalStatus: CampaignApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  activatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  owner: ContactOwner;
  email?: string;
  phone?: string;
  preferredChannel: Channel;
  fallbackChannels: Channel[];
  identityLinks?: {
    authUserId?: string;
    leadId?: string;
  };
  consent: {
    marketing: boolean;
    unsubscribed: boolean;
    channels?: Partial<Record<Channel, boolean>>;
  };
}

export interface DeliveryResult {
  deliveryId: string;
  campaignId: string;
  recipientRef: string;
  recipientSource: ResultSource;
  recipientAddress: string;
  requestedChannel: Channel;
  effectiveChannel: Channel;
  status: "queued" | "skipped" | "sent" | "failed" | "would_send";
  decisionReason: string;
  processedAt: string;
  duration_ms: number;
  correlationId?: string;
}

export interface JourneyRuleEvidenceRef {
  ruleId: string;
  type: JourneyExitRuleType | JourneySuppressionRuleType;
  segmentId?: string | null;
  campaignId?: string | null;
  windowMinutes?: number | null;
}

export interface JourneyStepDecisionEvidence {
  decision: "execute_campaign_step";
  reason: "step_due";
  evaluatedAt: string;
  journeyStatus: JourneyStatus;
  journeyApprovalStatus: CampaignApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  dueAt: string;
  delayMinutes: number;
  campaignId: string;
  idempotencyKey: string;
  conditionKeys: string[];
  maxExecutionsPerRecipient: number | null;
  exitRuleRefs: JourneyRuleEvidenceRef[];
  suppressionRuleRefs: JourneyRuleEvidenceRef[];
}

export interface JourneyStepClaim {
  id: string;
  journeyId: string;
  stepId: string;
  campaignId: string;
  dueAt: string;
  schedulerOwner: string;
  schedulerLockUntil: string;
  status: "claimed" | "completed" | "failed";
  runId?: string | null;
  error?: string | null;
  claimedAt: string;
  completedAt?: string | null;
  decisionEvidence: JourneyStepDecisionEvidence;
  journey: Journey;
  step: JourneyStep;
}

export interface ExecutionRun {
  id: string;
  campaignId: string;
  idempotencyKey: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "dry_run_completed";
  dryRun?: boolean;
  schedulerOwner?: string | null;
  approvalEvidence?: {
    approvalStatus: CampaignApprovalStatus;
    approvedBy?: string | null;
    approvedAt?: string | null;
  } | null;
  totalRecipients: number;
  totalSent: number;
  results: DeliveryResult[];
}
