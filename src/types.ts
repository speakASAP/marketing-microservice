export type ContactOwner = "auth" | "leads";
export type Channel = "email" | "telegram" | "whatsapp";
export type Purpose = "marketing" | "retention" | "transactional-not-marketing";
export type SegmentSource = "auth_users" | "leads" | "orders";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "archived";

export interface Segment {
  segmentId: string;
  name: string;
  sourceTypes: SegmentSource[];
  rules: Record<string, string | number | boolean>;
  isDynamic: boolean;
  estimatedCount?: number | null;
}

export interface Campaign {
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
  consent: {
    marketing: boolean;
    unsubscribed: boolean;
  };
}

export interface DeliveryResult {
  deliveryId: string;
  campaignId: string;
  recipientRef: string;
  recipientSource: ContactOwner;
  recipientAddress: string;
  requestedChannel: Channel;
  effectiveChannel: Channel;
  status: "queued" | "skipped" | "sent" | "failed";
  decisionReason: string;
  processedAt: string;
  duration_ms: number;
}

export interface ExecutionRun {
  id: string;
  campaignId: string;
  idempotencyKey: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed";
  totalRecipients: number;
  totalSent: number;
  results: DeliveryResult[];
}
