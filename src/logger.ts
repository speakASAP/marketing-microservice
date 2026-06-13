import axios from "axios";

const SENSITIVE_KEY_PATTERN = /(token|authorization|password|secret|credential|message|body|recipientAddress|recipient_address)/i;
const DEFAULT_LOGGING_PATH = "/logs";

type AuditLogPayload = Record<string, unknown> & {
  event: string;
  timestamp: string;
  duration_ms: number;
  service: string;
};

let auditSinkForTest: ((payload: AuditLogPayload) => void | Promise<void>) | null = null;

export function setAuditSinkForTest(sink: ((payload: AuditLogPayload) => void | Promise<void>) | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("audit_sink_override_is_test_only");
  }
  auditSinkForTest = sink;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeRecord(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

function loggingEndpoint(): string | null {
  const base = process.env.LOGGING_SERVICE_URL;
  if (!base) return null;
  const path = process.env.LOGGING_SERVICE_PATH ?? DEFAULT_LOGGING_PATH;
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return base.replace(/\/$/, "") + normalizedPath;
}

export function logDecision(event: string, data: Record<string, unknown> = {}): void {
  const sanitized = sanitizeRecord(data);
  const payload: AuditLogPayload = {
    event,
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME ?? "marketing-microservice",
    duration_ms: typeof sanitized.duration_ms === "number" ? sanitized.duration_ms : 0,
    ...sanitized
  };

  console.log(JSON.stringify(payload));

  if (auditSinkForTest) {
    void Promise.resolve(auditSinkForTest(payload)).catch(() => undefined);
  }

  const endpoint = loggingEndpoint();
  if (!endpoint) return;

  const token = process.env.LOGGING_SERVICE_TOKEN;
  const headers = token ? { Authorization: "Bearer " + token } : undefined;
  void axios.post(endpoint, payload, { timeout: 3000, headers }).catch((error) => {
    console.error(JSON.stringify({
      event: "audit_log_forward_failed",
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME ?? "marketing-microservice",
      duration_ms: 0,
      reason: (error as Error).message
    }));
  });
}
