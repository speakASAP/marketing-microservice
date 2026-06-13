import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { executeCampaign, setThrottleWaitForTest } from "../src/executor";
import { logDecision, setAuditSinkForTest } from "../src/logger";
import { runDueScheduledCampaigns } from "../src/scheduler";
import { setRegistryFixtureProviderForTest } from "../src/registry";
import { setTestRecipientFixtureProviderForTest } from "../src/sources";
import { campaigns, resetInMemoryState, segments } from "../src/store";
import { testRecipientFixtures as contacts } from "./fixtures";
import { Campaign, Segment } from "../src/types";

process.env.NODE_ENV = "test";
process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = "true";
process.env.MARKETING_USE_TEST_REGISTRY_FIXTURES = "true";
setTestRecipientFixtureProviderForTest(() => contacts);
setRegistryFixtureProviderForTest((scope) => scope.tenantId === "statex" && scope.appId === "flipflop" && scope.brandId === "statex-main" ? { ...scope, status: "active" } : undefined);

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    segmentId: "seg-1",
    tenantId: "statex",
    appId: "flipflop",
    brandId: "statex-main",
    businessId: null,
    environment: "test",
    defaultLocale: "en",
    timezone: "Europe/Prague",
    productLine: null,
    lifecycleScope: null,
    legalSenderIdentity: null,
    policyRef: null,
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
    tenantId: "statex",
    appId: "flipflop",
    brandId: "statex-main",
    businessId: null,
    environment: "test",
    defaultLocale: "en",
    timezone: "Europe/Prague",
    productLine: null,
    lifecycleScope: null,
    legalSenderIdentity: null,
    policyRef: null,
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
    status: "scheduled",
    approvalStatus: "approved",
    approvedBy: "owner@example.com",
    approvedAt: new Date().toISOString(),
    approvalNote: null,
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

test("audit logger sanitizes sensitive fields and adds duration", async () => {
  const captured: Array<Record<string, unknown>> = [];
  setAuditSinkForTest((payload) => {
    captured.push(payload);
  });

  try {
    logDecision("audit_sanitization_test", {
      campaignId: "camp-1",
      message: "do not log",
      token: "secret-token",
      nested: { authorization: "bearer-secret", safe: "ok" }
    });

    assert.equal(captured.length, 1);
    assert.equal(captured[0].event, "audit_sanitization_test");
    assert.equal(typeof captured[0].timestamp, "string");
    assert.equal(captured[0].duration_ms, 0);
    assert.equal(captured[0].message, "[redacted]");
    assert.equal(captured[0].token, "[redacted]");
    assert.deepEqual(captured[0].nested, { authorization: "[redacted]", safe: "ok" });
  } finally {
    setAuditSinkForTest(null);
  }
});

test("audit logger forwards sanitized payload to logging service when configured", async () => {
  const originalLoggingUrl = process.env.LOGGING_SERVICE_URL;
  const originalLoggingToken = process.env.LOGGING_SERVICE_TOKEN;
  const originalPost = axios.post;
  const calls: Array<{ url: string; payload: Record<string, unknown>; headers?: Record<string, string> }> = [];
  process.env.LOGGING_SERVICE_URL = "http://logging-microservice:3367";
  process.env.LOGGING_SERVICE_TOKEN = "log-token";
  (axios.post as unknown as typeof originalPost) = (async (url: string, payload: unknown, config?: unknown) => {
    calls.push({
      url,
      payload: payload as Record<string, unknown>,
      headers: (config as { headers?: Record<string, string> } | undefined)?.headers
    });
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    logDecision("audit_forward_test", { campaignId: "camp-1", secret: "hidden", duration_ms: 7 });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://logging-microservice:3367/logs");
    assert.equal(calls[0].payload.event, "audit_forward_test");
    assert.equal(calls[0].payload.secret, "[redacted]");
    assert.equal(calls[0].payload.duration_ms, 7);
    assert.equal(calls[0].headers?.Authorization, "Bearer log-token");
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalLoggingUrl === undefined) {
      delete process.env.LOGGING_SERVICE_URL;
    } else {
      process.env.LOGGING_SERVICE_URL = originalLoggingUrl;
    }
    if (originalLoggingToken === undefined) {
      delete process.env.LOGGING_SERVICE_TOKEN;
    } else {
      process.env.LOGGING_SERVICE_TOKEN = originalLoggingToken;
    }
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
    assert.equal(firstRun.approvalEvidence?.approvedBy, "owner@example.com");
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


test("blocks real execution for unapproved campaigns", async () => {
  resetInMemoryState();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set(
      "camp-1",
      makeCampaign({
        status: "draft",
        approvalStatus: "pending",
        approvedBy: null,
        approvedAt: null
      })
    );

    await assert.rejects(() => executeCampaign("camp-1", "idem-unapproved"), /campaign_not_approved/);
    assert.equal(postCalls, 0);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    resetInMemoryState();
  }
});

test("blocks real execution for draft campaigns even when approval metadata exists", async () => {
  resetInMemoryState();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign({ status: "draft" }));

    await assert.rejects(() => executeCampaign("camp-1", "idem-draft"), /campaign_status_not_executable:draft/);
    assert.equal(postCalls, 0);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    resetInMemoryState();
  }
});

test("dry run resolves recipient decisions without notification delivery or approval", async () => {
  resetInMemoryState();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set(
      "camp-1",
      makeCampaign({
        status: "draft",
        approvalStatus: "pending",
        approvedBy: null,
        approvedAt: null
      })
    );

    const run = await executeCampaign("camp-1", "idem-dry", { dryRun: true });
    assert.equal(run.status, "dry_run_completed");
    assert.equal(run.dryRun, true);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.ok(run.results.some((r) => r.status === "would_send" && r.decisionReason === "dry_run_would_send"));
    assert.ok(run.results.some((r) => r.status === "skipped" && r.decisionReason === "unsubscribed"));

    const realRun = await executeCampaign("camp-1", "idem-after-dry", { dryRun: true });
    assert.equal(realRun.results.filter((r) => r.status === "would_send").length, 1);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    resetInMemoryState();
  }
});

test("scheduler claim prevents duplicate due scheduled execution", async () => {
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
    contacts.splice(0, contacts.length, {
      id: "auth-scheduled",
      owner: "auth",
      email: "scheduled@example.com",
      preferredChannel: "email",
      fallbackChannels: [],
      consent: { marketing: true, unsubscribed: false }
    });
    const scheduleAt = "2026-06-13T08:00:00.000Z";
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign({ scheduleAt }));

    const first = await runDueScheduledCampaigns({
      schedulerOwner: "scheduler-a",
      now: new Date("2026-06-13T08:01:00.000Z"),
      batchSize: 5
    });
    const second = await runDueScheduledCampaigns({
      schedulerOwner: "scheduler-b",
      now: new Date("2026-06-13T08:01:00.000Z"),
      batchSize: 5
    });

    assert.equal(first.claimed, 1);
    assert.equal(first.executed, 1);
    assert.equal(second.claimed, 0);
    assert.equal(second.executed, 0);
    assert.equal(postCalls, 1);
    assert.equal(first.runs[0].idempotencyKey, "scheduled:camp-1:2026-06-13T08:00:00.000Z");
    assert.equal(campaigns.get("camp-1")?.status, "completed");
    assert.equal(campaigns.get("camp-1")?.lastScheduledRunAt, scheduleAt);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    contacts.splice(0, contacts.length, ...originalContacts);
    resetInMemoryState();
  }
});

test("scheduler does not execute paused campaigns", async () => {
  resetInMemoryState();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set(
      "camp-1",
      makeCampaign({
        status: "paused",
        scheduleAt: "2026-06-13T08:00:00.000Z"
      })
    );

    const result = await runDueScheduledCampaigns({
      schedulerOwner: "scheduler-a",
      now: new Date("2026-06-13T08:01:00.000Z")
    });

    assert.equal(result.claimed, 0);
    assert.equal(result.executed, 0);
    assert.equal(postCalls, 0);
    assert.equal(campaigns.get("camp-1")?.status, "paused");
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    resetInMemoryState();
  }
});

test("applies campaign throttle between notification sends", async () => {
  resetInMemoryState();
  const originalContacts = contacts.slice();
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  const originalPost = axios.post;
  const waits: number[] = [];
  let postCalls = 0;
  setThrottleWaitForTest(async (ms) => {
    waits.push(ms);
  });
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    contacts.splice(
      0,
      contacts.length,
      {
        id: "auth-throttle-1",
        owner: "auth",
        email: "throttle-1@example.com",
        preferredChannel: "email",
        fallbackChannels: [],
        consent: { marketing: true, unsubscribed: false }
      },
      {
        id: "auth-throttle-2",
        owner: "auth",
        email: "throttle-2@example.com",
        preferredChannel: "email",
        fallbackChannels: [],
        consent: { marketing: true, unsubscribed: false }
      }
    );
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign({ throttlePerMinute: 120, frequencyCapPerDay: 10 }));

    const run = await executeCampaign("camp-1", "idem-throttle");

    assert.equal(run.totalSent, 2);
    assert.equal(postCalls, 2);
    assert.deepEqual(waits, [500]);
  } finally {
    setThrottleWaitForTest(async (ms) => new Promise((resolve) => setTimeout(resolve, ms)));
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

test("fails clearly when campaign-level max send guardrail is exceeded", async () => {
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
    assert.equal(sentCount, 0);
    assert.deepEqual(sentRecipients, []);
    assert.equal(run.status, "failed");
    assert.equal(run.totalSent, 0);
    assert.ok(run.results.some((r) => r.status === "failed" && r.decisionReason === "max_send_per_run_exceeded:3>2"));
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

test("fails clearly when configured notification chunk size exceeds platform max", async () => {
  resetInMemoryState();
  const originalChunkSize = process.env.CAMPAIGN_NOTIFICATION_CHUNK_SIZE;
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";
  process.env.CAMPAIGN_NOTIFICATION_CHUNK_SIZE = "31";
  const originalPost = axios.post;
  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-chunk-guardrail");
    assert.equal(postCalls, 0);
    assert.equal(run.status, "failed");
    assert.ok(
      run.results.some(
        (r) => r.status === "failed" && r.decisionReason === "notification_chunk_size_exceeds_platform_limit:31>30"
      )
    );
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalChunkSize === undefined) {
      delete process.env.CAMPAIGN_NOTIFICATION_CHUNK_SIZE;
    } else {
      process.env.CAMPAIGN_NOTIFICATION_CHUNK_SIZE = originalChunkSize;
    }
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
    assert.match(String(call.headers?.["x-correlation-id"]), /^marketing:/);
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
          },
          {
            id: "auth-api-3",
            email: "auth-api-3@example.com",
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsents: { marketing: true },
            consentByPurposeChannel: { marketing: { email: false } }
          },
          {
            id: "auth-api-4",
            email: "auth-api-4@example.com",
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsents: { marketing: true },
            consentByPurposeChannel: { marketing: { email: { granted: true, unsubscribed: true } } }
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
    assert.ok(getCalls[0].url.startsWith("http://auth-microservice:3370/auth/marketing/recipients?"));
    const authRecipientUrl = new URL(getCalls[0].url);
    assert.equal(authRecipientUrl.searchParams.get("owner"), "auth");
    assert.equal(authRecipientUrl.searchParams.get("tenantId"), "statex");
    assert.equal(authRecipientUrl.searchParams.get("appId"), "flipflop");
    assert.equal(authRecipientUrl.searchParams.get("brandId"), "statex-main");
    assert.equal(authRecipientUrl.searchParams.get("purpose"), "marketing");
    assert.equal(authRecipientUrl.searchParams.get("channel"), "email");
    assert.deepEqual(sentRecipients, ["auth-api-1@example.com"]);
    assert.equal(run.totalRecipients, 4);
    assert.equal(run.totalSent, 1);
    assert.ok(run.results.some((r) => r.recipientRef === "auth:auth-api-2" && r.decisionReason === "consent_missing"));
    assert.ok(run.results.some((r) => r.recipientRef === "auth:auth-api-3" && r.decisionReason === "channel_consent_missing"));
    assert.ok(run.results.some((r) => r.recipientRef === "auth:auth-api-4" && r.decisionReason === "unsubscribed"));
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

test("fails malformed auth recipient responses safely without notification delivery", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.get as unknown as typeof originalGet) = (async () => ({ status: 200, data: { unexpected: true } }) as never) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set("seg-1", makeSegment());
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-auth-invalid-response");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "auth:source");
    assert.equal(run.results[0].decisionReason, "auth_source_unavailable:auth_invalid_recipient_response");
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
          },
          {
            id: "lead-api-4",
            contactMethods: [{ type: "email", value: "lead-api-4@example.com", isPrimary: true }],
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsent: true,
            consentByPurposeChannel: { marketing: { email: false } }
          },
          {
            id: "lead-api-5",
            contactMethods: [{ type: "email", value: "lead-api-5@example.com", isPrimary: true }],
            preferredChannel: "email",
            fallbackChannels: [],
            marketingConsent: true,
            consentByPurposeChannel: { marketing: { email: { granted: true, unsubscribed: true } } }
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
    assert.ok(getCalls[0].url.startsWith("http://leads-microservice:4400/leads/marketing/recipients?"));
    const leadsRecipientUrl = new URL(getCalls[0].url);
    assert.equal(leadsRecipientUrl.searchParams.get("sourceService"), "flipflop-service");
    assert.equal(leadsRecipientUrl.searchParams.get("tenantId"), "statex");
    assert.equal(leadsRecipientUrl.searchParams.get("appId"), "flipflop");
    assert.equal(leadsRecipientUrl.searchParams.get("brandId"), "statex-main");
    assert.equal(leadsRecipientUrl.searchParams.get("purpose"), "marketing");
    assert.equal(leadsRecipientUrl.searchParams.get("channel"), "email");
    assert.deepEqual(sentRecipients, ["lead-api-1@example.com"]);
    assert.equal(run.totalRecipients, 5);
    assert.equal(run.totalSent, 1);
    assert.ok(run.results.some((r) => r.recipientRef === "lead:lead-api-2" && r.decisionReason === "consent_missing"));
    assert.ok(run.results.some((r) => r.recipientRef === "lead:lead-api-3" && r.decisionReason === "unsubscribed"));
    assert.ok(run.results.some((r) => r.recipientRef === "lead:lead-api-4" && r.decisionReason === "channel_consent_missing"));
    assert.ok(run.results.some((r) => r.recipientRef === "lead:lead-api-5" && r.decisionReason === "unsubscribed"));
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


test("deduplicates converted leads against linked auth recipients", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalLeadsUrl = process.env.LEADS_SERVICE_URL;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.LEADS_SERVICE_URL = "http://leads-microservice:4400";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  const sentRecipients: string[] = [];
  (axios.get as unknown as typeof originalGet) = (async (url: string) => {
    if (url.startsWith("http://auth-microservice:3370/auth/marketing/recipients?")) {
      return {
        status: 200,
        data: {
          users: [
            {
              id: "auth-linked-1",
              email: "auth-linked@example.com",
              preferredChannel: "email",
              fallbackChannels: [],
              marketingConsents: { marketing: true }
            }
          ]
        }
      } as never;
    }
    if (url.startsWith("http://leads-microservice:4400/leads/marketing/recipients?")) {
      return {
        status: 200,
        data: {
          leads: [
            {
              id: "lead-converted-1",
              contactMethods: [{ type: "email", value: "lead-converted@example.com", isPrimary: true }],
              preferredChannel: "email",
              fallbackChannels: [],
              marketingConsent: true,
              convertedAuthUserId: "auth-linked-1"
            }
          ]
        }
      } as never;
    }
    throw new Error(`unexpected url:${url}`);
  }) as typeof originalGet;
  (axios.post as unknown as typeof originalPost) = (async (_url: string, payload: unknown) => {
    sentRecipients.push((payload as { recipient: string }).recipient);
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["auth_users", "leads"],
        rules: { cohort: "converted" }
      })
    );
    campaigns.set("camp-1", makeCampaign());

    const run = await executeCampaign("camp-1", "idem-converted-lead-dedupe");
    assert.deepEqual(sentRecipients, ["auth-linked@example.com"]);
    assert.equal(run.totalRecipients, 1);
    assert.equal(run.totalSent, 1);
    assert.ok(run.results.some((r) => r.recipientRef === "auth:auth-linked-1" && r.status === "sent"));
    assert.ok(!run.results.some((r) => r.recipientRef === "lead:lead-converted-1"));
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) delete process.env.AUTH_SERVICE_URL;
    else process.env.AUTH_SERVICE_URL = originalAuthUrl;
    if (originalLeadsUrl === undefined) delete process.env.LEADS_SERVICE_URL;
    else process.env.LEADS_SERVICE_URL = originalLeadsUrl;
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

    if (url.startsWith("http://auth-microservice:3370/auth/marketing/recipients?")) {
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



test("filters auth recipients through configured application signals", async () => {
  resetInMemoryState();
  const originalAuthUrl = process.env.AUTH_SERVICE_URL;
  const originalSignalUrl = process.env.APPLICATION_SIGNAL_SOURCE_URL;
  const originalSignalToken = process.env.APPLICATION_SIGNAL_SOURCE_TOKEN;
  const originalGet = axios.get;
  const originalPost = axios.post;
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  process.env.APPLICATION_SIGNAL_SOURCE_URL = "http://app-signal-service:4700";
  process.env.APPLICATION_SIGNAL_SOURCE_TOKEN = "signal-token";
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  const getCalls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const sentRecipients: string[] = [];
  (axios.get as unknown as typeof originalGet) = (async (url: string, config?: unknown) => {
    getCalls.push({
      url,
      headers: (config as { headers?: Record<string, string> } | undefined)?.headers
    });

    if (url.startsWith("http://app-signal-service:4700/marketing/application-signals?")) {
      return {
        status: 200,
        data: {
          signals: [
            {
              schemaVersion: "marketing.application_signal.v1",
              signalId: "flipflop:product:auth-buyer:viewed",
              sourceService: "flipflop",
              appId: "flipflop",
              tenantId: "statex",
              brandId: "statex-main",
              subject: { type: "registered_user", ref: "auth:user:auth-buyer", sourceOwner: "auth", sourceId: "auth-buyer" },
              eventType: "product.viewed",
              sourceObject: { type: "product", id: "product-1" },
              occurredAt: "2026-06-13T00:00:00.000Z"
            },
            {
              schemaVersion: "marketing.application_signal.v1",
              signalId: "flipflop:product:anon:viewed",
              sourceService: "flipflop",
              appId: "flipflop",
              tenantId: "statex",
              brandId: "statex-main",
              subject: { type: "anonymous", ref: "anonymous:flipflop:session-1", sourceOwner: "flipflop", sourceId: "session-1" },
              eventType: "product.viewed",
              sourceObject: { type: "product", id: "product-1" },
              occurredAt: "2026-06-13T00:00:00.000Z"
            }
          ]
        }
      } as never;
    }

    if (url.startsWith("http://auth-microservice:3370/auth/marketing/recipients?")) {
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
        sourceTypes: ["app_signals", "auth_users"],
        rules: {
          signalEventType: "product.viewed",
          signalSourceService: "flipflop",
          signalOccurredSince: "2026-06-01T00:00:00.000Z"
        }
      })
    );
    campaigns.set("camp-1", makeCampaign({ appId: "flipflop" }));

    const run = await executeCampaign("camp-1", "idem-app-signal-source");
    const signalCall = getCalls.find((call) => call.url.startsWith("http://app-signal-service:4700/marketing/application-signals?"));
    assert.ok(signalCall);
    assert.equal(signalCall.headers?.Authorization, "Bearer signal-token");
    assert.ok(signalCall.url.includes("tenantId=statex"));
    assert.ok(signalCall.url.includes("appId=flipflop"));
    assert.ok(signalCall.url.includes("brandId=statex-main"));
    assert.ok(signalCall.url.includes("eventType=product.viewed"));
    assert.ok(signalCall.url.includes("sourceService=flipflop"));
    assert.deepEqual(sentRecipients, ["buyer@example.com"]);
    assert.equal(run.totalRecipients, 1);
    assert.equal(run.totalSent, 1);
    assert.ok(!run.results.some((r) => r.recipientAddress === "other@example.com"));
  } finally {
    (axios.get as unknown as typeof originalGet) = originalGet;
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalAuthUrl === undefined) delete process.env.AUTH_SERVICE_URL;
    else process.env.AUTH_SERVICE_URL = originalAuthUrl;
    if (originalSignalUrl === undefined) delete process.env.APPLICATION_SIGNAL_SOURCE_URL;
    else process.env.APPLICATION_SIGNAL_SOURCE_URL = originalSignalUrl;
    if (originalSignalToken === undefined) delete process.env.APPLICATION_SIGNAL_SOURCE_TOKEN;
    else process.env.APPLICATION_SIGNAL_SOURCE_TOKEN = originalSignalToken;
    resetInMemoryState();
  }
});

test("fails application signal source safely without notification delivery", async () => {
  resetInMemoryState();
  const originalSignalUrl = process.env.APPLICATION_SIGNAL_SOURCE_URL;
  const originalPost = axios.post;
  delete process.env.APPLICATION_SIGNAL_SOURCE_URL;
  process.env.NOTIFICATION_SERVICE_URL = "http://notifications-microservice:3368";

  let postCalls = 0;
  (axios.post as unknown as typeof originalPost) = (async () => {
    postCalls += 1;
    return { status: 200, data: {} } as never;
  }) as typeof originalPost;

  try {
    segments.set(
      "seg-1",
      makeSegment({
        sourceTypes: ["app_signals", "auth_users"],
        rules: { signalEventType: "product.viewed" }
      })
    );
    campaigns.set("camp-1", makeCampaign({ appId: "flipflop" }));

    const run = await executeCampaign("camp-1", "idem-app-signal-failure");
    assert.equal(run.totalRecipients, 0);
    assert.equal(run.totalSent, 0);
    assert.equal(postCalls, 0);
    assert.equal(run.results.length, 1);
    assert.equal(run.results[0].status, "failed");
    assert.equal(run.results[0].recipientRef, "app_signals:source");
    assert.match(run.results[0].decisionReason, /^app_signals_source_unavailable:/);
  } finally {
    (axios.post as unknown as typeof originalPost) = originalPost;
    if (originalSignalUrl === undefined) delete process.env.APPLICATION_SIGNAL_SOURCE_URL;
    else process.env.APPLICATION_SIGNAL_SOURCE_URL = originalSignalUrl;
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
