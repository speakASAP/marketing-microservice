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

export interface CampaignAttributionMetadata {
  attributionKey: string;
  campaignId: string;
  tenantId: string;
  appId: string;
  brandId: string;
  businessId: string | null;
  segmentId: string;
  campaignFamily: string | null;
  lifecycleStage: string | null;
  audienceKey: string | null;
  sourceBlueprintId: string | null;
  runIds: string[];
  correlationIds: string[];
  channels: Channel[];
  sourceOwnership: {
    campaignFacts: "marketing-microservice";
    deliveryFacts: "external_notifications_required";
    conversionFacts: "external_analytics_required";
    valueFacts: "external_analytics_required";
  };
  redaction: {
    rawRecipientAddresses: "omitted";
    messageContent: "omitted";
    providerCredentials: "omitted";
    serviceTokens: "omitted";
  };
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

export interface ExternalAttributionSummary {
  available: boolean;
  delivered: number | null;
  converted: number | null;
  attributedValue: number | null;
  currency: string | null;
  sourceServices: string[];
  note: "external_analytics_required" | "external_facts_applied";
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
  attribution: CampaignAttributionMetadata;
  externalAttribution: ExternalAttributionSummary;
}

export const ANALYTICS_SOURCE_OWNERSHIP = {
  sentSkippedFailed: "marketing-microservice",
  campaignAttributionMetadata: "marketing-microservice",
  delivered: "externally_supplied_delivery_fact",
  converted: "externally_supplied_analytics_or_app_fact",
  attributedValue: "externally_supplied_analytics_or_domain_fact"
} as const;

export interface MarketingAnalyticsSummary {
  generatedAt: string;
  scope: AnalyticsSummaryFilters;
  sourceOwnership: typeof ANALYTICS_SOURCE_OWNERSHIP;
  totals: StatusTotals & { campaigns: number; runs: number };
  byChannel: AnalyticsBucket[];
  byCampaign: AnalyticsCampaignBucket[];
  bySegment: AnalyticsBucket[];
  byLifecycleStage: AnalyticsBucket[];
  byDecisionReason: AnalyticsBucket[];
  externalAttribution: ExternalAttributionSummary;
}

export interface MarketingAnalyticsDashboardRow {
  campaignId: string;
  name: string;
  tenantId: string;
  appId: string;
  brandId: string;
  segmentId: string;
  campaignFamily: string | null;
  lifecycleStage: string | null;
  runs: number;
  totalRecipients: number;
  sent: number;
  skipped: number;
  failed: number;
  delivered: number | null;
  converted: number | null;
  attributedValue: number | null;
  currency: string | null;
  attributionKey: string;
  deliverySource: "external_notifications_required" | "external_facts_applied";
  conversionSource: "external_analytics_required" | "external_facts_applied";
  valueSource: "external_analytics_required" | "external_facts_applied";
}

export interface MarketingAnalyticsReadModel {
  generatedAt: string;
  scope: AnalyticsSummaryFilters;
  sourceOwnership: typeof ANALYTICS_SOURCE_OWNERSHIP;
  summary: MarketingAnalyticsSummary;
  rows: MarketingAnalyticsDashboardRow[];
  exportColumns: string[];
  warnings: string[];
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

const CSV_EXPORT_COLUMNS = [
  "campaignId",
  "name",
  "tenantId",
  "appId",
  "brandId",
  "segmentId",
  "campaignFamily",
  "lifecycleStage",
  "runs",
  "totalRecipients",
  "sent",
  "skipped",
  "failed",
  "delivered",
  "converted",
  "attributedValue",
  "currency",
  "attributionKey",
  "deliverySource",
  "conversionSource",
  "valueSource"
] as const;

function newBucket(key: string): AnalyticsBucket {
  return { key, runs: 0, ...EMPTY_TOTALS };
}

function unavailableExternalAttribution(): ExternalAttributionSummary {
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
  filters: AnalyticsSummaryFilters,
  correlationIds: Set<string> = new Set()
): ExternalAttributionSummary {
  const matching = facts.filter((fact) => {
    if (!campaignIds.has(fact.campaignId)) return false;
    if (fact.runId && !runIds.has(fact.runId)) return false;
    if (fact.correlationId && correlationIds.size > 0 && !correlationIds.has(fact.correlationId)) return false;
    return inTimeRange(fact.occurredAt, filters.from, filters.to);
  });

  if (matching.length === 0) return unavailableExternalAttribution();

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

function uniqueSorted(values: Iterable<string | undefined>): string[] {
  return Array.from(new Set(Array.from(values).filter((value): value is string => Boolean(value)))).sort();
}

function metadataFromRefs(campaign: Campaign, runIds: Set<string>, correlationIds: Set<string>, channels: Set<Channel>): CampaignAttributionMetadata {
  return {
    attributionKey: `marketing:${campaign.tenantId}:${campaign.appId}:${campaign.campaignId}`,
    campaignId: campaign.campaignId,
    tenantId: campaign.tenantId,
    appId: campaign.appId,
    brandId: campaign.brandId,
    businessId: campaign.businessId ?? null,
    segmentId: campaign.segmentId,
    campaignFamily: campaign.catalogMetadata?.campaignFamily ?? null,
    lifecycleStage: campaign.catalogMetadata?.lifecycleStage ?? null,
    audienceKey: campaign.catalogMetadata?.audienceKey ?? null,
    sourceBlueprintId: campaign.catalogMetadata?.sourceBlueprintId ?? null,
    runIds: uniqueSorted(runIds),
    correlationIds: uniqueSorted(correlationIds),
    channels: Array.from(channels).sort(),
    sourceOwnership: {
      campaignFacts: "marketing-microservice",
      deliveryFacts: "external_notifications_required",
      conversionFacts: "external_analytics_required",
      valueFacts: "external_analytics_required"
    },
    redaction: {
      rawRecipientAddresses: "omitted",
      messageContent: "omitted",
      providerCredentials: "omitted",
      serviceTokens: "omitted"
    }
  };
}

export function buildCampaignAttributionMetadata(campaign: Campaign, runs: ExecutionRun[] = []): CampaignAttributionMetadata {
  const relevantRuns = runs.filter((run) => run.campaignId === campaign.campaignId);
  const runIds = new Set(relevantRuns.map((run) => run.id));
  const correlationIds = new Set(relevantRuns.flatMap((run) => run.results.map((outcome) => outcome.correlationId)).filter((value): value is string => Boolean(value)));
  const channels = new Set<Channel>(relevantRuns.flatMap((run) => run.results.flatMap((outcome) => [outcome.requestedChannel, outcome.effectiveChannel])));
  if (channels.size === 0) channels.add(campaign.primaryChannel);
  return metadataFromRefs(campaign, runIds, correlationIds, channels);
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
  const campaignRunIds = new Map<string, Set<string>>();
  const campaignCorrelationIds = new Map<string, Set<string>>();
  const campaignChannels = new Map<string, Set<Channel>>();
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

    const runIdSet = campaignRunIds.get(campaign.campaignId) ?? new Set<string>();
    runIdSet.add(run.id);
    campaignRunIds.set(campaign.campaignId, runIdSet);

    const correlationIdSet = campaignCorrelationIds.get(campaign.campaignId) ?? new Set<string>();
    const channelSet = campaignChannels.get(campaign.campaignId) ?? new Set<Channel>();
    for (const outcome of outcomes) {
      if (outcome.correlationId) correlationIdSet.add(outcome.correlationId);
      channelSet.add(outcome.requestedChannel);
      channelSet.add(outcome.effectiveChannel);
    }
    campaignCorrelationIds.set(campaign.campaignId, correlationIdSet);
    campaignChannels.set(campaign.campaignId, channelSet);

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
        lifecycleStage: campaign.catalogMetadata?.lifecycleStage ?? null,
        attribution: buildCampaignAttributionMetadata(campaign),
        externalAttribution: unavailableExternalAttribution()
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
  const externalFacts = options.externalAttributionFacts ?? [];
  for (const bucket of campaignBuckets.values()) {
    const campaign = campaignMap.get(bucket.campaignId);
    if (!campaign) continue;
    const runIds = campaignRunIds.get(bucket.campaignId) ?? new Set<string>();
    const correlationIds = campaignCorrelationIds.get(bucket.campaignId) ?? new Set<string>();
    const channels = campaignChannels.get(bucket.campaignId) ?? new Set<Channel>([campaign.primaryChannel]);
    bucket.attribution = metadataFromRefs(campaign, runIds, correlationIds, channels);
    bucket.externalAttribution = externalAttributionSummary(externalFacts, new Set([bucket.campaignId]), runIds, scope, correlationIds);
  }

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope,
    sourceOwnership: ANALYTICS_SOURCE_OWNERSHIP,
    totals,
    byChannel: sortedBuckets(Array.from(byChannel.values())),
    byCampaign: sortedBuckets(Array.from(campaignBuckets.values())),
    bySegment: sortedBuckets(Array.from(bySegment.values())),
    byLifecycleStage: sortedBuckets(Array.from(byLifecycleStage.values())),
    byDecisionReason: sortedBuckets(Array.from(byDecisionReason.values())),
    externalAttribution: externalAttributionSummary(externalFacts, includedCampaignIds, includedRunIds, scope)
  };
}

export function buildMarketingAnalyticsReadModel(
  campaigns: Campaign[],
  runs: ExecutionRun[],
  options: AnalyticsBuildOptions = {}
): MarketingAnalyticsReadModel {
  const summary = buildMarketingAnalyticsSummary(campaigns, runs, options);
  const rows: MarketingAnalyticsDashboardRow[] = summary.byCampaign.map((bucket) => ({
    campaignId: bucket.campaignId,
    name: bucket.name,
    tenantId: bucket.tenantId,
    appId: bucket.appId,
    brandId: bucket.brandId,
    segmentId: bucket.segmentId,
    campaignFamily: bucket.campaignFamily,
    lifecycleStage: bucket.lifecycleStage,
    runs: bucket.runs,
    totalRecipients: bucket.totalRecipients,
    sent: bucket.sent,
    skipped: bucket.skipped,
    failed: bucket.failed,
    delivered: bucket.externalAttribution.delivered,
    converted: bucket.externalAttribution.converted,
    attributedValue: bucket.externalAttribution.attributedValue,
    currency: bucket.externalAttribution.currency,
    attributionKey: bucket.attribution.attributionKey,
    deliverySource: bucket.externalAttribution.available && bucket.externalAttribution.delivered !== null ? "external_facts_applied" : "external_notifications_required",
    conversionSource: bucket.externalAttribution.available && bucket.externalAttribution.converted !== null ? "external_facts_applied" : "external_analytics_required",
    valueSource: bucket.externalAttribution.available && bucket.externalAttribution.attributedValue !== null ? "external_facts_applied" : "external_analytics_required"
  }));
  return {
    generatedAt: summary.generatedAt,
    scope: summary.scope,
    sourceOwnership: ANALYTICS_SOURCE_OWNERSHIP,
    summary,
    rows,
    exportColumns: [...CSV_EXPORT_COLUMNS],
    warnings: summary.externalAttribution.available ? [] : ["external_analytics_required"]
  };
}

function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildMarketingAnalyticsCsv(readModel: MarketingAnalyticsReadModel): string {
  const rows = readModel.rows.map((row) => CSV_EXPORT_COLUMNS.map((column) => csvCell(row[column] ?? null)).join(","));
  return [[...CSV_EXPORT_COLUMNS].join(","), ...rows].join("\n") + "\n";
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
