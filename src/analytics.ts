import { Campaign, Channel, DeliveryResult, ExecutionRun } from "./types";

export type AnalyticsFactType = "delivered" | "converted" | "attributed_value";

export interface ExternalAttributionFact {
  factType: AnalyticsFactType;
  sourceService: string;
  occurredAt: string;
  campaignId: string;
  runId?: string | null;
  correlationId?: string | null;
  count?: number | null;
  value?: number | null;
  currency?: string | null;
}

export interface AnalyticsSummaryFilters {
  tenantId?: string;
  appId?: string;
  brandId?: string;
  businessId?: string;
  productLine?: string;
  lifecycleScope?: string;
  environment?: string;
  segmentId?: string;
  campaignId?: string;
  channel?: Channel;
  from?: string;
  to?: string;
}

export interface AnalyticsBuildOptions extends AnalyticsSummaryFilters {
  generatedAt?: string;
  externalAttributionFacts?: ExternalAttributionFact[];
}

interface StatusTotals {
  totalRecipients: number;
  sent: number;
  skipped: number;
  failed: number;
  wouldSend: number;
  queued: number;
}

interface AnalyticsBucket extends StatusTotals {
  key: string;
  runs: number;
}

export interface AnalyticsCampaignBucket extends AnalyticsBucket {
  campaignId: string;
  name: string;
  segmentId: string;
  tenantId: string;
  appId: string;
  brandId: string;
  campaignFamily: string | null;
  lifecycleStage: string | null;
}

export interface ExternalAttributionSummary {
  available: boolean;
  delivered: number | null;
  converted: number | null;
  attributedValue: number | null;
  currency: string | null;
  sourceServices: string[];
  note: "external_analytics_required" | "external_facts_applied";
}

export interface MarketingAnalyticsSummary {
  generatedAt: string;
  scope: AnalyticsSummaryFilters;
  totals: StatusTotals & { campaigns: number; runs: number };
  byChannel: AnalyticsBucket[];
  byCampaign: AnalyticsCampaignBucket[];
  bySegment: AnalyticsBucket[];
  byLifecycleStage: AnalyticsBucket[];
  byDecisionReason: AnalyticsBucket[];
  externalAttribution: ExternalAttributionSummary;
}

export interface MarketingAnalyticsEvent {
  eventId: string;
  eventType: "marketing.campaign.run.recorded" | "marketing.recipient.outcome.recorded";
  sourceService: "marketing-microservice";
  occurredAt: string;
  tenantId: string;
  appId: string;
  brandId: string;
  businessId: string | null;
  campaignId: string;
  segmentId: string;
  runId: string;
  idempotencyKey: string;
  recipientRef?: string;
  recipientSource?: DeliveryResult["recipientSource"];
  correlationId?: string;
  requestedChannel?: Channel;
  effectiveChannel?: Channel;
  status: ExecutionRun["status"] | DeliveryResult["status"];
  decisionReason?: string;
  campaignFamily: string | null;
  lifecycleStage: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

const EMPTY_TOTALS: StatusTotals = {
  totalRecipients: 0,
  sent: 0,
  skipped: 0,
  failed: 0,
  wouldSend: 0,
  queued: 0
};

function newBucket(key: string): AnalyticsBucket {
  return { key, runs: 0, ...EMPTY_TOTALS };
}

function addOutcome(totals: StatusTotals, outcome: DeliveryResult): void {
  totals.totalRecipients += 1;
  if (outcome.status === "sent") totals.sent += 1;
  if (outcome.status === "skipped") totals.skipped += 1;
  if (outcome.status === "failed") totals.failed += 1;
  if (outcome.status === "would_send") totals.wouldSend += 1;
  if (outcome.status === "queued") totals.queued += 1;
}

function incrementBucket(map: Map<string, AnalyticsBucket>, key: string, outcome: DeliveryResult, runIds: Set<string>, runId: string): void {
  const bucket = map.get(key) ?? newBucket(key);
  if (!runIds.has(`${key}:${runId}`)) {
    bucket.runs += 1;
    runIds.add(`${key}:${runId}`);
  }
  addOutcome(bucket, outcome);
  map.set(key, bucket);
}

function inTimeRange(value: string | undefined, from?: string, to?: string): boolean {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (from && timestamp < new Date(from).getTime()) return false;
  if (to && timestamp > new Date(to).getTime()) return false;
  return true;
}

function campaignMatches(campaign: Campaign, filters: AnalyticsSummaryFilters): boolean {
  if (filters.tenantId !== undefined && campaign.tenantId !== filters.tenantId) return false;
  if (filters.appId !== undefined && campaign.appId !== filters.appId) return false;
  if (filters.brandId !== undefined && campaign.brandId !== filters.brandId) return false;
  if (filters.businessId !== undefined && String(campaign.businessId ?? "") !== filters.businessId) return false;
  if (filters.productLine !== undefined && String(campaign.productLine ?? "") !== filters.productLine) return false;
  if (filters.lifecycleScope !== undefined && String(campaign.lifecycleScope ?? "") !== filters.lifecycleScope) return false;
  if (filters.environment !== undefined && String(campaign.environment ?? "") !== filters.environment) return false;
  if (filters.segmentId !== undefined && campaign.segmentId !== filters.segmentId) return false;
  if (filters.campaignId !== undefined && campaign.campaignId !== filters.campaignId) return false;
  return true;
}

function outcomeMatches(outcome: DeliveryResult, filters: AnalyticsSummaryFilters): boolean {
  if (filters.channel !== undefined && outcome.requestedChannel !== filters.channel && outcome.effectiveChannel !== filters.channel) return false;
  return inTimeRange(outcome.processedAt, filters.from, filters.to);
}

function sortedBuckets<T extends AnalyticsBucket>(buckets: T[]): T[] {
  return buckets.sort((a, b) => b.totalRecipients - a.totalRecipients || a.key.localeCompare(b.key));
}

function externalAttributionSummary(
  facts: ExternalAttributionFact[],
  campaignIds: Set<string>,
  runIds: Set<string>,
  filters: AnalyticsSummaryFilters
): ExternalAttributionSummary {
  const matching = facts.filter((fact) => {
    if (!campaignIds.has(fact.campaignId)) return false;
    if (fact.runId && !runIds.has(fact.runId)) return false;
    return inTimeRange(fact.occurredAt, filters.from, filters.to);
  });

  if (matching.length === 0) {
    return {
      available: false,
      delivered: null,
      converted: null,
      attributedValue: null,
      currency: null,
      sourceServices: [],
      note: "external_analytics_required"
    };
  }

  const currencies = new Set<string>();
  let delivered = 0;
  let converted = 0;
  let attributedValue = 0;
  for (const fact of matching) {
    const count = Number.isFinite(fact.count) && Number(fact.count) > 0 ? Number(fact.count) : 1;
    if (fact.factType === "delivered") delivered += count;
    if (fact.factType === "converted") converted += count;
    if (fact.factType === "attributed_value") {
      attributedValue += Number.isFinite(fact.value) ? Number(fact.value) : 0;
      if (fact.currency) currencies.add(fact.currency);
    }
  }

  return {
    available: true,
    delivered,
    converted,
    attributedValue,
    currency: currencies.size === 0 ? null : currencies.size === 1 ? Array.from(currencies)[0] : "mixed",
    sourceServices: Array.from(new Set(matching.map((fact) => fact.sourceService))).sort(),
    note: "external_facts_applied"
  };
}

function analyticsScope(options: AnalyticsBuildOptions): AnalyticsSummaryFilters {
  const { generatedAt: _generatedAt, externalAttributionFacts: _facts, ...scope } = options;
  return scope;
}

export function buildMarketingAnalyticsSummary(
  campaigns: Campaign[],
  runs: ExecutionRun[],
  options: AnalyticsBuildOptions = {}
): MarketingAnalyticsSummary {
  const scope = analyticsScope(options);
  const campaignMap = new Map(campaigns.filter((campaign) => campaignMatches(campaign, scope)).map((campaign) => [campaign.campaignId, campaign]));
  const includedCampaignIds = new Set<string>();
  const includedRunIds = new Set<string>();
  const totals = { campaigns: 0, runs: 0, ...EMPTY_TOTALS };
  const byChannel = new Map<string, AnalyticsBucket>();
  const bySegment = new Map<string, AnalyticsBucket>();
  const byLifecycleStage = new Map<string, AnalyticsBucket>();
  const byDecisionReason = new Map<string, AnalyticsBucket>();
  const campaignBuckets = new Map<string, AnalyticsCampaignBucket>();
  const channelRunMembership = new Set<string>();
  const segmentRunMembership = new Set<string>();
  const lifecycleRunMembership = new Set<string>();
  const reasonRunMembership = new Set<string>();

  for (const run of runs) {
    const campaign = campaignMap.get(run.campaignId);
    if (!campaign) continue;
    if (!inTimeRange(run.completedAt ?? run.startedAt, scope.from, scope.to)) continue;
    const outcomes = run.results.filter((outcome) => outcomeMatches(outcome, scope));
    if (scope.channel !== undefined && outcomes.length === 0) continue;

    includedCampaignIds.add(campaign.campaignId);
    includedRunIds.add(run.id);
    totals.runs += 1;

    let campaignBucket = campaignBuckets.get(campaign.campaignId);
    if (!campaignBucket) {
      campaignBucket = {
        ...newBucket(campaign.campaignId),
        campaignId: campaign.campaignId,
        name: campaign.name,
        segmentId: campaign.segmentId,
        tenantId: campaign.tenantId,
        appId: campaign.appId,
        brandId: campaign.brandId,
        campaignFamily: campaign.catalogMetadata?.campaignFamily ?? null,
        lifecycleStage: campaign.catalogMetadata?.lifecycleStage ?? null
      };
      campaignBuckets.set(campaign.campaignId, campaignBucket);
    }
    campaignBucket.runs += 1;

    for (const outcome of outcomes) {
      addOutcome(totals, outcome);
      addOutcome(campaignBucket, outcome);
      incrementBucket(byChannel, outcome.effectiveChannel, outcome, channelRunMembership, run.id);
      incrementBucket(bySegment, campaign.segmentId, outcome, segmentRunMembership, run.id);
      incrementBucket(byLifecycleStage, campaign.catalogMetadata?.lifecycleStage ?? "uncategorized", outcome, lifecycleRunMembership, run.id);
      incrementBucket(byDecisionReason, outcome.decisionReason, outcome, reasonRunMembership, run.id);
    }
  }

  totals.campaigns = includedCampaignIds.size;

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope,
    totals,
    byChannel: sortedBuckets(Array.from(byChannel.values())),
    byCampaign: sortedBuckets(Array.from(campaignBuckets.values())),
    bySegment: sortedBuckets(Array.from(bySegment.values())),
    byLifecycleStage: sortedBuckets(Array.from(byLifecycleStage.values())),
    byDecisionReason: sortedBuckets(Array.from(byDecisionReason.values())),
    externalAttribution: externalAttributionSummary(options.externalAttributionFacts ?? [], includedCampaignIds, includedRunIds, scope)
  };
}

export function buildMarketingAnalyticsEvents(campaigns: Campaign[], runs: ExecutionRun[]): MarketingAnalyticsEvent[] {
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const events: MarketingAnalyticsEvent[] = [];
  for (const run of runs) {
    const campaign = campaignMap.get(run.campaignId);
    if (!campaign) continue;
    const base = {
      sourceService: "marketing-microservice" as const,
      tenantId: campaign.tenantId,
      appId: campaign.appId,
      brandId: campaign.brandId,
      businessId: campaign.businessId ?? null,
      campaignId: campaign.campaignId,
      segmentId: campaign.segmentId,
      runId: run.id,
      idempotencyKey: run.idempotencyKey,
      campaignFamily: campaign.catalogMetadata?.campaignFamily ?? null,
      lifecycleStage: campaign.catalogMetadata?.lifecycleStage ?? null
    };
    events.push({
      ...base,
      eventId: `marketing:${run.id}:run`,
      eventType: "marketing.campaign.run.recorded",
      occurredAt: run.completedAt ?? run.startedAt,
      status: run.status,
      metadata: {
        dryRun: run.dryRun === true,
        totalRecipients: run.totalRecipients,
        totalSent: run.totalSent,
        approvalStatus: run.approvalEvidence?.approvalStatus ?? null
      }
    });
    for (const outcome of run.results) {
      events.push({
        ...base,
        eventId: `marketing:${run.id}:${outcome.deliveryId}`,
        eventType: "marketing.recipient.outcome.recorded",
        occurredAt: outcome.processedAt,
        recipientRef: outcome.recipientRef,
        recipientSource: outcome.recipientSource,
        correlationId: outcome.correlationId,
        requestedChannel: outcome.requestedChannel,
        effectiveChannel: outcome.effectiveChannel,
        status: outcome.status,
        decisionReason: outcome.decisionReason,
        metadata: {
          duration_ms: outcome.duration_ms
        }
      });
    }
  }
  return events;
}
