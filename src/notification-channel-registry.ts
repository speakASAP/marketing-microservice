import axios from "axios";

const DEFAULT_CHANNEL_REGISTRY_PATH = "/channels";
const SENSITIVE_KEY_PATTERN = /(token|authorization|password|secret|credential|apiKey|privateKey|message|body|recipientAddress|recipient_address|address|email|phone)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}\d/;

export type ChannelRegistryReadResult = {
  status: "available" | "unconfigured" | "unavailable";
  owner: "notifications-microservice";
  source: "notifications-channel-registry";
  endpointPath: string;
  channels: unknown[];
  metadata?: Record<string, unknown>;
  reason?: string;
};

function registryPath(): string {
  const configured = process.env.NOTIFICATION_CHANNEL_REGISTRY_PATH ?? DEFAULT_CHANNEL_REGISTRY_PATH;
  return configured.startsWith("/") ? configured : "/" + configured;
}

function registryHeaders(): Record<string, string> | undefined {
  const token = process.env.NOTIFICATION_SERVICE_TOKEN;
  return token ? { Authorization: "Bearer " + token } : undefined;
}

function timeoutMs(): number {
  const configured = Number(process.env.NOTIFICATION_CHANNEL_REGISTRY_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 3000;
}

export function redactAdminValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAdminValue);
  if (value && typeof value === "object") return redactAdminRecord(value as Record<string, unknown>);
  if (typeof value === "string" && (EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value))) return "[redacted]";
  return value;
}

export function redactAdminRecord(record: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactAdminValue(value);
  }
  return redacted;
}

function normalizeChannels(payload: unknown): { channels: unknown[]; metadata?: Record<string, unknown> } {
  const sanitized = redactAdminValue(payload);
  if (Array.isArray(sanitized)) return { channels: sanitized };
  if (sanitized && typeof sanitized === "object") {
    const record = sanitized as Record<string, unknown>;
    const rawChannels = Array.isArray(record.channels) ? record.channels : Array.isArray(record.items) ? record.items : [];
    const { channels: _channels, items: _items, ...metadata } = record;
    return { channels: rawChannels, metadata: redactAdminRecord(metadata) };
  }
  return { channels: [] };
}

export async function readNotificationChannelRegistry(): Promise<ChannelRegistryReadResult> {
  const endpointPath = registryPath();
  const baseUrl = process.env.NOTIFICATION_SERVICE_URL;
  if (!baseUrl) {
    return {
      status: "unconfigured",
      owner: "notifications-microservice",
      source: "notifications-channel-registry",
      endpointPath,
      channels: [],
      reason: "notification_service_url_missing"
    };
  }

  try {
    const response = await axios.get(baseUrl.replace(/\/$/, "") + endpointPath, {
      timeout: timeoutMs(),
      headers: registryHeaders()
    });
    const normalized = normalizeChannels(response.data);
    return {
      status: "available",
      owner: "notifications-microservice",
      source: "notifications-channel-registry",
      endpointPath,
      channels: normalized.channels,
      metadata: normalized.metadata
    };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return {
      status: "unavailable",
      owner: "notifications-microservice",
      source: "notifications-channel-registry",
      endpointPath,
      channels: [],
      reason: status ? "registry_rejected:" + status : "registry_unavailable"
    };
  }
}
