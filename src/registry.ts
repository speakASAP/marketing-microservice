import axios from "axios";
import { logDecision } from "./logger";
import { Channel, RegistryScope, RegistryStatus } from "./types";

export interface RegistryReference extends RegistryScope {
  allowedChannels?: Channel[];
  defaultChannelKey?: string | null;
  status?: RegistryStatus;
}

export type RegistryValidationResult =
  | { ok: true; reference: RegistryReference }
  | { ok: false; reason: "registry_unavailable" | "registry_reference_invalid" | "registry_reference_inactive"; details?: string };

type FixtureProvider = (scope: RegistryScope) => RegistryReference | undefined;
let fixtureProvider: FixtureProvider | null = null;

export function setRegistryFixtureProviderForTest(provider: FixtureProvider | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("registry_fixture_provider_is_test_only");
  }
  fixtureProvider = provider;
}

function registryPath(): string {
  return process.env.TENANT_APP_REGISTRY_VALIDATE_PATH ?? "/registry/marketing/validate";
}

function serviceHeaders(): Record<string, string> | undefined {
  const token = process.env.TENANT_APP_REGISTRY_TOKEN;
  return token ? { Authorization: "Bearer " + token } : undefined;
}

function isActive(status: RegistryStatus | undefined): boolean {
  return status === undefined || status === "active" || (process.env.NODE_ENV === "test" && status === "test-only");
}

function fixtureEnabled(): boolean {
  return process.env.NODE_ENV === "test" && process.env.MARKETING_USE_TEST_REGISTRY_FIXTURES === "true";
}

export async function validateRegistryScope(scope: RegistryScope): Promise<RegistryValidationResult> {
  const started = Date.now();
  if (fixtureEnabled() && fixtureProvider) {
    const reference = fixtureProvider(scope);
    const result = reference
      ? isActive(reference.status)
        ? { ok: true as const, reference }
        : { ok: false as const, reason: "registry_reference_inactive" as const, details: reference.status }
      : { ok: false as const, reason: "registry_reference_invalid" as const, details: "fixture_not_found" };
    logDecision("registry_scope_validated", {
      tenantId: scope.tenantId,
      appId: scope.appId,
      brandId: scope.brandId,
      source: "test_fixture",
      ok: result.ok,
      reason: result.ok ? "registry_reference_valid" : result.reason,
      duration_ms: Date.now() - started
    });
    return result;
  }

  const baseUrl = process.env.TENANT_APP_REGISTRY_URL;
  if (!baseUrl) {
    logDecision("registry_scope_validation_failed", {
      tenantId: scope.tenantId,
      appId: scope.appId,
      brandId: scope.brandId,
      reason: "registry_unavailable",
      duration_ms: Date.now() - started
    });
    return { ok: false, reason: "registry_unavailable", details: "tenant_app_registry_url_missing" };
  }

  try {
    const response = await axios.post(baseUrl + registryPath(), scope, {
      timeout: Number(process.env.TENANT_APP_REGISTRY_TIMEOUT_MS ?? 3000),
      headers: serviceHeaders()
    });
    const data = response.data as Partial<RegistryReference> & { valid?: boolean; status?: RegistryStatus };
    if (data.valid === false) {
      return { ok: false, reason: "registry_reference_invalid", details: "registry_rejected_reference" };
    }
    const reference: RegistryReference = {
      ...scope,
      ...data,
      tenantId: String(data.tenantId ?? scope.tenantId),
      appId: String(data.appId ?? scope.appId),
      brandId: String(data.brandId ?? scope.brandId)
    };
    if (!isActive(reference.status)) {
      return { ok: false, reason: "registry_reference_inactive", details: reference.status };
    }
    logDecision("registry_scope_validated", {
      tenantId: scope.tenantId,
      appId: scope.appId,
      brandId: scope.brandId,
      source: "registry_service",
      ok: true,
      duration_ms: Date.now() - started
    });
    return { ok: true, reference };
  } catch (error) {
    logDecision("registry_scope_validation_failed", {
      tenantId: scope.tenantId,
      appId: scope.appId,
      brandId: scope.brandId,
      reason: "registry_unavailable",
      details: (error as Error).message,
      duration_ms: Date.now() - started
    });
    return { ok: false, reason: "registry_unavailable", details: (error as Error).message };
  }
}

export function registryScopeFrom(value: RegistryScope): RegistryScope {
  return {
    tenantId: value.tenantId,
    appId: value.appId,
    brandId: value.brandId,
    businessId: value.businessId ?? null,
    environment: value.environment ?? null,
    defaultLocale: value.defaultLocale ?? null,
    timezone: value.timezone ?? null,
    productLine: value.productLine ?? null,
    lifecycleScope: value.lifecycleScope ?? null,
    legalSenderIdentity: value.legalSenderIdentity ?? null,
    policyRef: value.policyRef ?? null
  };
}
