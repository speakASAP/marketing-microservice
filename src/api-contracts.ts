import { Request, Response, NextFunction } from "express";
import { Campaign, CampaignFamily, CampaignLifecycleStage, CampaignStatus, Channel, ContactOwner, HolidayDiscountCampaignContentContract, HolidayDiscountContentSlot, Journey, JourneyExitRuleType, JourneyStatus, JourneySuppressionRuleType, JourneyTriggerType, Purpose, ProductionRiskClass, RegistryEnvironment, Segment, SegmentSource } from "./types";

const CHANNELS: Channel[] = ["email", "telegram", "whatsapp"];
const PURPOSES: Purpose[] = ["marketing", "retention", "transactional-not-marketing"];
const SEGMENT_SOURCES: SegmentSource[] = ["auth_users", "leads", "orders", "app_signals", "crm_accounts"];
const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "scheduled", "running", "paused", "completed", "failed", "archived"];
const JOURNEY_STATUSES: JourneyStatus[] = ["draft", "active", "paused", "archived"];
const JOURNEY_TRIGGER_TYPES: JourneyTriggerType[] = ["manual", "segment_entry", "app_signal"];
const JOURNEY_EXIT_RULE_TYPES: JourneyExitRuleType[] = ["segment_match", "app_signal", "campaign_engagement", "manual"];
const JOURNEY_SUPPRESSION_RULE_TYPES: JourneySuppressionRuleType[] = ["recently_sent", "frequency_cap", "unsubscribed", "segment_match"];
const CAMPAIGN_LIFECYCLE_STAGES: CampaignLifecycleStage[] = [
  "acquisition",
  "activation",
  "onboarding",
  "education",
  "feature_adoption",
  "retention",
  "reactivation",
  "winback",
  "renewal",
  "upsell",
  "cross_sell",
  "post_purchase",
  "abandoned_intent",
  "operational_notice"
];
const PRODUCTION_RISK_CLASSES: ProductionRiskClass[] = ["low", "standard", "high", "restricted"];
const CAMPAIGN_FAMILIES: CampaignFamily[] = [
  "acquisition",
  "activation",
  "onboarding",
  "education",
  "feature_adoption",
  "retention",
  "reactivation",
  "winback",
  "renewal",
  "upsell",
  "cross_sell",
  "post_purchase",
  "abandoned_intent",
  "operational_notice"
];
const READ_ONLY_APPROVAL_FIELDS = ["approvalStatus", "approvedBy", "approvedAt", "approvalNote"];
const REGISTRY_ENVIRONMENTS: RegistryEnvironment[] = ["production", "staging", "development", "test"];
const REQUIRED_SCOPE_FIELDS = ["tenantId", "appId", "brandId"] as const;
const OPTIONAL_SCOPE_FIELDS = ["businessId", "defaultLocale", "timezone", "productLine", "lifecycleScope", "legalSenderIdentity", "policyRef"] as const;

const HOLIDAY_DISCOUNT_PROCESS_ID = "holiday-discount-2026";
const HOLIDAY_DISCOUNT_PROCESS_VERSION = 1;
const HOLIDAY_DISCOUNT_POLICY_REF = "holiday-10-percent-selected-categories";
const HOLIDAY_DISCOUNT_CAMPAIGN_REF = "holiday-2026-main";
const HOLIDAY_DISCOUNT_CONTENT_SLOTS: HolidayDiscountContentSlot[] = ["product_badge", "cart_banner", "upsell_block", "post_purchase_message"];
const FORBIDDEN_CONTENT_CONTRACT_FIELDS = ["execute", "execution", "delivery", "deliveryProvider", "provider", "providerCredentials", "send", "scheduleAt", "status", "approvalStatus", "dryRun", "price", "discount", "cart", "checkout"] as const;

export type ContractError = {
  error: string;
  message: string;
  fields?: Record<string, string>;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ContractError };

export type PreferenceUnsubscribeRequest = {
  owner: ContactOwner;
  recipientId: string;
  channel?: Channel;
  purpose?: Purpose;
  tenantId?: string;
  appId?: string;
  brandId?: string;
  requestId?: string;
  reason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isValidIsoDate(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function contractError(error: string, message: string, fields?: Record<string, string>): ContractError {
  return fields && Object.keys(fields).length > 0 ? { error, message, fields } : { error, message };
}

export function sendContractError(res: Response, status: number, error: ContractError): Response {
  return res.status(status).json(error);
}

function validateStringArray(value: unknown, allowed: readonly string[], field: string, required: boolean, fields: Record<string, string>): string[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
    fields[field] = required ? "required_non_empty_string_array" : "must_be_non_empty_string_array";
    return undefined;
  }
  const invalid = value.find((item) => !allowed.includes(String(item)));
  if (invalid) {
    fields[field] = `unsupported_value:${invalid}`;
    return undefined;
  }
  return value.map(String);
}

function validateOptionalPositiveInteger(value: unknown, field: string, fields: Record<string, string>): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fields[field] = "must_be_positive_integer";
    return undefined;
  }
  return value;
}

function validateScopeFields(body: Record<string, unknown>, partial: boolean, value: Partial<Campaign> | Partial<Segment>, fields: Record<string, string>): void {
  for (const field of REQUIRED_SCOPE_FIELDS) {
    if (body[field] !== undefined || !partial) {
      if (!isNonEmptyString(body[field])) fields[field] = "required_non_empty_string";
      else (value as Record<string, unknown>)[field] = body[field].trim();
    }
  }
  for (const field of OPTIONAL_SCOPE_FIELDS) {
    if (body[field] !== undefined) {
      if (body[field] !== null && !isNonEmptyString(body[field])) fields[field] = "must_be_non_empty_string_or_null";
      else (value as Record<string, unknown>)[field] = body[field] === null ? null : String(body[field]).trim();
    }
  }
  if (body.environment !== undefined) {
    if (body.environment !== null && !REGISTRY_ENVIRONMENTS.includes(body.environment as RegistryEnvironment)) fields.environment = "unsupported_value:" + String(body.environment);
    else (value as Record<string, unknown>).environment = body.environment as RegistryEnvironment | null;
  }
}

export function scopeMatchesQuery(value: Campaign | Segment, query: Record<string, unknown>): boolean {
  for (const field of ["tenantId", "appId", "brandId", "businessId", "productLine", "lifecycleScope", "environment"] as const) {
    const expected = query[field];
    if (expected !== undefined && String(value[field] ?? "") !== String(expected)) return false;
  }
  return true;
}

function validateOptionalNonNegativeInteger(value: unknown, field: string, fields: Record<string, string>): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fields[field] = "must_be_non_negative_integer";
    return undefined;
  }
  return value;
}

function readOptionalStringField(record: Record<string, unknown>, key: string, field: string, fields: Record<string, string>): string | null | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isNonEmptyString(value)) {
    fields[field] = "must_be_non_empty_string_or_null";
    return undefined;
  }
  return value.trim();
}

function validateCatalogMetadata(value: unknown, fields: Record<string, string>): Campaign["catalogMetadata"] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value)) {
    fields.catalogMetadata = "must_be_object_or_null";
    return undefined;
  }

  const readOnlyExecutionFields = ["approvalStatus", "approvedBy", "approvedAt", "status", "scheduleAt", "execute", "dryRun"] as const;
  for (const field of readOnlyExecutionFields) {
    if (value[field] !== undefined) {
      fields[`catalogMetadata.${field}`] = "not_catalog_metadata";
    }
  }

  const metadata: NonNullable<Campaign["catalogMetadata"]> = {};
  const campaignFamily = readOptionalStringField(value, "campaignFamily", "catalogMetadata.campaignFamily", fields);
  if (campaignFamily !== undefined) {
    if (campaignFamily !== null && !CAMPAIGN_FAMILIES.includes(campaignFamily as CampaignFamily)) {
      fields["catalogMetadata.campaignFamily"] = `unsupported_value:${campaignFamily}`;
    } else {
      metadata.campaignFamily = campaignFamily as CampaignFamily | null;
    }
  }

  const lifecycleStage = readOptionalStringField(value, "lifecycleStage", "catalogMetadata.lifecycleStage", fields);
  if (lifecycleStage !== undefined) {
    if (lifecycleStage !== null && !CAMPAIGN_LIFECYCLE_STAGES.includes(lifecycleStage as CampaignLifecycleStage)) {
      fields["catalogMetadata.lifecycleStage"] = `unsupported_value:${lifecycleStage}`;
    } else {
      metadata.lifecycleStage = lifecycleStage as CampaignLifecycleStage | null;
    }
  }

  for (const key of ["audienceKey", "audienceLabel", "catalogCategory", "sourceBlueprintId"] as const) {
    const normalized = readOptionalStringField(value, key, `catalogMetadata.${key}`, fields);
    if (normalized !== undefined) {
      metadata[key] = normalized;
    }
  }

  if (value.catalogTags !== undefined) {
    if (!Array.isArray(value.catalogTags) || value.catalogTags.some((item) => !isNonEmptyString(item))) {
      fields["catalogMetadata.catalogTags"] = "must_be_string_array";
    } else {
      metadata.catalogTags = value.catalogTags.map((item) => item.trim());
    }
  }

  if (value.governance !== undefined) {
    const governance = validateProductionGovernanceMetadata(value.governance, fields);
    if (governance !== undefined) metadata.governance = governance;
  }

  return metadata;
}

function validateProductionGovernanceMetadata(value: unknown, fields: Record<string, string>): NonNullable<Campaign["catalogMetadata"]>["governance"] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value)) {
    fields["catalogMetadata.governance"] = "must_be_object_or_null";
    return undefined;
  }

  const governance: NonNullable<NonNullable<Campaign["catalogMetadata"]>["governance"]> = {};
  if (value.riskClass !== undefined) {
    if (value.riskClass !== null && !PRODUCTION_RISK_CLASSES.includes(value.riskClass as ProductionRiskClass)) fields["catalogMetadata.governance.riskClass"] = `unsupported_value:${String(value.riskClass)}`;
    else governance.riskClass = value.riskClass as ProductionRiskClass | null;
  }
  if (value.riskReasons !== undefined) {
    if (!Array.isArray(value.riskReasons) || value.riskReasons.some((item) => !isNonEmptyString(item))) fields["catalogMetadata.governance.riskReasons"] = "must_be_string_array";
    else governance.riskReasons = value.riskReasons.map((item) => item.trim());
  }
  for (const key of ["riskPolicyRef", "dryRunRunId", "dryRunEvidenceRef", "readinessChecklistRef", "rollbackPlanRef", "businessApprover", "governanceApprover", "restrictedExceptionApprovedBy", "restrictedExceptionReason", "emergencyOverrideApprovedBy", "emergencyOverrideReason"] as const) {
    const normalized = readOptionalStringField(value, key, `catalogMetadata.governance.${key}`, fields);
    if (normalized !== undefined) governance[key] = normalized;
  }
  for (const key of ["dryRunReviewedAt", "restrictedExceptionExpiresAt", "emergencyOverrideExpiresAt"] as const) {
    const normalized = readOptionalStringField(value, key, `catalogMetadata.governance.${key}`, fields);
    if (normalized !== undefined) {
      if (normalized !== null && !isValidIsoDate(normalized)) fields[`catalogMetadata.governance.${key}`] = "must_be_iso_8601_utc_string_or_null";
      else governance[key] = normalized;
    }
  }
  const dryRunRecipientCount = validateOptionalNonNegativeInteger(value.dryRunRecipientCount, "catalogMetadata.governance.dryRunRecipientCount", fields);
  if (dryRunRecipientCount !== undefined) governance.dryRunRecipientCount = dryRunRecipientCount;
  return governance;
}


function validateContentRefMetadata(value: unknown, field: string, fields: Record<string, string>): Record<string, string | number | boolean | null> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    fields[field] = "must_be_object";
    return undefined;
  }
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_CONTENT_CONTRACT_FIELDS.includes(key as typeof FORBIDDEN_CONTENT_CONTRACT_FIELDS[number])) {
      fields[`${field}.${key}`] = "not_content_contract_metadata";
      continue;
    }
    if (item !== null && !["string", "number", "boolean"].includes(typeof item)) {
      fields[`${field}.${key}`] = "must_be_scalar_or_null";
      continue;
    }
    metadata[key] = item as string | number | boolean | null;
  }
  return metadata;
}

export function validateHolidayDiscountCampaignContentContract(value: unknown): ValidationResult<HolidayDiscountCampaignContentContract> {
  if (!isRecord(value)) {
    return { ok: false, error: contractError("invalid_content_contract", "Holiday Discount content contract must be a JSON object.") };
  }
  const fields: Record<string, string> = {};
  if (value.processId !== HOLIDAY_DISCOUNT_PROCESS_ID) fields.processId = "unsupported_value";
  if (value.processVersion !== HOLIDAY_DISCOUNT_PROCESS_VERSION) fields.processVersion = "unsupported_value";
  if (value.policyRef !== HOLIDAY_DISCOUNT_POLICY_REF) fields.policyRef = "unsupported_value";
  if (value.campaignRef !== HOLIDAY_DISCOUNT_CAMPAIGN_REF) fields.campaignRef = "unsupported_value";
  if (value.ownerService !== "marketing-microservice") fields.ownerService = "unsupported_value";
  if (!isNonEmptyString(value.blueprintId)) fields.blueprintId = "required_non_empty_string";

  for (const field of FORBIDDEN_CONTENT_CONTRACT_FIELDS) {
    if (value[field] !== undefined) fields[field] = "not_content_contract";
  }

  const contentRefs: HolidayDiscountCampaignContentContract["contentRefs"] = [];
  const seenSlots = new Set<string>();
  if (!Array.isArray(value.contentRefs) || value.contentRefs.length === 0) {
    fields.contentRefs = "required_non_empty_array";
  } else {
    value.contentRefs.forEach((item, index) => {
      const prefix = `contentRefs.${index}`;
      if (!isRecord(item)) {
        fields[prefix] = "must_be_object";
        return;
      }
      const slot = item.slot;
      if (!HOLIDAY_DISCOUNT_CONTENT_SLOTS.includes(slot as HolidayDiscountContentSlot)) {
        fields[`${prefix}.slot`] = `unsupported_value:${String(slot)}`;
      } else if (seenSlots.has(String(slot))) {
        fields[`${prefix}.slot`] = "duplicate_slot";
      } else {
        seenSlots.add(String(slot));
      }
      if (!isNonEmptyString(item.contentRef)) fields[`${prefix}.contentRef`] = "required_non_empty_string";
      if (item.templateRef !== undefined && item.templateRef !== null && !isNonEmptyString(item.templateRef)) fields[`${prefix}.templateRef`] = "must_be_non_empty_string_or_null";
      if (item.locale !== undefined && item.locale !== null && !isNonEmptyString(item.locale)) fields[`${prefix}.locale`] = "must_be_non_empty_string_or_null";
      for (const field of FORBIDDEN_CONTENT_CONTRACT_FIELDS) {
        if (item[field] !== undefined) fields[`${prefix}.${field}`] = "not_content_ref";
      }
      const metadata = validateContentRefMetadata(item.metadata, `${prefix}.metadata`, fields);
      if (HOLIDAY_DISCOUNT_CONTENT_SLOTS.includes(slot as HolidayDiscountContentSlot) && isNonEmptyString(item.contentRef)) {
        contentRefs.push({
          slot: slot as HolidayDiscountContentSlot,
          contentRef: item.contentRef.trim(),
          templateRef: item.templateRef === undefined ? undefined : item.templateRef === null ? null : String(item.templateRef).trim(),
          locale: item.locale === undefined ? undefined : item.locale === null ? null : String(item.locale).trim(),
          ...(metadata !== undefined ? { metadata } : {})
        });
      }
    });
  }

  for (const slot of HOLIDAY_DISCOUNT_CONTENT_SLOTS) {
    if (!seenSlots.has(slot)) fields[`contentRefs.${slot}`] = "required_slot";
  }

  let unresolved: string[] = [];
  if (!Array.isArray(value.unresolved) || value.unresolved.some((item) => !isNonEmptyString(item))) {
    fields.unresolved = "required_string_array";
  } else {
    unresolved = value.unresolved.map((item) => item.trim());
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_holiday_discount_content_contract", "Holiday Discount content contract failed validation.", fields) };
  }

  return {
    ok: true,
    value: {
      processId: HOLIDAY_DISCOUNT_PROCESS_ID,
      processVersion: HOLIDAY_DISCOUNT_PROCESS_VERSION,
      policyRef: HOLIDAY_DISCOUNT_POLICY_REF,
      campaignRef: HOLIDAY_DISCOUNT_CAMPAIGN_REF,
      blueprintId: String(value.blueprintId).trim(),
      ownerService: "marketing-microservice",
      contentRefs,
      unresolved
    }
  };
}

export function validateSegmentBody(body: unknown, partial = false): ValidationResult<Partial<Segment>> {
  if (!isRecord(body)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }

  const fields: Record<string, string> = {};
  const value: Partial<Segment> = {};

  if (body.segmentId !== undefined) fields.segmentId = "read_only";

  validateScopeFields(body, partial, value, fields);

  if (body.name !== undefined || !partial) {
    if (!isNonEmptyString(body.name)) fields.name = "required_non_empty_string";
    else value.name = body.name.trim();
  }

  if (body.sourceTypes !== undefined || !partial) {
    const sourceTypes = validateStringArray(body.sourceTypes, SEGMENT_SOURCES, "sourceTypes", true, fields) as SegmentSource[] | undefined;
    if (sourceTypes) value.sourceTypes = sourceTypes;
  }

  if (body.rules !== undefined || !partial) {
    if (!isRecord(body.rules)) fields.rules = "required_object";
    else value.rules = body.rules as Segment["rules"];
  }

  if (body.isDynamic !== undefined || !partial) {
    if (!isBoolean(body.isDynamic)) fields.isDynamic = "required_boolean";
    else value.isDynamic = body.isDynamic;
  }

  if (body.estimatedCount !== undefined) {
    if (body.estimatedCount !== null && (typeof body.estimatedCount !== "number" || !Number.isInteger(body.estimatedCount) || body.estimatedCount < 0)) {
      fields.estimatedCount = "must_be_non_negative_integer_or_null";
    } else {
      value.estimatedCount = body.estimatedCount as number | null;
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_segment_request", "Segment request failed contract validation.", fields) };
  }
  return { ok: true, value };
}

export function validateCampaignBody(body: unknown, partial = false): ValidationResult<Partial<Campaign>> {
  if (!isRecord(body)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }

  const fields: Record<string, string> = {};
  const value: Partial<Campaign> = {};

  for (const field of READ_ONLY_APPROVAL_FIELDS) {
    if (body[field] !== undefined) fields[field] = "read_only_use_approve_endpoint";
  }
  if (body.campaignId !== undefined) fields.campaignId = "read_only";
  if (body.createdAt !== undefined) fields.createdAt = "read_only";
  if (body.updatedAt !== undefined) fields.updatedAt = "read_only";

  validateScopeFields(body, partial, value, fields);

  for (const field of ["tenant", "name", "segmentId", "templateRef"] as const) {
    if (body[field] !== undefined || !partial) {
      if (!isNonEmptyString(body[field])) fields[field] = "required_non_empty_string";
      else value[field] = body[field].trim();
    }
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") fields.description = "must_be_string_or_null";
    else value.description = body.description as string | null;
  }

  if (body.purpose !== undefined) {
    if (!PURPOSES.includes(body.purpose as Purpose)) fields.purpose = `unsupported_value:${String(body.purpose)}`;
    else value.purpose = body.purpose as Purpose;
  }

  if (body.primaryChannel !== undefined) {
    if (!CHANNELS.includes(body.primaryChannel as Channel)) fields.primaryChannel = `unsupported_value:${String(body.primaryChannel)}`;
    else value.primaryChannel = body.primaryChannel as Channel;
  }

  if (body.fallbackChannels !== undefined) {
    const fallbackChannels = validateStringArray(body.fallbackChannels, CHANNELS, "fallbackChannels", false, fields) as Channel[] | undefined;
    if (fallbackChannels) value.fallbackChannels = fallbackChannels;
  }

  if (body.channelKey !== undefined) {
    if (body.channelKey !== null && !isNonEmptyString(body.channelKey)) fields.channelKey = "must_be_non_empty_string_or_null";
    else if (body.channelKey !== null) value.channelKey = body.channelKey;
  }

  if (body.scheduleAt !== undefined) {
    if (body.scheduleAt !== null && (!isNonEmptyString(body.scheduleAt) || !isValidIsoDate(body.scheduleAt))) fields.scheduleAt = "must_be_iso_8601_utc_string_or_null";
    else if (body.scheduleAt !== null) value.scheduleAt = body.scheduleAt;
  }

  const throttle = validateOptionalNonNegativeInteger(body.throttlePerMinute, "throttlePerMinute", fields);
  if (throttle !== undefined) value.throttlePerMinute = throttle;

  const frequencyCap = validateOptionalPositiveInteger(body.frequencyCapPerDay, "frequencyCapPerDay", fields);
  if (frequencyCap !== undefined && frequencyCap !== null) value.frequencyCapPerDay = frequencyCap;

  const catalogMetadata = validateCatalogMetadata(body.catalogMetadata, fields);
  if (catalogMetadata !== undefined) value.catalogMetadata = catalogMetadata;

  if (body.status !== undefined) {
    if (!CAMPAIGN_STATUSES.includes(body.status as CampaignStatus)) fields.status = `unsupported_value:${String(body.status)}`;
    else value.status = body.status as CampaignStatus;
  }

  if (body.message !== undefined || !partial) {
    if (!isRecord(body.message)) {
      fields.message = "required_object";
    } else if (!isNonEmptyString(body.message.body)) {
      fields["message.body"] = "required_non_empty_string";
    } else if (body.message.subject !== undefined && typeof body.message.subject !== "string") {
      fields["message.subject"] = "must_be_string";
    } else {
      value.message = {
        body: body.message.body.trim(),
        ...(body.message.subject !== undefined ? { subject: body.message.subject } : {})
      };
    }
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_campaign_request", "Campaign request failed contract validation.", fields) };
  }
  return { ok: true, value };
}


function validateRulesObject(value: unknown, field: string, fields: Record<string, string>): Record<string, string | number | boolean> | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value) || Object.values(value).some((item) => !["string", "number", "boolean"].includes(typeof item))) {
    fields[field] = "must_be_flat_object_or_null";
    return undefined;
  }
  return value as Record<string, string | number | boolean>;
}

function validateJourneyTrigger(value: unknown, fields: Record<string, string>): Journey["trigger"] | undefined {
  if (!isRecord(value)) {
    fields.trigger = "required_object";
    return undefined;
  }
  const trigger: Partial<Journey["trigger"]> = {};
  if (!JOURNEY_TRIGGER_TYPES.includes(value.type as JourneyTriggerType)) {
    fields["trigger.type"] = `unsupported_value:${String(value.type)}`;
  } else {
    trigger.type = value.type as JourneyTriggerType;
  }
  const segmentId = readOptionalStringField(value, "segmentId", "trigger.segmentId", fields);
  if (segmentId !== undefined) trigger.segmentId = segmentId;
  const rules = validateRulesObject(value.rules, "trigger.rules", fields);
  if (rules !== undefined) trigger.rules = rules;
  if ((trigger.type === "segment_entry") && !trigger.segmentId) {
    fields["trigger.segmentId"] = "required_for_segment_entry";
  }
  return trigger.type ? trigger as Journey["trigger"] : undefined;
}

function validateJourneySteps(value: unknown, fields: Record<string, string>): Journey["steps"] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    fields.steps = "required_non_empty_array";
    return undefined;
  }
  const seen = new Set<string>();
  const steps: Journey["steps"] = [];
  value.forEach((item, index) => {
    const prefix = `steps.${index}`;
    if (!isRecord(item)) {
      fields[prefix] = "must_be_object";
      return;
    }
    const step: Partial<Journey["steps"][number]> = {};
    for (const field of ["stepId", "name", "campaignId"] as const) {
      if (!isNonEmptyString(item[field])) fields[`${prefix}.${field}`] = "required_non_empty_string";
      else step[field] = item[field].trim();
    }
    if (step.stepId) {
      if (seen.has(step.stepId)) fields[`${prefix}.stepId`] = "duplicate_step_id";
      seen.add(step.stepId);
    }
    const delay = validateOptionalNonNegativeInteger(item.delayMinutes, `${prefix}.delayMinutes`, fields);
    if (delay === undefined || delay === null) fields[`${prefix}.delayMinutes`] = fields[`${prefix}.delayMinutes`] ?? "required_non_negative_integer";
    else step.delayMinutes = delay;
    const maxExecutions = validateOptionalPositiveInteger(item.maxExecutionsPerRecipient, `${prefix}.maxExecutionsPerRecipient`, fields);
    if (maxExecutions !== undefined) step.maxExecutionsPerRecipient = maxExecutions;
    const conditions = validateRulesObject(item.conditions, `${prefix}.conditions`, fields);
    if (conditions !== undefined) step.conditions = conditions;
    for (const readOnly of ["message", "templateRef", "channelKey", "execute", "dryRun", "approvalStatus"] as const) {
      if (item[readOnly] !== undefined) fields[`${prefix}.${readOnly}`] = "not_journey_step_metadata";
    }
    if (step.stepId && step.name && step.campaignId && step.delayMinutes !== undefined) steps.push(step as Journey["steps"][number]);
  });
  return steps;
}

function validateJourneyExitRules(value: unknown, fields: Record<string, string>): Journey["exitRules"] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fields.exitRules = "must_be_array";
    return undefined;
  }
  const rules: Journey["exitRules"] = [];
  value.forEach((item, index) => {
    const prefix = `exitRules.${index}`;
    if (!isRecord(item)) {
      fields[prefix] = "must_be_object";
      return;
    }
    const rule: Partial<Journey["exitRules"][number]> = {};
    if (!isNonEmptyString(item.ruleId)) fields[`${prefix}.ruleId`] = "required_non_empty_string";
    else rule.ruleId = item.ruleId.trim();
    if (!JOURNEY_EXIT_RULE_TYPES.includes(item.type as JourneyExitRuleType)) fields[`${prefix}.type`] = `unsupported_value:${String(item.type)}`;
    else rule.type = item.type as JourneyExitRuleType;
    for (const key of ["segmentId", "campaignId"] as const) {
      const normalized = readOptionalStringField(item, key, `${prefix}.${key}`, fields);
      if (normalized !== undefined) rule[key] = normalized;
    }
    const ruleBody = validateRulesObject(item.rules, `${prefix}.rules`, fields);
    if (ruleBody !== undefined) rule.rules = ruleBody;
    if (rule.ruleId && rule.type) rules.push(rule as Journey["exitRules"][number]);
  });
  return rules;
}

function validateJourneySuppressionRules(value: unknown, fields: Record<string, string>): Journey["suppressionRules"] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fields.suppressionRules = "must_be_array";
    return undefined;
  }
  const rules: Journey["suppressionRules"] = [];
  value.forEach((item, index) => {
    const prefix = `suppressionRules.${index}`;
    if (!isRecord(item)) {
      fields[prefix] = "must_be_object";
      return;
    }
    const rule: Partial<Journey["suppressionRules"][number]> = {};
    if (!isNonEmptyString(item.ruleId)) fields[`${prefix}.ruleId`] = "required_non_empty_string";
    else rule.ruleId = item.ruleId.trim();
    if (!JOURNEY_SUPPRESSION_RULE_TYPES.includes(item.type as JourneySuppressionRuleType)) fields[`${prefix}.type`] = `unsupported_value:${String(item.type)}`;
    else rule.type = item.type as JourneySuppressionRuleType;
    for (const key of ["segmentId", "campaignId"] as const) {
      const normalized = readOptionalStringField(item, key, `${prefix}.${key}`, fields);
      if (normalized !== undefined) rule[key] = normalized;
    }
    const windowMinutes = validateOptionalPositiveInteger(item.windowMinutes, `${prefix}.windowMinutes`, fields);
    if (windowMinutes !== undefined) rule.windowMinutes = windowMinutes;
    const ruleBody = validateRulesObject(item.rules, `${prefix}.rules`, fields);
    if (ruleBody !== undefined) rule.rules = ruleBody;
    if (rule.ruleId && rule.type) rules.push(rule as Journey["suppressionRules"][number]);
  });
  return rules;
}

export function validateJourneyBody(body: unknown, partial = false): ValidationResult<Partial<Journey>> {
  if (!isRecord(body)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }

  const fields: Record<string, string> = {};
  const value: Partial<Journey> = {};
  for (const field of ["journeyId", "status", "approvalStatus", "approvedBy", "approvedAt", "scheduleAt", "execute", "dryRun", "createdAt", "updatedAt"] as const) {
    if (body[field] !== undefined) fields[field] = "read_only";
  }

  validateScopeFields(body, partial, value, fields);

  if (body.name !== undefined || !partial) {
    if (!isNonEmptyString(body.name)) fields.name = "required_non_empty_string";
    else value.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") fields.description = "must_be_string_or_null";
    else value.description = body.description as string | null;
  }
  if (body.trigger !== undefined || !partial) {
    const trigger = validateJourneyTrigger(body.trigger, fields);
    if (trigger) value.trigger = trigger;
  }
  if (body.steps !== undefined || !partial) {
    const steps = validateJourneySteps(body.steps, fields);
    if (steps) value.steps = steps;
  }
  if (body.exitRules !== undefined || !partial) {
    const exitRules = validateJourneyExitRules(body.exitRules, fields);
    if (exitRules) value.exitRules = exitRules;
  }
  if (body.suppressionRules !== undefined || !partial) {
    const suppressionRules = validateJourneySuppressionRules(body.suppressionRules, fields);
    if (suppressionRules) value.suppressionRules = suppressionRules;
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_journey_request", "Journey request failed contract validation.", fields) };
  }
  return { ok: true, value };
}

export function validateExecutionBody(body: unknown, requireIdempotency: boolean): ValidationResult<{ dryRun?: boolean; idempotencyKey?: string }> {
  const input = body === undefined ? {} : body;
  if (!isRecord(input)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }
  const fields: Record<string, string> = {};
  const value: { dryRun?: boolean; idempotencyKey?: string } = {};
  if (input.dryRun !== undefined) {
    if (!isBoolean(input.dryRun)) fields.dryRun = "must_be_boolean";
    else value.dryRun = input.dryRun;
  }
  if (input.idempotencyKey !== undefined) {
    if (!isNonEmptyString(input.idempotencyKey)) fields.idempotencyKey = "must_be_non_empty_string";
    else value.idempotencyKey = input.idempotencyKey.trim();
  } else if (requireIdempotency) {
    fields.idempotencyKey = "required_for_real_execution";
  }
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_execution_request", "Execution request failed contract validation.", fields) };
  }
  return { ok: true, value };
}

export function validateSchedulerBody(body: unknown): ValidationResult<{ schedulerOwner?: string; batchSize?: number; lockTtlMs?: number }> {
  const input = body === undefined ? {} : body;
  if (!isRecord(input)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }
  const fields: Record<string, string> = {};
  const value: { schedulerOwner?: string; batchSize?: number; lockTtlMs?: number } = {};
  if (input.schedulerOwner !== undefined) {
    if (!isNonEmptyString(input.schedulerOwner)) fields.schedulerOwner = "must_be_non_empty_string";
    else value.schedulerOwner = input.schedulerOwner.trim();
  }
  const batchSize = validateOptionalPositiveInteger(input.batchSize, "batchSize", fields);
  if (batchSize !== undefined && batchSize !== null) value.batchSize = batchSize;
  const lockTtlMs = validateOptionalPositiveInteger(input.lockTtlMs, "lockTtlMs", fields);
  if (lockTtlMs !== undefined && lockTtlMs !== null) value.lockTtlMs = lockTtlMs;
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_scheduler_request", "Scheduler request failed contract validation.", fields) };
  }
  return { ok: true, value };
}

export function validatePreferenceOwner(owner: unknown): owner is ContactOwner {
  return owner === "auth" || owner === "leads";
}

function validateOptionalTrimmedString(body: Record<string, unknown>, field: string, fields: Record<string, string>, value: Record<string, unknown>): void {
  if (body[field] === undefined) return;
  if (!isNonEmptyString(body[field])) fields[field] = "must_be_non_empty_string";
  else value[field] = body[field].trim();
}

export function validatePreferenceRequest(body: unknown): ValidationResult<PreferenceUnsubscribeRequest> {
  if (!isRecord(body)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }
  const fields: Record<string, string> = {};
  const value: Partial<PreferenceUnsubscribeRequest> = {};
  if (!validatePreferenceOwner(body.owner)) fields.owner = "must_be_auth_or_leads";
  else value.owner = body.owner;
  if (!isNonEmptyString(body.recipientId)) fields.recipientId = "required_non_empty_string";
  else value.recipientId = body.recipientId.trim();
  if (body.channel !== undefined) {
    if (!CHANNELS.includes(body.channel as Channel)) fields.channel = `unsupported_value:${String(body.channel)}`;
    else value.channel = body.channel as Channel;
  }
  if (body.purpose !== undefined) {
    if (!PURPOSES.includes(body.purpose as Purpose)) fields.purpose = `unsupported_value:${String(body.purpose)}`;
    else value.purpose = body.purpose as Purpose;
  }
  for (const field of ["tenantId", "appId", "brandId", "requestId", "reason"] as const) {
    validateOptionalTrimmedString(body, field, fields, value as Record<string, unknown>);
  }
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_preference_request", "Preference request failed contract validation.", fields) };
  }
  return { ok: true, value: value as PreferenceUnsubscribeRequest };
}

function configuredApiToken(): string | undefined {
  return process.env.MARKETING_API_TOKEN || process.env.SERVICE_API_TOKEN;
}

function tokenFromRequest(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  const serviceToken = req.headers["x-service-token"];
  if (Array.isArray(serviceToken)) return serviceToken[0];
  return serviceToken;
}

export function requireServiceAuth(req: Request, res: Response, next: NextFunction): void | Response {
  const expected = configuredApiToken();
  if (!expected) {
    return sendContractError(res, 503, contractError("api_auth_not_configured", "Protected API operations require MARKETING_API_TOKEN or SERVICE_API_TOKEN."));
  }
  if (tokenFromRequest(req) !== expected) {
    return sendContractError(res, 401, contractError("unauthorized", "Protected API operation requires a valid service token."));
  }
  return next();
}

export function sourceOwnerService(owner: "auth" | "leads"): string {
  return owner === "auth" ? "auth-microservice" : "leads-microservice";
}
