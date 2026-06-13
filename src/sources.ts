import axios from "axios";
import { logDecision } from "./logger";
import { Campaign, Channel, Contact, ResultSource, Segment } from "./types";

const AUTH_USERS_DEFAULT_PATH = "/auth/marketing/recipients";
const LEADS_DEFAULT_PATH = "/leads/marketing/recipients";
const ORDERS_DEFAULT_PATH = "/api/orders";
const CATALOG_PRODUCTS_DEFAULT_PATH = "/api/products";

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

export interface RecipientResolution {
  recipients: Contact[];
  failures: SourceFailure[];
}

export interface SourceFailure {
  source: ResultSource;
  reason: string;
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

    for (const scoped of [
      candidate[campaign.purpose],
      candidate.marketing,
      candidate[campaign.tenantId],
      candidate[campaign.tenant],
      candidate[campaign.appId],
      candidate["*"]
    ]) {
      const value = consentValueAt(scoped, channel);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function hasMarketingConsent(record: UnknownRecord, campaign: Campaign): boolean {
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
  return (
    truthyConsentValue(consents.marketing) ||
    truthyConsentValue(consents[campaign.purpose]) ||
    truthyConsentValue(consents[campaign.tenantId]) ||
    truthyConsentValue(consents[campaign.tenant]) ||
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
  for (const key of ["users", "leads", "items", "data", "results", "recipients"]) {
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
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function ordersRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.ORDERS_SERVICE_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function catalogRequestHeaders(): Record<string, string> | undefined {
  const token = process.env.CATALOG_SERVICE_TOKEN;
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

export async function resolveSegmentRecipients(segment: Segment, campaign: Campaign): Promise<RecipientResolution> {
  const recipients: Contact[] = [];
  const failures: SourceFailure[] = [];
  const requiresOrderSignal = segment.sourceTypes.includes("orders");
  let orderSignal: OrderSignal | undefined;

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

  const shouldResolveAuth = segment.sourceTypes.includes("auth_users") || (requiresOrderSignal && !segment.sourceTypes.includes("leads"));
  const shouldResolveLeads = segment.sourceTypes.includes("leads") || (requiresOrderSignal && !segment.sourceTypes.includes("auth_users"));

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
    const identityKey = recipientIdentityKey(recipient);
    const existing = deduped.get(identityKey);
    if (!existing || (existing.owner === "leads" && recipient.owner === "auth")) {
      deduped.set(identityKey, recipient);
    }
  }
  return { recipients: Array.from(deduped.values()), failures };
}
