export type ContactOwner = "auth" | "leads";
export type ResultSource = ContactOwner | "orders" | "catalog" | "app_signals" | "system";
export type Channel = "email" | "telegram" | "whatsapp";
export type Purpose = "marketing" | "retention" | "transactional-not-marketing";
export type SegmentSource = "auth_users" | "leads" | "orders" | "app_signals";
export type RegistryEnvironment = "production" | "staging" | "development" | "test";
export type RegistryStatus = "active" | "suspended" | "archived" | "test-only";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "archived";
export type CampaignApprovalStatus = "pending" | "approved" | "revoked";

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
