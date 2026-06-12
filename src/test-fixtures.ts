import { Contact } from "./types";

export const testRecipientFixtures: Contact[] = [
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
