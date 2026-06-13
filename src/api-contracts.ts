import { Request, Response, NextFunction } from "express";
import { Campaign, CampaignStatus, Channel, Purpose, Segment, SegmentSource } from "./types";

const CHANNELS: Channel[] = ["email", "telegram", "whatsapp"];
const PURPOSES: Purpose[] = ["marketing", "retention", "transactional-not-marketing"];
const SEGMENT_SOURCES: SegmentSource[] = ["auth_users", "leads", "orders"];
const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "scheduled", "running", "paused", "completed", "failed", "archived"];
const READ_ONLY_APPROVAL_FIELDS = ["approvalStatus", "approvedBy", "approvedAt", "approvalNote"];

export type ContractError = {
  error: string;
  message: string;
  fields?: Record<string, string>;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ContractError };

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

function validateOptionalNonNegativeInteger(value: unknown, field: string, fields: Record<string, string>): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fields[field] = "must_be_non_negative_integer";
    return undefined;
  }
  return value;
}

export function validateSegmentBody(body: unknown, partial = false): ValidationResult<Partial<Segment>> {
  if (!isRecord(body)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }

  const fields: Record<string, string> = {};
  const value: Partial<Segment> = {};

  if (body.segmentId !== undefined) fields.segmentId = "read_only";

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

export function validatePreferenceOwner(owner: unknown): owner is "auth" | "leads" {
  return owner === "auth" || owner === "leads";
}

export function validatePreferenceRequest(body: unknown): ValidationResult<{ owner: "auth" | "leads"; recipientId: string; channel?: Channel; purpose?: Purpose }> {
  if (!isRecord(body)) {
    return { ok: false, error: contractError("invalid_request_body", "Request body must be a JSON object.") };
  }
  const fields: Record<string, string> = {};
  const value: { owner?: "auth" | "leads"; recipientId?: string; channel?: Channel; purpose?: Purpose } = {};
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
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: contractError("invalid_preference_request", "Preference request failed contract validation.", fields) };
  }
  return { ok: true, value: value as { owner: "auth" | "leads"; recipientId: string; channel?: Channel; purpose?: Purpose } };
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
