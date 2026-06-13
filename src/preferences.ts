import axios from "axios";
import { Channel, ContactOwner, Purpose } from "./types";

const AUTH_UNSUBSCRIBE_DEFAULT_PATH = "/auth/marketing/preferences/unsubscribe";
const LEADS_UNSUBSCRIBE_DEFAULT_PATH = "/leads/marketing/preferences/unsubscribe";

type PreferenceUnsubscribeRequest = {
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

export type PreferenceWriteResult = {
  status: "forwarded" | "source_write_pending";
  writeOwner: "auth-microservice" | "leads-microservice";
  sourceStatus?: number;
  reason?: string;
};

function sourceConfig(owner: ContactOwner): { baseUrl?: string; path: string; token?: string; writeOwner: "auth-microservice" | "leads-microservice" } {
  if (owner === "auth") {
    return {
      baseUrl: process.env.AUTH_SERVICE_URL,
      path: process.env.AUTH_UNSUBSCRIBE_PATH ?? AUTH_UNSUBSCRIBE_DEFAULT_PATH,
      token: process.env.AUTH_SERVICE_TOKEN,
      writeOwner: "auth-microservice"
    };
  }
  return {
    baseUrl: process.env.LEADS_SERVICE_URL,
    path: process.env.LEADS_UNSUBSCRIBE_PATH ?? LEADS_UNSUBSCRIBE_DEFAULT_PATH,
    token: process.env.LEADS_SERVICE_TOKEN,
    writeOwner: "leads-microservice"
  };
}

function sourceHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function timeoutMs(): number {
  const configured = Number(process.env.PREFERENCE_WRITE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 5000;
}

export async function forwardUnsubscribeWrite(request: PreferenceUnsubscribeRequest): Promise<PreferenceWriteResult> {
  const config = sourceConfig(request.owner);
  if (!config.baseUrl) {
    return {
      status: "source_write_pending",
      writeOwner: config.writeOwner,
      reason: `${request.owner}_service_url_missing`
    };
  }

  const endpoint = `${config.baseUrl.replace(/\/$/, "")}${config.path}`;
  const payload = {
    recipientId: request.recipientId,
    channel: request.channel ?? null,
    purpose: request.purpose ?? "marketing",
    tenantId: request.tenantId ?? null,
    appId: request.appId ?? null,
    brandId: request.brandId ?? null,
    requestId: request.requestId ?? null,
    reason: request.reason ?? "marketing_unsubscribe_intake",
    requestedAt: new Date().toISOString(),
    source: "marketing-microservice"
  };

  try {
    const response = await axios.post(endpoint, payload, {
      timeout: timeoutMs(),
      headers: sourceHeaders(config.token),
      validateStatus: (status) => status >= 200 && status < 300
    });
    return { status: "forwarded", writeOwner: config.writeOwner, sourceStatus: response.status };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return {
      status: "source_write_pending",
      writeOwner: config.writeOwner,
      sourceStatus: status,
      reason: status ? `source_rejected:${status}` : "source_unavailable"
    };
  }
}
