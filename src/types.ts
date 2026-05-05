export type ContactOwner = "auth" | "lead";
export type Channel = "email" | "telegram" | "whatsapp";
export type Purpose = "marketing" | "retention" | "transactional";

export interface Segment {
  id: string;
  name: string;
  ownerApp: string;
  filters: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  segmentId: string;
  ownerApp: string;
  purpose: Purpose;
  primaryChannel: Channel;
  fallbackChannels: Channel[];
  channelKey?: string;
  scheduleAt?: string;
  frequencyCapPerDay: number;
  message: {
    subject?: string;
    body: string;
  };
  status: "draft" | "active" | "archived";
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
  recipientId: string;
  status: "sent" | "skipped" | "failed";
  reason: string;
  timestamp: string;
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
