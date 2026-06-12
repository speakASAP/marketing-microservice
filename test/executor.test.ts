import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { executeCampaign } from "../src/executor";
import { setTestRecipientFixtureProviderForTest } from "../src/sources";
import { campaigns, resetInMemoryState, segments } from "../src/store";
import { testRecipientFixtures as contacts } from "./fixtures";
import { Campaign, Segment } from "../src/types";

process.env.NODE_ENV = "test";
process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = "true";
setTestRecipientFixtureProviderForTest(() => contacts);

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

test("rejects test fixture provider registration outside test environment", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    assert.throws(
      () => setTestRecipientFixtureProviderForTest(() => contacts),
      /test_recipient_fixture_provider_is_test_only/
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv ?? "test";
    setTestRecipientFixtureProviderForTest(() => contacts);
  }
});

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

test("resolves auth user recipients from auth service when configured", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalAuthToken = process.env.AUTH_SERVICE_TOKEN;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.AUTH_SERVICE_TOKEN = "auth-token";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  const getCalls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const sentRecipients: string[] = [];
  (axios.get as unknown as typeof originalGet) = (async (url: string, config?: unknown) => {
    getCalls.push({
      url,
      headers: (config as { headers?: Record<string, string> } | undefined)?.headers
    });
    return {
      status: 200,
      data: {
        users: [
          {
            id: "auth-api-1",
            email: "auth-api-1@example.com",
            preferredChannel: "telegram",
            fallbackChannels: ["email"],
            marketingConsents: { marketing: true }
          },
          {
            id: "auth-api-2",
            email: "auth-api-2@example.com",
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsents: { marketing: false }
          }
        ]
      }
    } as never;
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    sentRecipients.push((payload as { recipient: string }).recipient);
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-auth-source");
    assert.equal(getCalls.length, 1);
    assert.equal(getCalls[0].headers?.Authorization, "Bearer auth-token");
    assert.ok(getCalls[0].url.startsWith("http://auth-microservice:3370/auth/admin/users?"));
    assert.ok(getCalls[0].url.includes("owner=auth"));
    assert.deepEqual(sentRecipients, ["auth-api-1@example.com"]);
    assert.equal(run.totalRecipients, 2);
    assert.equal(run.totalSent, 1);
    assert.ok(run.results.some((r) => r.recipientRef === "auth:auth-api-2" && r.decisionReason === "consent_missing"));
    assert.ok(!run.results.some((r) => r.recipientAddress === "user1@example.com"));
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = originalAuthUrl;
    }
    if (originalAuthToken === undefined) {
      delete process.env.AUTH_SERVICE_TOKEN;
    } else {
      process.env.AUTH_SERVICE_TOKEN = originalAuthToken;
    }
    resetInMemoryState();
  }
});

test("does not use in-memory fixtures when the test fixture gate is disabled", async () => {
  resetInMemoryState();
  const originalFixtureGate = process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES;
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalPost = axios.post;
  delete process.env.AUTH_SERVICE_URL;
  process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = "false";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-fixture-gate-disabled");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "auth:source");
    assert.equal(run.results[0].decisionReason, "auth_source_unavailable:auth_service_url_missing");
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = originalFixtureGate ?? "true";
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = originalAuthUrl;
    }
    resetInMemoryState();
  }
});

test("fails auth source safely without notification delivery", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.get as unknown as typeof originalGet) = (async () => {
    throw new Error("auth unavailable");
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-auth-failure");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "auth:source");
    assert.match(run.results[0].decisionReason, /^auth_source_unavailable:/);
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = originalAuthUrl;
    }
    resetInMemoryState();
  }
});

test("resolves lead recipients from leads service when configured", async () => {
  resetInMemoryState();
  const originalLeadsUrl = process.env.LEADS_SERVICE_URL;
  const originalLeadsToken = process.env.LEADS_SERVICE_TOKEN;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.LEADS_SERVICE_URL = "http://leads-microservice:4400";
  process.env.LEADS_SERVICE_TOKEN = "leads-token";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  const getCalls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const sentRecipients: string[] = [];
  (axios.get as unknown as typeof originalGet) = (async (url: string, config?: unknown) => {
    getCalls.push({
      url,
      headers: (config as { headers?: Record<string, string> } | undefined)?.headers
    });
    return {
      status: 200,
      data: {
        items: [
          {
            id: "lead-api-1",
            contactMethods: [
              { type: "email", value: "lead-api-1@example.com", isPrimary: true },
              { type: "whatsapp", value: "+420111111111", isPrimary: false }
            ],
            preferredChannel: "email",
            fallbackChannels: ["whatsapp"],
            marketingConsent: true
          },
          {
            id: "lead-api-2",
            contactMethods: [{ type: "email", value: "lead-api-2@example.com", isPrimary: true }],
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsent: false
          },
          {
            id: "lead-api-3",
            contactMethods: [{ type: "email", value: "lead-api-3@example.com", isPrimary: true }],
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsent: true,
            unsubscribedAt: "2026-06-12T10:00:00.000Z"
          }
        ]
      }
    } as never;
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    sentRecipients.push((payload as { recipient: string }).recipient);
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["leads"],
        rules: { sourceService: "flipflop-service" }
      })
    );
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-leads-source");
    assert.equal(getCalls.length, 1);
    assert.equal(getCalls[0].headers?.Authorization, "Bearer leads-token");
    assert.ok(getCalls[0].url.startsWith("http://leads-microservice:4400/leads?"));
    assert.ok(getCalls[0].url.includes("sourceService=flipflop-service"));
    assert.deepEqual(sentRecipients, ["lead-api-1@example.com"]);
    assert.equal(run.totalRecipients, 3);
    assert.equal(run.totalSent, 1);
    assert.ok(run.results.some((r) => r.recipientRef === "lead:lead-api-2" && r.decisionReason === "consent_missing"));
    assert.ok(run.results.some((r) => r.recipientRef === "lead:lead-api-3" && r.decisionReason === "unsubscribed"));
    assert.ok(!run.results.some((r) => r.recipientAddress === "lead1@example.com"));
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalLeadsUrl === undefined) {
      delete process.env.LEADS_SERVICE_URL;
    } else {
      process.env.LEADS_SERVICE_URL = originalLeadsUrl;
    }
    if (originalLeadsToken === undefined) {
      delete process.env.LEADS_SERVICE_TOKEN;
    } else {
      process.env.LEADS_SERVICE_TOKEN = originalLeadsToken;
    }
    resetInMemoryState();
  }
});

test("fails leads source safely without notification delivery", async () => {
  resetInMemoryState();
  const originalLeadsUrl = process.env.LEADS_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.LEADS_SERVICE_URL = "http://leads-microservice:4400";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.get as unknown as typeof originalGet) = (async () => {
    throw new Error("leads unavailable");
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["leads"],
        rules: { sourceService: "statex" }
      })
    );
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-leads-failure");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "leads:source");
    assert.match(run.results[0].decisionReason, /^leads_source_unavailable:/);
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalLeadsUrl === undefined) {
      delete process.env.LEADS_SERVICE_URL;
    } else {
      process.env.LEADS_SERVICE_URL = originalLeadsUrl;
    }
    resetInMemoryState();
  }
});

test("filters auth recipients through configured order and catalog signals", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalOrdersUrl = process.env.ORDERS_SERVICE_URL;
  const originalOrdersToken = process.env.ORDERS_SERVICE_TOKEN;
  const originalCatalogUrl = process.env.CATALOG_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.ORDERS_SERVICE_URL = "http://orders-microservice:3203";
  process.env.ORDERS_SERVICE_TOKEN = "orders-token";
  process.env.CATALOG_SERVICE_URL = "http://catalog-microservice:3200";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  const getCalls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const sentRecipients: string[] = [];
  (axios.get as unknown as typeof originalGet) = (async (url: string, config?: unknown) => {
    getCalls.push({
      url,
      headers: (config as { headers?: Record<string, string> } | undefined)?.headers
    });

    if (url.startsWith("http://catalog-microservice:3200/api/products/sku/FF-SKU-1")) {
      return {
        status: 200,
        data: { success: true, data: { id: "catalog-product-1", sku: "FF-SKU-1" } }
      } as never;
    }

    if (url.startsWith("http://orders-microservice:3203/api/orders?")) {
      return {
        status: 200,
        data: {
          success: true,
          data: [
            {
              id: "order-1",
              status: "delivered",
              channel: "flipflop",
              customer: { email: "buyer@example.com" },
              items: [{ productId: "catalog-product-1", sku: "FF-SKU-1" }]
            },
            {
              id: "order-2",
              status: "delivered",
              channel: "flipflop",
              customer: { email: "other@example.com" },
              items: [{ productId: "catalog-product-2", sku: "FF-SKU-2" }]
            }
          ]
        }
      } as never;
    }

    if (url.startsWith("http://auth-microservice:3370/auth/admin/users?")) {
      return {
        status: 200,
        data: {
          users: [
            {
              id: "auth-buyer",
              email: "buyer@example.com",
              preferredChannel: "email",
              fallbackChannels: [],
              marketingConsents: { marketing: true }
            },
            {
              id: "auth-other",
              email: "other@example.com",
              preferredChannel: "email",
              fallbackChannels: [],
              marketingConsents: { marketing: true }
            }
          ]
        }
      } as never;
    }

    throw new Error(`unexpected get ${url}`);
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    sentRecipients.push((payload as { recipient: string }).recipient);
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["orders", "auth_users"],
        rules: {
          orderStatus: "delivered",
          orderChannel: "flipflop",
          catalogSku: "FF-SKU-1"
        }
      })
    );
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-order-catalog-source");
    assert.ok(getCalls.some((call) => call.url === "http://catalog-microservice:3200/api/products/sku/FF-SKU-1"));
    const orderCall = getCalls.find((call) => call.url.startsWith("http://orders-microservice:3203/api/orders?"));
    assert.ok(orderCall);
    assert.equal(orderCall.headers?.Authorization, "Bearer orders-token");
    assert.ok(orderCall.url.includes("status=delivered"));
    assert.ok(orderCall.url.includes("channel=flipflop"));
    assert.deepEqual(sentRecipients, ["buyer@example.com"]);
    assert.equal(run.totalRecipients, 1);
    assert.equal(run.totalSent, 1);
    assert.ok(!run.results.some((r) => r.recipientAddress === "other@example.com"));
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = originalAuthUrl;
    }
    if (originalOrdersUrl === undefined) {
      delete process.env.ORDERS_SERVICE_URL;
    } else {
      process.env.ORDERS_SERVICE_URL = originalOrdersUrl;
    }
    if (originalOrdersToken === undefined) {
      delete process.env.ORDERS_SERVICE_TOKEN;
    } else {
      process.env.ORDERS_SERVICE_TOKEN = originalOrdersToken;
    }
    if (originalCatalogUrl === undefined) {
      delete process.env.CATALOG_SERVICE_URL;
    } else {
      process.env.CATALOG_SERVICE_URL = originalCatalogUrl;
    }
    resetInMemoryState();
  }
});

test("fails orders signal safely without notification delivery", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalOrdersUrl = process.env.ORDERS_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.ORDERS_SERVICE_URL = "http://orders-microservice:3203";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.get as unknown as typeof originalGet) = (async (url: string) => {
    if (url.startsWith("http://orders-microservice:3203/api/orders")) {
      throw new Error("orders unavailable");
    }
    throw new Error(`unexpected get ${url}`);
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["orders", "auth_users"],
        rules: { orderStatus: "delivered" }
      })
    );
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-orders-failure");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "orders:source");
    assert.match(run.results[0].decisionReason, /^orders_source_unavailable:/);
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = originalAuthUrl;
    }
    if (originalOrdersUrl === undefined) {
      delete process.env.ORDERS_SERVICE_URL;
    } else {
      process.env.ORDERS_SERVICE_URL = originalOrdersUrl;
    }
    resetInMemoryState();
  }
});

test("fails catalog signal safely without notification delivery", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalOrdersUrl = process.env.ORDERS_SERVICE_URL;
  const originalCatalogUrl = process.env.CATALOG_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.ORDERS_SERVICE_URL = "http://orders-microservice:3203";
  process.env.CATALOG_SERVICE_URL = "http://catalog-microservice:3200";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.get as unknown as typeof originalGet) = (async (url: string) => {
    if (url.startsWith("http://catalog-microservice:3200/api/products/sku/")) {
      throw new Error("catalog unavailable");
    }
    throw new Error(`unexpected get ${url}`);
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["orders", "auth_users"],
        rules: { catalogSku: "FF-SKU-1" }
      })
    );
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-catalog-failure");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "catalog:source");
    assert.match(run.results[0].decisionReason, /^catalog_source_unavailable:/);
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) {
      delete process.env.AUTH_SERVICE_URL;
    } else {
      process.env.AUTH_SERVICE_URL = originalAuthUrl;
    }
    if (originalOrdersUrl === undefined) {
      delete process.env.ORDERS_SERVICE_URL;
    } else {
      process.env.ORDERS_SERVICE_URL = originalOrdersUrl;
    }
    if (originalCatalogUrl === undefined) {
      delete process.env.CATALOG_SERVICE_URL;
    } else {
      process.env.CATALOG_SERVICE_URL = originalCatalogUrl;
    }
    resetInMemoryState();
  }
});
