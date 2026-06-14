import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketingAnalyticsEvents, buildMarketingAnalyticsSummary } from "../src/analytics";
import { Campaign, ExecutionRun } from "../src/types";

process.env.NODE_ENV = "test";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    campaignId: "campaign-analytics",
    tenant: "statex",
    tenantId: "statex",
    appId: "flipflop",
    brandId: "statex-main",
    businessId: "commerce",
    environment: "test",
    defaultLocale: "en",
    timezone: "Europe/Prague",
    productLine: "marketplace",
    lifecycleScope: "activation",
    legalSenderIdentity: null,
    policyRef: null,
    name: "Activation campaign",
    segmentId: "segment-activation",
    description: null,
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
    channelKey: "statex-email",
    templateRef: "flipflop.activation.default",
    scheduleAt: undefined,
    throttlePerMinute: null,
    frequencyCapPerDay: 1,
    catalogMetadata: {
      campaignFamily: "activation",
      lifecycleStage: "activation",
      audienceKey: "new-buyers",
      audienceLabel: "New buyers",
      catalogCategory: "onboarding",
      catalogTags: ["flipflop", "activation"],
      sourceBlueprintId: "flipflop.activation.default"
    },
    message: { subject: "Welcome", body: "Hello" },
    status: "completed",
    approvalStatus: "approved",
    approvedBy: "owner@example.com",
    approvedAt: "2026-06-13T08:00:00.000Z",
    approvalNote: null,
    createdAt: "2026-06-13T08:00:00.000Z",
    updatedAt: "2026-06-13T08:30:00.000Z",
    ...overrides
  };
}

function makeRun(overrides: Partial<ExecutionRun> = {}): ExecutionRun {
  return {
    id: "run-analytics",
    campaignId: "campaign-analytics",
    idempotencyKey: "analytics-key",
    startedAt: "2026-06-13T09:00:00.000Z",
    completedAt: "2026-06-13T09:00:10.000Z",
    status: "completed",
    dryRun: false,
    approvalEvidence: {
      approvalStatus: "approved",
      approvedBy: "owner@example.com",
      approvedAt: "2026-06-13T08:00:00.000Z"
    },
    totalRecipients: 3,
    totalSent: 1,
    results: [
      {
        deliveryId: "delivery-sent",
        campaignId: "campaign-analytics",
        recipientRef: "auth:user-1",
        recipientSource: "auth",
        recipientAddress: "user1@example.com",
        requestedChannel: "email",
        effectiveChannel: "email",
        status: "sent",
        decisionReason: "sent_via_notifications",
        processedAt: "2026-06-13T09:00:02.000Z",
        duration_ms: 120,
        correlationId: "marketing:run-analytics:auth:user-1"
      },
      {
        deliveryId: "delivery-skip",
        campaignId: "campaign-analytics",
        recipientRef: "lead:lead-1",
        recipientSource: "leads",
        recipientAddress: "lead1@example.com",
        requestedChannel: "email",
        effectiveChannel: "email",
        status: "skipped",
        decisionReason: "consent_missing",
        processedAt: "2026-06-13T09:00:03.000Z",
        duration_ms: 0
      },
      {
        deliveryId: "delivery-failed",
        campaignId: "campaign-analytics",
        recipientRef: "auth:user-2",
        recipientSource: "auth",
        recipientAddress: "user2@example.com",
        requestedChannel: "email",
        effectiveChannel: "telegram",
        status: "failed",
        decisionReason: "notification_url_missing",
        processedAt: "2026-06-13T09:00:04.000Z",
        duration_ms: 25,
        correlationId: "marketing:run-analytics:auth:user-2"
      }
    ],
    ...overrides
  };
}

test("analytics summary aggregates Marketing-owned outcomes without inventing attribution truth", () => {
  const summary = buildMarketingAnalyticsSummary([makeCampaign()], [makeRun()], {
    generatedAt: "2026-06-13T10:00:00.000Z",
    tenantId: "statex",
    appId: "flipflop"
  });

  assert.deepEqual(summary.totals, {
    campaigns: 1,
    runs: 1,
    totalRecipients: 3,
    sent: 1,
    skipped: 1,
    failed: 1,
    wouldSend: 0,
    queued: 0
  });
  assert.equal(summary.byCampaign[0].campaignFamily, "activation");
  assert.equal(summary.byLifecycleStage[0].key, "activation");
  assert.equal(summary.byDecisionReason.find((bucket) => bucket.key === "consent_missing")?.skipped, 1);
  assert.equal(summary.externalAttribution.available, false);
  assert.equal(summary.externalAttribution.delivered, null);
  assert.equal(summary.externalAttribution.converted, null);
  assert.equal(summary.externalAttribution.attributedValue, null);
  assert.equal(summary.externalAttribution.note, "external_analytics_required");
});

test("analytics summary can join externally supplied attribution facts by campaign and run", () => {
  const summary = buildMarketingAnalyticsSummary([makeCampaign()], [makeRun()], {
    generatedAt: "2026-06-13T10:00:00.000Z",
    externalAttributionFacts: [
      {
        factType: "delivered",
        sourceService: "notifications-microservice",
        campaignId: "campaign-analytics",
        runId: "run-analytics",
        correlationId: "marketing:run-analytics:auth:user-1",
        count: 1,
        occurredAt: "2026-06-13T09:01:00.000Z"
      },
      {
        factType: "converted",
        sourceService: "analytics-service",
        campaignId: "campaign-analytics",
        runId: "run-analytics",
        count: 1,
        occurredAt: "2026-06-13T09:30:00.000Z"
      },
      {
        factType: "attributed_value",
        sourceService: "analytics-service",
        campaignId: "campaign-analytics",
        runId: "run-analytics",
        value: 2500,
        currency: "CZK",
        occurredAt: "2026-06-13T09:30:00.000Z"
      }
    ]
  });

  assert.equal(summary.externalAttribution.available, true);
  assert.equal(summary.externalAttribution.delivered, 1);
  assert.equal(summary.externalAttribution.converted, 1);
  assert.equal(summary.externalAttribution.attributedValue, 2500);
  assert.equal(summary.externalAttribution.currency, "CZK");
  assert.deepEqual(summary.externalAttribution.sourceServices, ["analytics-service", "notifications-microservice"]);
});

test("analytics events redact raw recipient addresses and message content", () => {
  const events = buildMarketingAnalyticsEvents([makeCampaign()], [makeRun()]);
  const serialized = JSON.stringify(events);

  assert.equal(events.length, 4);
  assert.equal(events[0].eventType, "marketing.campaign.run.recorded");
  assert.equal(events[1].eventType, "marketing.recipient.outcome.recorded");
  assert.equal(events[1].recipientRef, "auth:user-1");
  assert.equal(events[1].correlationId, "marketing:run-analytics:auth:user-1");
  assert.doesNotMatch(serialized, /user1@example\.com|lead1@example\.com|user2@example\.com|Hello|Welcome|statex-email/);
});
