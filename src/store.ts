import { Campaign, Contact, ExecutionRun, Segment } from "./types";

export const segments = new Map<string, Segment>();
export const campaigns = new Map<string, Campaign>();
export const runs = new Map<string, ExecutionRun>();

// Stub source; replace with auth/leads API integration in next phase.
export const contacts: Contact[] = [
  {
    id: "auth-1",
    owner: "auth",
    email: "user1@example.com",
    preferredChannel: "email",
    fallbackChannels: ["telegram"],
    consent: { marketing: true, unsubscribed: false }
  },
  {
    id: "lead-1",
    owner: "leads",
    email: "lead1@example.com",
    preferredChannel: "email",
    fallbackChannels: ["whatsapp"],
    consent: { marketing: false, unsubscribed: false }
  },
  {
    id: "auth-2",
    owner: "auth",
    email: "user2@example.com",
    preferredChannel: "email",
    fallbackChannels: [],
    consent: { marketing: true, unsubscribed: true }
  }
];

export const sendHistory = new Map<string, string[]>();

export function resetInMemoryState(): void {
  segments.clear();
  campaigns.clear();
  runs.clear();
  sendHistory.clear();
}
