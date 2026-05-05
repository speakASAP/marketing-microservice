import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { executeCampaign } from "../src/executor";
import { campaigns, contacts, resetInMemoryState, segments } from "../src/store";
import { Campaign, Segment } from "../src/types";

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    segmentId: "seg-1",
    name: "segment",
    sourceTypes: ["auth_users"],
    rules: { owner: "auth" },
    isDynamic: true,
    estimatedCount: null,
    ...overrides
  };
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    campaignId: "camp-1",
    tenant: "statex",
    name: "campaign",
    segmentId: "seg-1",
    description: null,
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: [],
    templateRef: "welcome_template",
    scheduleAt: undefined,
    throttlePerMinute: null,
    frequencyCapPerDay: 1,
    message: { body: "hello" },
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

test("enforces consent, unsubscribe and frequency cap", async () => {
  resetInMemoryState();
  const originalContacts = contacts.slice();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const firstRun = await executeCampaign("camp-1", "idem-1");
    assert.equal(firstRun.totalRecipients, 2);
    assert.equal(firstRun.totalSent, 1);
    assert.ok(firstRun.results.some((r) => r.decisionReason === "unsubscribed"));
    assert.equal(postCalls, 1);

    const secondRun = await executeCampaign("camp-1", "idem-2");
    assert.equal(secondRun.totalSent, 0);
    assert.ok(secondRun.results.some((r) => r.decisionReason === "frequency_cap"));
    assert.ok(secondRun.results.some((r) => r.decisionReason === "unsubscribed"));
    assert.equal(postCalls, 1);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    contacts.splice(0, contacts.length, ...originalContacts);
    resetInMemoryState();
  }
});

test("returns same run for identical idempotency key", async () => {
  resetInMemoryState();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  (axios.post as unknown as typeof originalPost) = (async () => {
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const runA = await executeCampaign("camp-1", "idem-same");
    const runB = await executeCampaign("camp-1", "idem-same");
    assert.equal(runA.id, runB.id);
    assert.deepEqual(runA.results, runB.results);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    resetInMemoryState();
  }
});

test("chunks recipients to <=30 per notifications call", async () => {
  resetInMemoryState();
  const originalContacts = contacts.slice();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  const perRequestRecipients: string[] = [];
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    const typed = payload as { recipient: string };
    perRequestRecipients.push(typed.recipient);
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    for (let i = 0; i < 65; i += 1) {
      contacts.push({
        id: `auth-extra-${i}`,
        owner: "auth",
        email: `extra-${i}@example.com`,
        preferredChannel: "email",
        fallbackChannels: [],
        consent: { marketing: true, unsubscribed: false }
      });
    }

    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["auth_users", "leads"],
        rules: {}
      })
    );
    campaigns.set("camp-1", makeCampaign());

    await executeCampaign("camp-1", "idem-chunks");
    assert.equal(perRequestRecipients.length, 66);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    contacts.splice(0, contacts.length, ...originalContacts);
    resetInMemoryState();
  }
});

test("uses fallback channel when campaign primary is in fallback list", async () => {
  resetInMemoryState();
  const originalContacts = contacts.slice();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  const channels: string[] = [];
  const recipients: string[] = [];
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    const typed = payload as { channel: string; recipient: string };
    channels.push(typed.channel);
    recipients.push(typed.recipient);
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    contacts.splice(0, contacts.length, {
      id: "lead-fallback",
      owner: "leads",
      email: "lead-fallback@example.com",
      preferredChannel: "email",
      fallbackChannels: ["whatsapp"],
      consent: { marketing: true, unsubscribed: false }
    });
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["leads"],
        rules: { owner: "leads" }
      })
    );
    campaigns.set(
      "camp-1",
      makeCampaign({
        primaryChannel: "whatsapp",
        fallbackChannels: ["email"]
      })
    );

    const run = await executeCampaign("camp-1", "idem-fallback");
    assert.equal(run.totalSent, 1);
    assert.deepEqual(channels, ["whatsapp"]);
    assert.deepEqual(recipients, ["lead-fallback@example.com"]);
    assert.equal(run.results[0].effectiveChannel, "whatsapp");
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    contacts.splice(0, contacts.length, ...originalContacts);
    resetInMemoryState();
  }
});

test("applies campaign-level max send guardrail", async () => {
  resetInMemoryState();
  const originalContacts = contacts.slice();
  const originalMax = process.env.CAMPAIGN_MAX_SEND_PER_RUN;
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  process.env.CAMPAIGN_MAX_SEND_PER_RUN = "2";
  const originalPost = axios.post;
  let sentCount = 0;
  const sentRecipients: string[] = [];
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    const typed = payload as { recipient: string; type: string; message: string; channel: string };
    sentCount += 1;
    sentRecipients.push(typed.recipient);
    assert.equal(typed.type, "custom");
    assert.equal(typeof typed.message, "string");
    assert.equal(typed.channel, "email");
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    contacts.splice(
      0,
      contacts.length,
      {
        id: "auth-1",
        owner: "auth",
        email: "user1@example.com",
        preferredChannel: "email",
        fallbackChannels: [],
        consent: { marketing: true, unsubscribed: false }
      },
      {
        id: "auth-2",
        owner: "auth",
        email: "user2@example.com",
        preferredChannel: "email",
        fallbackChannels: [],
        consent: { marketing: true, unsubscribed: false }
      },
      {
        id: "auth-3",
        owner: "auth",
        email: "user3@example.com",
        preferredChannel: "email",
        fallbackChannels: [],
        consent: { marketing: true, unsubscribed: false }
      }
    );
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-guardrail");
    assert.equal(sentCount, 2);
    assert.deepEqual(sentRecipients, ["user1@example.com", "user2@example.com"]);
    assert.equal(run.totalSent, 2);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalMax === undefined) {
      delete process.env.CAMPAIGN_MAX_SEND_PER_RUN;
    } else {
      process.env.CAMPAIGN_MAX_SEND_PER_RUN = originalMax;
    }
    contacts.splice(0, contacts.length, ...originalContacts);
    resetInMemoryState();
  }
});

test("sends notifications using per-contact DTO contract", async () => {
  resetInMemoryState();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  process.env.NOTIFICATION_SERVICE_TOKEN = "svc-token";
  const originalPost = axios.post;
  const calls: Array<{
    payload: Record<string, unknown>;
    headers: Record<string, string> | undefined;
  }> = [];
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown, config?: unknown) => {
    calls.push({
      payload: payload as Record<string, unknown>,
      headers: (config as { headers?: Record<string, string> } | undefined)?.headers
    });
    return { status: 200, data: { success: true, status: "sent" } } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set(
      "camp-1",
      makeCampaign({
        channelKey: "flipflop_email_promotions",
        message: { body: "contract-check", subject: "Contract subject" }
      })
    );

    await executeCampaign("camp-1", "idem-contract-shape");
    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.equal(call.payload.recipient, "user1@example.com");
    assert.equal(call.payload.message, "contract-check");
    assert.equal(call.payload.type, "custom");
    assert.equal(call.payload.subject, "Contract subject");
    assert.equal(call.payload.channel, "email");
    assert.equal(call.payload.purpose, "marketing");
    assert.equal(call.payload.service, "marketing-microservice");
    assert.equal(call.payload.channelKey, "flipflop_email_promotions");
    assert.equal(call.headers?.Authorization, "Bearer svc-token");
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    delete process.env.NOTIFICATION_SERVICE_TOKEN;
    resetInMemoryState();
  }
});
