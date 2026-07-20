import axios from "axios";
import { logDecision } from "./logger";
import { Campaign, Channel, Contact, ResultSource, Segment } from "./types";

const AUTH_USERS_DEFAULT_PATH = "/auth/marketing/recipients";
const LEADS_DEFAULT_PATH = "/leads/marketing/recipients";
const ORDERS_DEFAULT_PATH = "/api/orders";
const CATALOG_PRODUCTS_DEFAULT_PATH = "/api/products";
const APPLICATION_SIGNALS_DEFAULT_PATH = "/marketing/application-signals";
const CRM_ACCOUNT_SIGNALS_DEFAULT_PATH = "/marketing/account-signals";

type UnknownRecord = Record<string, unknown>;

interface ProductSignal {
  productIds: Set<string>;
  skus: Set<string>;
}

interface OrderSignal {
  recipientRefs: Set<string>;
  emails: Set<string>;
  phones: Set<string>;
}

interface ApplicationSignal {
  recipientRefs: Set<string>;
  signalCount: number;
  matchedSignalCount: number;
}

interface CrmAccountSignal {
  recipientRefs: Set<string>;
  signalCount: number;
  matchedSignalCount: number;
}

export interface RecipientResolution {
  recipients: Contact[];
  failures: SourceFailure[];
}

export interface SourceFailure {
  source: ResultSource;
  reason: string;
  status?: "failed" | "skipped";
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChannel(value: unknown): value is Channel {
  return value === "email" || value === "telegram" || value === "whatsapp";
}

function normalizeChannel(value: unknown): Channel {
  return isChannel(value) ? value : "email";
}

function normalizeFallbackChannels(value: unknown): Channel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isChannel);
}

function normalizeToken(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

function readString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function readNestedRecord(record: UnknownRecord, key: string): UnknownRecord | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function readNestedString(record: UnknownRecord, parentKey: string, keys: string[]): string | undefined {
  const parent = readNestedRecord(record, parentKey);
  return parent ? readString(parent, keys) : undefined;
}

function readIdentityLinkString(record: UnknownRecord, keys: string[]): string | undefined {
  return (
    readString(record, keys) ??
    readNestedString(record, "identityLink", keys) ??
    readNestedString(record, "identity", keys)
  );
}

function readContactMethod(record: UnknownRecord, type: Channel): string | undefined {
  const contactMethods = record.contactMethods;
  if (!Array.isArray(contactMethods)) {
    return undefined;
  }

  const primaryMatch = contactMethods.find((method) => {
    return isRecord(method) && method.type === type && method.isPrimary === true;
  });
  const match = primaryMatch ?? contactMethods.find((method) => isRecord(method) && method.type === type);
  if (!isRecord(match)) {
    return undefined;
  }
  return readString(match, ["value", "address"]);
}

function truthyConsentValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    return ["true", "granted", "yes", "opted_in", "subscribed"].includes(value.toLowerCase());
  }
  if (isRecord(value)) {
    return truthyConsentValue(value.marketing) || truthyConsentValue(value.consent) || truthyConsentValue(value.granted);
  }
  return false;
}

function consentValueAt(value: unknown, channel: Channel): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return truthyConsentValue(value);
  if (!isRecord(value)) return undefined;

  const direct = value[channel];
  if (direct !== undefined) return truthyConsentValue(direct);
  const channels = value.channels;
  if (isRecord(channels) && channels[channel] !== undefined) return truthyConsentValue(channels[channel]);
  if (value.granted !== undefined || value.consent !== undefined || value.marketing !== undefined) return truthyConsentValue(value);
  return undefined;
}

function channelConsentFrom(record: UnknownRecord, campaign: Campaign, channel: Channel): boolean | undefined {
  const candidates = [record.consentByPurposeChannel, record.marketingConsents, record.consents];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;

    const direct = consentValueAt(candidate[channel], channel);
    if (direct !== undefined) return direct;

    // Most specific first. Product (appId) must win over any broader scope.
    //
    // Tenant scopes are deliberately absent: tenantId is "statex", the company,
    // so honouring it here would let one key opt a user into marketing for
    // every app in the ecosystem. Withdrawal (channelUnsubscribedFrom) still
    // honours tenant scope, because suppressing too much is the safe direction.
    for (const scoped of [
      candidate[campaign.appId],
      candidate[campaign.purpose],
      candidate.marketing,
      candidate["*"]
    ]) {
      const value = consentValueAt(scoped, channel);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function hasMarketingConsent(record: UnknownRecord, campaign: Campaign): boolean {
  const consents = record.marketingConsents;
  if (typeof record.marketingConsent === "boolean") {
    return record.marketingConsent;
  }
  if (typeof record.consentMarketing === "boolean") {
    return record.consentMarketing;
  }
  if (!isRecord(consents)) {
    return channelConsentFrom(record, campaign, campaign.primaryChannel) === true;
  }
  // Consent is per product (campaign.appId). A tenant-level key must never
  // grant consent across every app under that tenant: tenantId is "statex",
  // the company, so { statex: true } would opt a user into everything.
  const forProduct = consents[campaign.appId];
  if (forProduct !== undefined) {
    return truthyConsentValue(forProduct);
  }
  return (
    truthyConsentValue(consents.marketing) ||
    truthyConsentValue(consents[campaign.purpose]) ||
    truthyConsentValue(consents["*"]) ||
    channelConsentFrom(record, campaign, campaign.primaryChannel) === true
  );
}

function channelConsentsFrom(record: UnknownRecord, campaign: Campaign): Partial<Record<Channel, boolean>> | undefined {
  const channels: Partial<Record<Channel, boolean>> = {};
  for (const channel of ["email", "telegram", "whatsapp"] as const) {
    const value = channelConsentFrom(record, campaign, channel);
    if (value !== undefined) channels[channel] = value;
  }
  return Object.keys(channels).length > 0 ? channels : undefined;
}

function explicitUnsubscribeFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return ["true", "yes", "unsubscribed", "opted_out"].includes(value.toLowerCase());
  return false;
}

function sourceOwnedUnsubscribeValue(value: unknown): boolean | undefined {
  if (!isRecord(value)) return undefined;
  if (value.unsubscribed !== undefined) return explicitUnsubscribeFlag(value.unsubscribed);
  if (value.isUnsubscribed !== undefined) return explicitUnsubscribeFlag(value.isUnsubscribed);
  if (value.transactionalOnly === true) return true;
  return undefined;
}

function channelUnsubscribedFrom(record: UnknownRecord, campaign: Campaign, channel: Channel): boolean {
  const candidates = [record.consentByPurposeChannel, record.marketingConsents, record.consents];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;

    const direct = consentValueAt(candidate[channel], channel);
    const directUnsubscribed = sourceOwnedUnsubscribeValue(candidate[channel]);
    if (directUnsubscribed === true) return true;
    if (direct === false) continue;

    for (const scoped of [
      candidate[campaign.purpose],
      candidate.marketing,
      candidate[campaign.tenantId],
      candidate[campaign.tenant],
      candidate[campaign.appId],
      candidate["*"]
    ]) {
      const scopedRecord = isRecord(scoped) ? scoped : undefined;
      if (scopedRecord && sourceOwnedUnsubscribeValue(scopedRecord[channel]) === true) return true;
      if (sourceOwnedUnsubscribeValue(scoped) === true) return true;
    }
  }
  return false;
}

function isUnsubscribed(record: UnknownRecord, campaign: Campaign): boolean {
  return Boolean(
    record.unsubscribedAt ||
    record.unsubscribed ||
    record.isUnsubscribed ||
    record.transactionalOnly === true ||
    channelUnsubscribedFrom(record, campaign, campaign.primaryChannel)
  );
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!isRecord(data)) {
    return [];
  }
  for (const key of ["users", "leads", "signals", "items", "data", "results", "recipients"]) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (isRecord(value)) {
      const nested = extractItems(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function extractRecipientItems(data: unknown, source: "auth" | "leads"): unknown[] {
  const items = extractItems(data);
  if (items.length > 0) return items;
  if (Array.isArray(data)) return items;
  throw new Error(`${source}_invalid_recipient_response`);
}

function extractRecord(data: unknown): UnknownRecord | undefined {
  if (isRecord(data)) {
    const nested = data.data;
    if (isRecord(nested)) {
      return nested;
    }
    return data;
  }
  return undefined;
}

function addStringValue(values: Set<string>, value: string | undefined): void {
  const normalized = normalizeToken(value);
  if (normalized) {
    values.add(normalized);
  }
}

function toAuthContact(item: unknown, campaign: Campaign): Contact | null {
  if (!isRecord(item)) {
    return null;
  }
  const id = readString(item, ["id", "userId", "authUserId"]);
  if (!id) {
    return null;
  }
  return {
    id,
    owner: "auth",
    email: readString(item, ["email", "primaryEmail"]),
    phone: readString(item, ["phone", "phoneNumber", "primaryPhone"]),
    preferredChannel: normalizeChannel(item.preferredChannel),
    fallbackChannels: normalizeFallbackChannels(item.fallbackChannels),
    identityLinks: { leadId: readIdentityLinkString(item, ["leadId", "sourceLeadId"]) },
    consent: {
      marketing: hasMarketingConsent(item, campaign),
      unsubscribed: isUnsubscribed(item, campaign),
      channels: channelConsentsFrom(item, campaign)
    }
  };
}

function toLeadContact(item: unknown, campaign: Campaign): Contact | null {
  if (!isRecord(item)) {
    return null;
  }
  const id = readString(item, ["id", "leadId"]);
  if (!id) {
    return null;
  }
  return {
    id,
    owner: "leads",
    email: readString(item, ["email", "primaryEmail"]) ?? readContactMethod(item, "email"),
    phone:
      readString(item, ["phone", "phoneNumber", "primaryPhone"]) ??
      readContactMethod(item, "whatsapp") ??
      readContactMethod(item, "telegram"),
    preferredChannel: normalizeChannel(item.preferredChannel),
    fallbackChannels: normalizeFallbackChannels(item.fallbackChannels),
    identityLinks: { authUserId: readIdentityLinkString(item, ["convertedAuthUserId", "authUserId", "registeredUserId", "userId"]) },
    consent: {
      marketing: hasMarketingConsent(item, campaign),
      unsubscribed: isUnsubscribed(item, campaign),
      channels: channelConsentsFrom(item, campaign)
    }
  };
}

function authRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.AUTH_SERVICE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function leadsRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.LEADS_SERVICE_TOKEN;
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "x-internal-service-token": token,
        "x-service-name": "marketing-microservice"
      }
    : undefined;
}

function ordersRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.ORDERS_SERVICE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function catalogRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.CATALOG_SERVICE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function applicationSignalRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.APPLICATION_SIGNAL_SOURCE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function crmAccountRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.CRM_ACCOUNT_SERVICE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function withAuthRecipientQuery(basePath: string, segment: Segment, campaign: Campaign): string {
  const params = new URLSearchParams();
  params.set("limit", String(process.env.AUTH_USERS_SEGMENT_LIMIT ?? 100));
  for (const [key, value] of Object.entries(segment.rules)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      params.set(key, String(value));
    }
  }

  params.set("tenantId", campaign.tenantId);
  params.set("appId", campaign.appId);
  params.set("brandId", campaign.brandId);
  params.set("purpose", campaign.purpose);
  params.set("channel", campaign.primaryChannel);
  if (campaign.fallbackChannels.length > 0) params.set("fallbackChannels", campaign.fallbackChannels.join(","));
  if (campaign.businessId) params.set("businessId", campaign.businessId);
  if (campaign.environment) params.set("environment", campaign.environment);
  if (campaign.productLine) params.set("productLine", campaign.productLine);
  if (campaign.lifecycleScope) params.set("lifecycleScope", campaign.lifecycleScope);

  return `${basePath}?${params.toString()}`;
}

function withLeadsRecipientQuery(basePath: string, segment: Segment, campaign: Campaign): string {
  const params = new URLSearchParams();
  params.set("limit", String(process.env.LEADS_SEGMENT_LIMIT ?? 30));
  for (const [key, value] of Object.entries(segment.rules)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      params.set(key, String(value));
    }
  }

  params.set("tenantId", campaign.tenantId);
  params.set("appId", campaign.appId);
  params.set("brandId", campaign.brandId);
  params.set("purpose", campaign.purpose);
  params.set("channel", campaign.primaryChannel);
  if (campaign.fallbackChannels.length > 0) params.set("fallbackChannels", campaign.fallbackChannels.join(","));
  if (campaign.businessId) params.set("businessId", campaign.businessId);
  if (campaign.environment) params.set("environment", campaign.environment);
  if (campaign.productLine) params.set("productLine", campaign.productLine);
  if (campaign.lifecycleScope) params.set("lifecycleScope", campaign.lifecycleScope);

  return `${basePath}?${params.toString()}`;
}

function readRule(segment: Segment, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = segment.rules[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return undefined;
}

function hasCatalogRule(segment: Segment): boolean {
  return Boolean(
    readRule(segment, ["catalogProductId", "catalogSku", "catalogSearch", "catalogLifecycle", "catalogCategoryId", "catalogIsActive"])
  );
}

function withOrderSignalQuery(basePath: string, segment: Segment): string {
  const params = new URLSearchParams();
  const limit = process.env.ORDER_SIGNAL_LIMIT;
  const channel = readRule(segment, ["orderChannel", "channel"]);
  const status = readRule(segment, ["orderStatus", "status"]);
  if (limit) params.set("limit", limit);
  if (channel) params.set("channel", channel);
  if (status) params.set("status", status);
  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}

function withApplicationSignalQuery(basePath: string, segment: Segment, campaign: Campaign): string {
  const params = new URLSearchParams();
  params.set("limit", String(process.env.APPLICATION_SIGNAL_SOURCE_LIMIT ?? 100));
  params.set("tenantId", campaign.tenantId);
  params.set("appId", campaign.appId);
  params.set("brandId", campaign.brandId);
  if (campaign.businessId) params.set("businessId", campaign.businessId);
  if (campaign.environment) params.set("environment", campaign.environment);
  if (campaign.productLine) params.set("productLine", campaign.productLine);
  if (campaign.lifecycleScope) params.set("lifecycleScope", campaign.lifecycleScope);

  const queryRules: Array<[string, string[]]> = [
    ["eventType", ["signalEventType", "eventType"]],
    ["eventGroup", ["signalEventGroup", "eventGroup"]],
    ["lifecycleStage", ["signalLifecycleStage", "lifecycleStage"]],
    ["sourceService", ["signalSourceService", "sourceService"]],
    ["sourceObjectType", ["signalSourceObjectType", "sourceObjectType"]],
    ["sourceObjectId", ["signalSourceObjectId", "sourceObjectId"]],
    ["subjectRef", ["signalSubjectRef", "subjectRef"]],
    ["occurredSince", ["signalOccurredSince", "occurredSince", "occurredAfter"]],
    ["occurredUntil", ["signalOccurredUntil", "occurredUntil", "occurredBefore"]]
  ];
  for (const [queryKey, ruleKeys] of queryRules) {
    const value = readRule(segment, ruleKeys);
    if (value) params.set(queryKey, value);
  }

  return `${basePath}?${params.toString()}`;
}

function withCrmAccountSignalQuery(basePath: string, segment: Segment, campaign: Campaign, cursor?: string): string {
  const params = new URLSearchParams();
  params.set("limit", String(process.env.CRM_ACCOUNT_SIGNAL_LIMIT ?? 100));
  params.set("tenantId", campaign.tenantId);
  params.set("appId", campaign.appId);
  params.set("brandId", campaign.brandId);
  if (campaign.businessId) params.set("businessId", campaign.businessId);
  if (campaign.environment) params.set("environment", campaign.environment);
  if (cursor) params.set("cursor", cursor);

  const queryRules: Array<[string, string[]]> = [
    ["accountId", ["accountId", "crmAccountId"]],
    ["companyId", ["companyId", "crmCompanyId"]],
    ["accountOwnerId", ["accountOwnerId", "ownerId"]],
    ["opportunityId", ["opportunityId"]],
    ["lifecycleStage", ["lifecycleStage", "accountLifecycleStage"]],
    ["opportunityStage", ["opportunityStage"]],
    ["opportunityStatus", ["opportunityStatus"]],
    ["opportunityType", ["opportunityType"]],
    ["healthStatus", ["healthStatus"]],
    ["onboardingStatus", ["onboardingStatus"]],
    ["renewalDateFrom", ["renewalDateFrom"]],
    ["renewalDateUntil", ["renewalDateUntil"]],
    ["sourceUpdatedSince", ["sourceUpdatedSince"]],
    ["sourceUpdatedUntil", ["sourceUpdatedUntil"]]
  ];
  for (const [queryKey, ruleKeys] of queryRules) {
    const value = readRule(segment, ruleKeys);
    if (value) params.set(queryKey, value);
  }

  return `${basePath}?${params.toString()}`;
}

function withCatalogProductsQuery(basePath: string, segment: Segment): string {
  const params = new URLSearchParams();
  params.set("limit", String(process.env.CATALOG_PRODUCT_LIMIT ?? 100));
  const search = readRule(segment, ["catalogSearch"]);
  const lifecycle = readRule(segment, ["catalogLifecycle"]);
  const categoryId = readRule(segment, ["catalogCategoryId"]);
  const isActive = readRule(segment, ["catalogIsActive"]);
  if (search) params.set("search", search);
  if (lifecycle) params.set("lifecycle", lifecycle);
  if (categoryId) params.set("categoryId", categoryId);
  if (isActive) params.set("isActive", isActive);
  return `${basePath}?${params.toString()}`;
}

function isIsoUtc(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function appSignalSubjectRef(item: UnknownRecord): string | undefined {
  const direct = readString(item, ["subjectRef"]);
  if (direct) return direct;
  const subject = readNestedRecord(item, "subject");
  return subject ? readString(subject, ["ref"]) : undefined;
}

function toAppSignalRecipientRef(subjectRef: string | undefined): string | undefined {
  if (!subjectRef) return undefined;
  if (subjectRef.startsWith("auth:user:")) return `auth:${subjectRef.slice("auth:user:".length)}`;
  if (subjectRef.startsWith("leads:lead:")) return `lead:${subjectRef.slice("leads:lead:".length)}`;
  return undefined;
}

function readNestedRuleString(record: UnknownRecord, parentKey: string, keys: string[]): string | undefined {
  const parent = readNestedRecord(record, parentKey);
  return parent ? readString(parent, keys) : undefined;
}

function normalizeRuleList(value: string | undefined): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function matchesRuleValue(actual: string | undefined, expected: string | undefined): boolean {
  const expectedValues = normalizeRuleList(expected);
  if (expectedValues.length === 0) return true;
  return Boolean(actual && expectedValues.includes(actual));
}

function matchesOccurredWindow(item: UnknownRecord, segment: Segment): boolean {
  const occurredAt = readString(item, ["occurredAt"]);
  if (!occurredAt) return false;
  const occurredTime = Date.parse(occurredAt);
  const since = readRule(segment, ["signalOccurredSince", "occurredSince", "occurredAfter"]);
  const until = readRule(segment, ["signalOccurredUntil", "occurredUntil", "occurredBefore"]);
  return (!since || occurredTime >= Date.parse(since)) && (!until || occurredTime <= Date.parse(until));
}

function matchesApplicationSignalRules(item: UnknownRecord, segment: Segment): boolean {
  return (
    matchesRuleValue(readString(item, ["eventType"]), readRule(segment, ["signalEventType", "eventType"])) &&
    matchesRuleValue(readString(item, ["eventGroup"]), readRule(segment, ["signalEventGroup", "eventGroup"])) &&
    matchesRuleValue(readString(item, ["lifecycleStage"]), readRule(segment, ["signalLifecycleStage", "lifecycleStage"])) &&
    matchesRuleValue(readString(item, ["sourceService"]), readRule(segment, ["signalSourceService", "sourceService"])) &&
    matchesRuleValue(readNestedRuleString(item, "sourceObject", ["type"]), readRule(segment, ["signalSourceObjectType", "sourceObjectType"])) &&
    matchesRuleValue(readNestedRuleString(item, "sourceObject", ["id", "ref"]), readRule(segment, ["signalSourceObjectId", "sourceObjectId"])) &&
    matchesRuleValue(appSignalSubjectRef(item), readRule(segment, ["signalSubjectRef", "subjectRef"])) &&
    matchesOccurredWindow(item, segment)
  );
}

function readNumberRule(segment: Segment, keys: string[]): number | undefined {
  const value = readRule(segment, keys);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readNumberValue(record: UnknownRecord, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function matchesDateWindow(value: string | undefined, from: string | undefined, until: string | undefined): boolean {
  if (!from && !until) return true;
  if (!value) return false;
  const time = Date.parse(value);
  return (!from || time >= Date.parse(from)) && (!until || time <= Date.parse(until));
}

function relatedOpportunityMatches(item: UnknownRecord, expected: string | undefined): boolean {
  if (!expected) return true;
  if (readString(item, ["opportunityId"]) === expected) return true;
  const related = item.relatedOpportunityIds;
  return Array.isArray(related) && related.some((value) => value === expected);
}

function matchesCrmAccountRules(item: UnknownRecord, segment: Segment): boolean {
  const healthScore = readNumberValue(item, "healthScore");
  const healthScoreMin = readNumberRule(segment, ["healthScoreMin"]);
  const healthScoreMax = readNumberRule(segment, ["healthScoreMax"]);
  if (healthScoreMin !== undefined && (healthScore === undefined || healthScore < healthScoreMin)) return false;
  if (healthScoreMax !== undefined && (healthScore === undefined || healthScore > healthScoreMax)) return false;

  return (
    matchesRuleValue(readString(item, ["accountId"]), readRule(segment, ["accountId", "crmAccountId"])) &&
    matchesRuleValue(readString(item, ["companyId"]), readRule(segment, ["companyId", "crmCompanyId"])) &&
    matchesRuleValue(readString(item, ["accountOwnerId", "ownerId"]), readRule(segment, ["accountOwnerId", "ownerId"])) &&
    relatedOpportunityMatches(item, readRule(segment, ["opportunityId"])) &&
    matchesRuleValue(readString(item, ["lifecycleStage"]), readRule(segment, ["lifecycleStage", "accountLifecycleStage"])) &&
    matchesRuleValue(readString(item, ["opportunityStage"]), readRule(segment, ["opportunityStage"])) &&
    matchesRuleValue(readString(item, ["opportunityStatus"]), readRule(segment, ["opportunityStatus"])) &&
    matchesRuleValue(readString(item, ["opportunityType"]), readRule(segment, ["opportunityType"])) &&
    matchesRuleValue(readString(item, ["healthStatus"]), readRule(segment, ["healthStatus"])) &&
    matchesRuleValue(readString(item, ["onboardingStatus"]), readRule(segment, ["onboardingStatus"])) &&
    matchesRuleValue(readString(item, ["planTier"]), readRule(segment, ["planTier"])) &&
    matchesRuleValue(readString(item, ["riskLevel"]), readRule(segment, ["riskLevel"])) &&
    matchesDateWindow(readString(item, ["renewalDate"]), readRule(segment, ["renewalDateFrom"]), readRule(segment, ["renewalDateUntil"])) &&
    matchesDateWindow(readString(item, ["expectedCloseDate"]), readRule(segment, ["expectedCloseDateFrom"]), readRule(segment, ["expectedCloseDateUntil"])) &&
    matchesDateWindow(readString(item, ["sourceUpdatedAt"]), readRule(segment, ["sourceUpdatedSince"]), readRule(segment, ["sourceUpdatedUntil"]))
  );
}

function validateApplicationSignalEnvelope(item: unknown, campaign: Campaign): UnknownRecord {
  if (!isRecord(item)) throw new Error("app_signal_invalid_response:not_object");
  for (const field of ["schemaVersion", "signalId", "sourceService", "appId", "eventType", "occurredAt"] as const) {
    if (!readString(item, [field])) throw new Error(`app_signal_invalid_response:${field}`);
  }
  if (readString(item, ["schemaVersion"]) !== "marketing.application_signal.v1") {
    throw new Error("app_signal_invalid_response:schemaVersion");
  }
  if (readString(item, ["appId"]) !== campaign.appId) {
    throw new Error("app_signal_invalid_response:appId");
  }
  const occurredAt = readString(item, ["occurredAt"]);
  if (!occurredAt || !isIsoUtc(occurredAt)) throw new Error("app_signal_invalid_response:occurredAt");
  if (!appSignalSubjectRef(item)) throw new Error("app_signal_invalid_response:subject");
  if (!readNestedRecord(item, "sourceObject")) throw new Error("app_signal_invalid_response:sourceObject");
  return item;
}

function crmContactRefToRecipientRef(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const ref = readString(value, ["ref", "subjectRef", "recipientRef"]);
  const owner = readString(value, ["owner"]);
  if (ref?.startsWith("auth:user:")) return "auth:" + ref.slice("auth:user:".length);
  if (ref?.startsWith("leads:lead:")) return "lead:" + ref.slice("leads:lead:".length);
  if (owner === "auth") {
    const id = readString(value, ["id", "userId", "authUserId"]);
    return id ? "auth:" + id : undefined;
  }
  if (owner === "leads") {
    const id = readString(value, ["id", "leadId"]);
    return id ? "lead:" + id : undefined;
  }
  return undefined;
}

function addCrmContactRefs(signal: CrmAccountSignal, item: UnknownRecord): void {
  if (!Array.isArray(item.contactRefs)) return;
  for (const contactRef of item.contactRefs) {
    const recipientRef = crmContactRefToRecipientRef(contactRef);
    if (recipientRef) signal.recipientRefs.add(recipientRef);
  }
}

function validateCrmAccountSignalEnvelope(item: unknown, campaign: Campaign): UnknownRecord {
  if (!isRecord(item)) throw new Error("crm_account_invalid_response:not_object");
  const schemaVersion = readString(item, ["schemaVersion"]);
  if (schemaVersion !== "marketing.crm_account_signal.v1" && schemaVersion !== "marketing.crm_opportunity_signal.v1") {
    throw new Error("crm_account_invalid_response:schemaVersion");
  }
  if (readString(item, ["tenantId"]) !== campaign.tenantId) throw new Error("crm_account_invalid_response:tenantId");
  const appId = readString(item, ["appId"]);
  const appIds = Array.isArray(item.appIds) ? item.appIds.filter((value): value is string => typeof value === "string") : [];
  if (appId && appId !== campaign.appId) throw new Error("crm_account_invalid_response:appId");
  if (appIds.length > 0 && !appIds.includes(campaign.appId)) throw new Error("crm_account_invalid_response:appIds");
  const sourceUpdatedAt = readString(item, ["sourceUpdatedAt"]);
  if (!sourceUpdatedAt || !isIsoUtc(sourceUpdatedAt)) throw new Error("crm_account_invalid_response:sourceUpdatedAt");
  if (schemaVersion === "marketing.crm_account_signal.v1" && !readString(item, ["accountId"])) {
    throw new Error("crm_account_invalid_response:accountId");
  }
  if (schemaVersion === "marketing.crm_opportunity_signal.v1" && !readString(item, ["opportunityId"])) {
    throw new Error("crm_account_invalid_response:opportunityId");
  }
  return item;
}

function extractNextCursor(data: unknown): string | undefined {
  return isRecord(data) && typeof data.nextCursor === "string" && data.nextCursor.trim() ? data.nextCursor : undefined;
}

async function fetchCrmAccountSignal(segment: Segment, campaign: Campaign): Promise<CrmAccountSignal> {
  const crmUrl = process.env.CRM_ACCOUNT_SERVICE_URL;
  if (!crmUrl) {
    throw new Error("crm_account_service_url_missing");
  }

  const path = process.env.CRM_ACCOUNT_SIGNAL_PATH ?? CRM_ACCOUNT_SIGNALS_DEFAULT_PATH;
  const timeout = Number(process.env.CRM_ACCOUNT_SIGNAL_TIMEOUT_MS ?? 5000);
  const maxPages = Math.max(1, Math.floor(Number(process.env.CRM_ACCOUNT_SIGNAL_MAX_PAGES ?? 1)));
  const signal: CrmAccountSignal = { recipientRefs: new Set(), signalCount: 0, matchedSignalCount: 0 };
  let cursor: string | undefined;
  let lastEndpoint = "";

  for (let page = 0; page < maxPages; page += 1) {
    lastEndpoint = crmUrl.replace(/\/$/, "") + withCrmAccountSignalQuery(path, segment, campaign, cursor);
    const response = await axios.get(lastEndpoint, {
      timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 5000,
      headers: crmAccountRequestHeaders()
    });

    for (const raw of extractItems(response.data)) {
      const item = validateCrmAccountSignalEnvelope(raw, campaign);
      signal.signalCount += 1;
      if (!matchesCrmAccountRules(item, segment)) {
        continue;
      }
      signal.matchedSignalCount += 1;
      addCrmContactRefs(signal, item);
    }

    cursor = extractNextCursor(response.data);
    if (!cursor) break;
  }

  logDecision("recipient_source_resolved", {
    campaignId: campaign.campaignId,
    segmentId: segment.segmentId,
    source: "crm_accounts",
    signalCount: signal.signalCount,
    matchedSignalCount: signal.matchedSignalCount,
    recipientRefCount: signal.recipientRefs.size,
    endpoint: lastEndpoint
  });
  return signal;
}

function crmAccountPreviewEvidence(signal: CrmAccountSignal): SourceFailure | undefined {
  if (signal.signalCount === 0) {
    return { source: "crm_accounts", reason: "crm_account_no_source_signals", status: "skipped" };
  }
  if (signal.matchedSignalCount === 0) {
    return { source: "crm_accounts", reason: "crm_account_no_matching_accounts", status: "skipped" };
  }
  if (signal.recipientRefs.size === 0) {
    return { source: "crm_accounts", reason: "crm_account_no_resolvable_contact_refs", status: "skipped" };
  }
  return undefined;
}

async function fetchApplicationSignal(segment: Segment, campaign: Campaign): Promise<ApplicationSignal> {
  const signalUrl = process.env.APPLICATION_SIGNAL_SOURCE_URL;
  if (!signalUrl) {
    throw new Error("application_signal_source_url_missing");
  }

  const path = process.env.APPLICATION_SIGNAL_SOURCE_PATH ?? APPLICATION_SIGNALS_DEFAULT_PATH;
  const endpoint = `${signalUrl.replace(/\/$/, "")}${withApplicationSignalQuery(path, segment, campaign)}`;
  const timeout = Number(process.env.APPLICATION_SIGNAL_SOURCE_TIMEOUT_MS ?? 5000);
  const response = await axios.get(endpoint, {
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 5000,
    headers: applicationSignalRequestHeaders()
  });

  const signal: ApplicationSignal = { recipientRefs: new Set(), signalCount: 0, matchedSignalCount: 0 };
  let matchedSignalCount = 0;
  for (const raw of extractItems(response.data)) {
    const item = validateApplicationSignalEnvelope(raw, campaign);
    signal.signalCount += 1;
    if (!matchesApplicationSignalRules(item, segment)) {
      continue;
    }
    matchedSignalCount += 1;
    const recipientRef = toAppSignalRecipientRef(appSignalSubjectRef(item));
    if (recipientRef) signal.recipientRefs.add(recipientRef);
  }
  signal.matchedSignalCount = matchedSignalCount;

  logDecision("recipient_source_resolved", {
    campaignId: campaign.campaignId,
    segmentId: segment.segmentId,
    source: "app_signals",
    signalCount: signal.signalCount,
    matchedSignalCount,
    recipientRefCount: signal.recipientRefs.size,
    endpoint
  });
  return signal;
}

function appSignalPreviewEvidence(signal: ApplicationSignal): SourceFailure | undefined {
  if (signal.signalCount === 0) {
    return { source: "app_signals", reason: "app_signals_no_source_signals", status: "skipped" };
  }
  if (signal.matchedSignalCount === 0) {
    return { source: "app_signals", reason: "app_signals_no_matching_signals", status: "skipped" };
  }
  if (signal.recipientRefs.size === 0) {
    return { source: "app_signals", reason: "app_signals_no_resolvable_subject_refs", status: "skipped" };
  }
  return undefined;
}

async function fetchAuthRecipients(segment: Segment, campaign: Campaign): Promise<Contact[]> {
  const authUrl = process.env.AUTH_SERVICE_URL;
  if (!authUrl) {
    const fixtureRecipients = await resolveTestFixtureRecipients(segment, "auth");
    if (fixtureRecipients) {
      logDecision("recipient_source_test_fixture", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "auth",
        recipientCount: fixtureRecipients.length,
        reason: "test_fixture_enabled"
      });
      return fixtureRecipients;
    }
    throw new Error("auth_service_url_missing");
  }

  const path = process.env.AUTH_USERS_SEGMENT_PATH ?? AUTH_USERS_DEFAULT_PATH;
  const endpoint = `${authUrl.replace(/\/$/, "")}${withAuthRecipientQuery(path, segment, campaign)}`;
  const response = await axios.get(endpoint, {
    timeout: 5000,
    headers: authRequestHeaders()
  });
  const mapped = extractRecipientItems(response.data, "auth")
    .map((item) => toAuthContact(item, campaign))
    .filter((contact): contact is Contact => contact !== null);

  logDecision("recipient_source_resolved", {
    campaignId: campaign.campaignId,
    segmentId: segment.segmentId,
    source: "auth",
    recipientCount: mapped.length,
    endpoint
  });
  return mapped;
}

async function fetchLeadRecipients(segment: Segment, campaign: Campaign): Promise<Contact[]> {
  const leadsUrl = process.env.LEADS_SERVICE_URL;
  if (!leadsUrl) {
    const fixtureRecipients = await resolveTestFixtureRecipients(segment, "leads");
    if (fixtureRecipients) {
      logDecision("recipient_source_test_fixture", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "leads",
        recipientCount: fixtureRecipients.length,
        reason: "test_fixture_enabled"
      });
      return fixtureRecipients;
    }
    throw new Error("leads_service_url_missing");
  }

  const path = process.env.LEADS_SEGMENT_PATH ?? LEADS_DEFAULT_PATH;
  const endpoint = `${leadsUrl.replace(/\/$/, "")}${withLeadsRecipientQuery(path, segment, campaign)}`;
  const response = await axios.get(endpoint, {
    timeout: 5000,
    headers: leadsRequestHeaders()
  });
  const mapped = extractRecipientItems(response.data, "leads")
    .map((item) => toLeadContact(item, campaign))
    .filter((contact): contact is Contact => contact !== null);

  logDecision("recipient_source_resolved", {
    campaignId: campaign.campaignId,
    segmentId: segment.segmentId,
    source: "leads",
    recipientCount: mapped.length,
    endpoint
  });
  return mapped;
}

function addProductSignal(productSignal: ProductSignal, item: unknown): void {
  if (!isRecord(item)) {
    return;
  }
  addStringValue(productSignal.productIds, readString(item, ["id", "productId"]));
  addStringValue(productSignal.skus, readString(item, ["sku"]));
}

async function fetchCatalogSignal(segment: Segment, campaign: Campaign): Promise<ProductSignal | undefined> {
  if (!hasCatalogRule(segment)) {
    return undefined;
  }

  const catalogUrl = process.env.CATALOG_SERVICE_URL;
  if (!catalogUrl) {
    throw new Error("catalog_service_url_missing");
  }

  const baseUrl = catalogUrl.replace(/\/$/, "");
  const path = process.env.CATALOG_PRODUCTS_PATH ?? CATALOG_PRODUCTS_DEFAULT_PATH;
  const productSignal: ProductSignal = { productIds: new Set(), skus: new Set() };
  const productId = readRule(segment, ["catalogProductId"]);
  const sku = readRule(segment, ["catalogSku"]);
  let endpoint: string;

  if (productId) {
    endpoint = `${baseUrl}${path}/${encodeURIComponent(productId)}`;
    const response = await axios.get(endpoint, { timeout: 5000, headers: catalogRequestHeaders() });
    addProductSignal(productSignal, extractRecord(response.data));
  } else if (sku) {
    endpoint = `${baseUrl}${path}/sku/${encodeURIComponent(sku)}`;
    const response = await axios.get(endpoint, { timeout: 5000, headers: catalogRequestHeaders() });
    addProductSignal(productSignal, extractRecord(response.data));
  } else {
    endpoint = `${baseUrl}${withCatalogProductsQuery(path, segment)}`;
    const response = await axios.get(endpoint, { timeout: 5000, headers: catalogRequestHeaders() });
    for (const item of extractItems(response.data)) {
      addProductSignal(productSignal, item);
    }
  }

  logDecision("recipient_source_resolved", {
    campaignId: campaign.campaignId,
    segmentId: segment.segmentId,
    source: "catalog",
    productIdCount: productSignal.productIds.size,
    skuCount: productSignal.skus.size,
    endpoint
  });
  return productSignal;
}

function orderMatchesProductSignal(order: UnknownRecord, segment: Segment, productSignal?: ProductSignal): boolean {
  const explicitProductId = normalizeToken(readRule(segment, ["productId", "orderProductId"]));
  const explicitSku = normalizeToken(readRule(segment, ["sku", "orderSku", "productSku"]));
  const hasProductConstraint =
    Boolean(explicitProductId || explicitSku) ||
    Boolean(productSignal && (productSignal.productIds.size > 0 || productSignal.skus.size > 0));

  if (!hasProductConstraint) {
    return true;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  return items.some((item) => {
    if (!isRecord(item)) {
      return false;
    }
    const itemProductId = normalizeToken(readString(item, ["productId", "catalogProductId"]));
    const itemSku = normalizeToken(readString(item, ["sku"]));
    return (
      Boolean(explicitProductId && itemProductId === explicitProductId) ||
      Boolean(explicitSku && itemSku === explicitSku) ||
      Boolean(itemProductId && productSignal?.productIds.has(itemProductId)) ||
      Boolean(itemSku && productSignal?.skus.has(itemSku))
    );
  });
}

function addOrderRecipientSignal(signal: OrderSignal, order: UnknownRecord): void {
  const authId =
    readString(order, ["authUserId", "userId", "registeredUserId", "customerId"]) ??
    readNestedString(order, "customer", ["authUserId", "userId", "registeredUserId", "customerId"]);
  const leadId = readString(order, ["leadId"]) ?? readNestedString(order, "customer", ["leadId"]);
  const email = readString(order, ["email"]) ?? readNestedString(order, "customer", ["email"]);
  const phone = readString(order, ["phone", "phoneNumber"]) ?? readNestedString(order, "customer", ["phone", "phoneNumber"]);

  if (authId) {
    signal.recipientRefs.add(`auth:${authId}`);
  }
  if (leadId) {
    signal.recipientRefs.add(`lead:${leadId}`);
  }
  addStringValue(signal.emails, email);
  addStringValue(signal.phones, phone);
}

async function fetchOrderSignal(segment: Segment, campaign: Campaign, productSignal?: ProductSignal): Promise<OrderSignal> {
  const ordersUrl = process.env.ORDERS_SERVICE_URL;
  if (!ordersUrl) {
    throw new Error("orders_service_url_missing");
  }

  const path = process.env.ORDER_SIGNAL_PATH ?? ORDERS_DEFAULT_PATH;
  const endpoint = `${ordersUrl.replace(/\/$/, "")}${withOrderSignalQuery(path, segment)}`;
  const response = await axios.get(endpoint, {
    timeout: 5000,
    headers: ordersRequestHeaders()
  });

  const signal: OrderSignal = {
    recipientRefs: new Set(),
    emails: new Set(),
    phones: new Set()
  };
  let matchedOrderCount = 0;
  for (const item of extractItems(response.data)) {
    if (!isRecord(item) || !orderMatchesProductSignal(item, segment, productSignal)) {
      continue;
    }
    matchedOrderCount += 1;
    addOrderRecipientSignal(signal, item);
  }

  logDecision("recipient_source_resolved", {
    campaignId: campaign.campaignId,
    segmentId: segment.segmentId,
    source: "orders",
    matchedOrderCount,
    recipientRefCount: signal.recipientRefs.size,
    emailSignalCount: signal.emails.size,
    phoneSignalCount: signal.phones.size,
    endpoint
  });
  return signal;
}

type TestRecipientFixtureProvider = () => Contact[];

let testRecipientFixtureProvider: TestRecipientFixtureProvider | undefined;

export function setTestRecipientFixtureProviderForTest(provider: TestRecipientFixtureProvider | undefined): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("test_recipient_fixture_provider_is_test_only");
  }
  testRecipientFixtureProvider = provider;
}

function testRecipientFixturesEnabled(): boolean {
  return process.env.NODE_ENV === "test" && process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES === "true";
}

async function resolveTestFixtureRecipients(segment: Segment, owner: Contact["owner"]): Promise<Contact[] | undefined> {
  if (!testRecipientFixturesEnabled() || !testRecipientFixtureProvider) {
    return undefined;
  }

  const ownerFilter = segment.rules.owner as string | undefined;
  return testRecipientFixtureProvider().filter((contact) => contact.owner === owner && (!ownerFilter || ownerFilter === owner));
}

function toRecipientRef(contact: Contact): string {
  return `${contact.owner === "auth" ? "auth" : "lead"}:${contact.id}`;
}

function recipientIdentityKey(contact: Contact): string {
  if (contact.owner === "auth") {
    return `auth:${contact.id}`;
  }
  if (contact.identityLinks?.authUserId) {
    return `auth:${contact.identityLinks.authUserId}`;
  }
  return `lead:${contact.id}`;
}

function matchesOrderSignal(contact: Contact, signal: OrderSignal): boolean {
  const email = normalizeToken(contact.email);
  const phone = normalizeToken(contact.phone);
  return (
    signal.recipientRefs.has(toRecipientRef(contact)) ||
    Boolean(email && signal.emails.has(email)) ||
    Boolean(phone && signal.phones.has(phone))
  );
}

function matchesApplicationSignal(contact: Contact, signal: ApplicationSignal): boolean {
  return signal.recipientRefs.has(toRecipientRef(contact));
}

export async function resolveSegmentRecipients(segment: Segment, campaign: Campaign): Promise<RecipientResolution> {
  const recipients: Contact[] = [];
  const failures: SourceFailure[] = [];
  const requiresOrderSignal = segment.sourceTypes.includes("orders");
  const requiresApplicationSignal = segment.sourceTypes.includes("app_signals");
  const requiresCrmAccountSignal = segment.sourceTypes.includes("crm_accounts");
  let orderSignal: OrderSignal | undefined;
  let applicationSignal: ApplicationSignal | undefined;
  let crmAccountSignal: CrmAccountSignal | undefined;

  if (requiresCrmAccountSignal) {
    try {
      crmAccountSignal = await fetchCrmAccountSignal(segment, campaign);
      const previewEvidence = crmAccountPreviewEvidence(crmAccountSignal);
      if (previewEvidence) {
        failures.push(previewEvidence);
        logDecision("recipient_source_preview", {
          campaignId: campaign.campaignId,
          segmentId: segment.segmentId,
          source: "crm_accounts",
          signalCount: crmAccountSignal.signalCount,
          matchedSignalCount: crmAccountSignal.matchedSignalCount,
          recipientRefCount: crmAccountSignal.recipientRefs.size,
          reason: previewEvidence.reason,
          duration_ms: 0
        });
        return { recipients: [], failures };
      }
    } catch (error) {
      const message = (error as Error).message;
      failures.push({ source: "crm_accounts", reason: "crm_account_source_unavailable:" + message });
      logDecision("recipient_source_failed", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "crm_accounts",
        reason: message
      });
      return { recipients: [], failures };
    }
  }

  if (requiresApplicationSignal) {
    try {
      applicationSignal = await fetchApplicationSignal(segment, campaign);
      const previewEvidence = appSignalPreviewEvidence(applicationSignal);
      if (previewEvidence) {
        failures.push(previewEvidence);
        logDecision("recipient_source_preview", {
          campaignId: campaign.campaignId,
          segmentId: segment.segmentId,
          source: "app_signals",
          signalCount: applicationSignal.signalCount,
          matchedSignalCount: applicationSignal.matchedSignalCount,
          recipientRefCount: applicationSignal.recipientRefs.size,
          reason: previewEvidence.reason,
          duration_ms: 0
        });
        return { recipients: [], failures };
      }
    } catch (error) {
      const message = (error as Error).message;
      failures.push({ source: "app_signals", reason: `app_signals_source_unavailable:${message}` });
      logDecision("recipient_source_failed", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "app_signals",
        reason: message
      });
      return { recipients: [], failures };
    }
  }

  if (requiresOrderSignal) {
    let productSignal: ProductSignal | undefined;
    try {
      productSignal = await fetchCatalogSignal(segment, campaign);
    } catch (error) {
      const message = (error as Error).message;
      failures.push({ source: "catalog", reason: `catalog_source_unavailable:${message}` });
      logDecision("recipient_source_failed", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "catalog",
        reason: message
      });
      return { recipients: [], failures };
    }

    try {
      orderSignal = await fetchOrderSignal(segment, campaign, productSignal);
    } catch (error) {
      const message = (error as Error).message;
      failures.push({ source: "orders", reason: `orders_source_unavailable:${message}` });
      logDecision("recipient_source_failed", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "orders",
        reason: message
      });
      return { recipients: [], failures };
    }
  }

  const signalOnly = requiresOrderSignal || requiresApplicationSignal || requiresCrmAccountSignal;
  const shouldResolveAuth = segment.sourceTypes.includes("auth_users") || (signalOnly && !segment.sourceTypes.includes("leads"));
  const shouldResolveLeads = segment.sourceTypes.includes("leads") || (signalOnly && !segment.sourceTypes.includes("auth_users"));

  if (shouldResolveAuth) {
    try {
      recipients.push(...(await fetchAuthRecipients(segment, campaign)));
    } catch (error) {
      const message = (error as Error).message;
      failures.push({ source: "auth", reason: `auth_source_unavailable:${message}` });
      logDecision("recipient_source_failed", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "auth",
        reason: message
      });
    }
  }

  if (shouldResolveLeads) {
    try {
      recipients.push(...(await fetchLeadRecipients(segment, campaign)));
    } catch (error) {
      const message = (error as Error).message;
      failures.push({ source: "leads", reason: `leads_source_unavailable:${message}` });
      logDecision("recipient_source_failed", {
        campaignId: campaign.campaignId,
        segmentId: segment.segmentId,
        source: "leads",
        reason: message
      });
    }
  }

  const deduped = new Map<string, Contact>();
  for (const recipient of recipients) {
    if (orderSignal && !matchesOrderSignal(recipient, orderSignal)) {
      continue;
    }
    if (applicationSignal && !matchesApplicationSignal(recipient, applicationSignal)) {
      continue;
    }
    if (crmAccountSignal && !matchesApplicationSignal(recipient, crmAccountSignal)) {
      continue;
    }
    const identityKey = recipientIdentityKey(recipient);
    const existing = deduped.get(identityKey);
    if (!existing || (existing.owner === "leads" && recipient.owner === "auth")) {
      deduped.set(identityKey, recipient);
    }
  }
  return { recipients: Array.from(deduped.values()), failures };
}
