import test from "node:test";
import assert from "node:assert/strict";
import { PostgresMarketingStore } from "../src/store";
import { Campaign } from "../src/types";

process.env.NODE_ENV = "test";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    campaignId: "camp-catalog",
    tenant: "statex",
    tenantId: "statex",
    appId: "flipflop",
    brandId: "statex-main",
    businessId: null,
    environment: "test",
    defaultLocale: "en",
    timezone: "Europe/Prague",
    productLine: "marketplace",
    lifecycleScope: "activation",
    legalSenderIdentity: null,
    policyRef: null,
    name: "Catalog campaign",
    segmentId: "seg-catalog",
    description: null,
    purpose: "marketing",
    primaryChannel: "email",
    fallbackChannels: ["telegram"],
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
    message: { body: "Hello" },
    status: "draft",
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    createdAt: "2026-06-13T08:00:00.000Z",
    updatedAt: "2026-06-13T08:00:00.000Z",
    ...overrides
  };
}

test("postgres campaign persistence includes catalog metadata", async () => {
  const campaign = makeCampaign();
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (text.startsWith("select * from marketing_campaigns")) {
        return {
          rows: [{
            campaign_id: campaign.campaignId,
            tenant: campaign.tenant,
            tenant_id: campaign.tenantId,
            app_id: campaign.appId,
            brand_id: campaign.brandId,
            business_id: campaign.businessId,
            environment: campaign.environment,
            default_locale: campaign.defaultLocale,
            timezone: campaign.timezone,
            product_line: campaign.productLine,
            lifecycle_scope: campaign.lifecycleScope,
            legal_sender_identity: campaign.legalSenderIdentity,
            policy_ref: campaign.policyRef,
            name: campaign.name,
            segment_id: campaign.segmentId,
            description: campaign.description,
            purpose: campaign.purpose,
            primary_channel: campaign.primaryChannel,
            fallback_channels: campaign.fallbackChannels,
            channel_key: null,
            template_ref: campaign.templateRef,
            schedule_at: null,
            throttle_per_minute: campaign.throttlePerMinute,
            frequency_cap_per_day: campaign.frequencyCapPerDay,
            catalog_metadata: campaign.catalogMetadata,
            message: campaign.message,
            status: campaign.status,
            approval_status: campaign.approvalStatus,
            approved_by: campaign.approvedBy,
            approved_at: campaign.approvedAt,
            approval_note: campaign.approvalNote,
            scheduler_lock_owner: null,
            scheduler_lock_until: null,
            last_scheduled_run_at: null,
            created_at: campaign.createdAt,
            updated_at: campaign.updatedAt
          }]
        };
      }
      return { rows: [], rowCount: 1 };
    }
  };
  const store = new PostgresMarketingStore(pool as never);

  await store.saveCampaign(campaign);
  const savedQuery = queries[0];
  assert.match(savedQuery.text, /catalog_metadata/);
  assert.equal(savedQuery.values?.[24], JSON.stringify(campaign.catalogMetadata));
  assert.equal(savedQuery.values?.[25], JSON.stringify(campaign.message));

  const persisted = await store.getCampaign(campaign.campaignId);
  assert.deepEqual(persisted?.catalogMetadata, campaign.catalogMetadata);
  assert.equal(persisted?.approvalStatus, "pending");
  assert.equal(persisted?.status, "draft");
  assert.equal(persisted?.approvalStatus, "pending");
});


test("postgres journey persistence includes trigger steps and suppression rules", async () => {
  const journey = {
    journeyId: "journey-1",
    tenantId: "statex",
    appId: "flipflop",
    brandId: "statex-main",
    businessId: null,
    environment: "test",
    defaultLocale: "en",
    timezone: "Europe/Prague",
    productLine: "marketplace",
    lifecycleScope: "activation",
    legalSenderIdentity: null,
    policyRef: null,
    name: "Activation journey",
    description: null,
    trigger: { type: "manual" },
    steps: [{ stepId: "send", name: "Send", campaignId: "camp-catalog", delayMinutes: 0 }],
    exitRules: [{ ruleId: "activated", type: "app_signal", rules: { eventType: "user.activated" } }],
    suppressionRules: [{ ruleId: "recent", type: "recently_sent", campaignId: "camp-catalog", windowMinutes: 1440 }],
    status: "draft",
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    approvalNote: null,
    activatedAt: null,
    createdAt: "2026-06-13T08:00:00.000Z",
    updatedAt: "2026-06-13T08:00:00.000Z"
  };
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const pool = {
    query: async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (text.startsWith("select * from marketing_journeys")) {
        return { rows: [{
          journey_id: journey.journeyId,
          tenant_id: journey.tenantId,
          app_id: journey.appId,
          brand_id: journey.brandId,
          business_id: journey.businessId,
          environment: journey.environment,
          default_locale: journey.defaultLocale,
          timezone: journey.timezone,
          product_line: journey.productLine,
          lifecycle_scope: journey.lifecycleScope,
          legal_sender_identity: journey.legalSenderIdentity,
          policy_ref: journey.policyRef,
          name: journey.name,
          description: journey.description,
          trigger: journey.trigger,
          steps: journey.steps,
          exit_rules: journey.exitRules,
          suppression_rules: journey.suppressionRules,
          status: journey.status,
          approval_status: journey.approvalStatus,
          approved_by: journey.approvedBy,
          approved_at: journey.approvedAt,
          approval_note: journey.approvalNote,
          activated_at: journey.activatedAt,
          created_at: journey.createdAt,
          updated_at: journey.updatedAt
        }] };
      }
      return { rows: [], rowCount: 1 };
    }
  };
  const store = new PostgresMarketingStore(pool as never);

  await store.saveJourney(journey as never);
  const savedQuery = queries[0];
  assert.match(savedQuery.text, /marketing_journeys/);
  assert.equal(savedQuery.values?.[14], JSON.stringify(journey.trigger));
  assert.equal(savedQuery.values?.[15], JSON.stringify(journey.steps));
  assert.equal(savedQuery.values?.[17], JSON.stringify(journey.suppressionRules));

  const persisted = await store.getJourney(journey.journeyId);
  assert.deepEqual(persisted?.trigger, journey.trigger);
  assert.deepEqual(persisted?.steps, journey.steps);
  assert.deepEqual(persisted?.suppressionRules, journey.suppressionRules);
  assert.equal(persisted?.status, "draft");
  assert.equal(persisted?.approvalStatus, "pending");
});
