import test from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { app } from "../src/main";
import { setRegistryFixtureProviderForTest } from "../src/registry";
import { resetInMemoryState } from "../src/store";

process.env.NODE_ENV = "test";
process.env.MARKETING_API_TOKEN = "contract-test-token";
process.env.MARKETING_USE_TEST_REGISTRY_FIXTURES = "true";
setRegistryFixtureProviderForTest((scope) => scope.tenantId === "statex" && scope.appId === "flipflop" && scope.brandId === "statex-main" ? { ...scope, status: "active" } : undefined);

type Json = Record<string, unknown>;

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}


async function withJsonSourceServer<T>(fn: (baseUrl: string, received: Json[]) => Promise<T>): Promise<T> {
  const received: Json[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      received.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization ?? null,
        body: raw ? JSON.parse(raw) as Json : {}
      });
      res.writeHead(204).end();
    });
  });
  server.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${address.port}`, received);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function request(baseUrl: string, path: string, options: RequestInit = {}): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) as Json : {} };
}

test.beforeEach(() => {
  resetInMemoryState();
  process.env.MARKETING_API_TOKEN = "contract-test-token";
  process.env.MARKETING_USE_TEST_REGISTRY_FIXTURES = "true";
  delete process.env.AUTH_SERVICE_URL;
  delete process.env.AUTH_UNSUBSCRIBE_PATH;
  delete process.env.AUTH_SERVICE_TOKEN;
  delete process.env.LEADS_SERVICE_URL;
  delete process.env.LEADS_UNSUBSCRIBE_PATH;
  delete process.env.LEADS_SERVICE_TOKEN;
  delete process.env.PREFERENCE_WRITE_TIMEOUT_MS;
  setRegistryFixtureProviderForTest((scope) => scope.tenantId === "statex" && scope.appId === "flipflop" && scope.brandId === "statex-main" ? { ...scope, status: "active" } : undefined);
});

test("protected write APIs require service authorization", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/segments", {
      method: "POST",
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "buyers", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, "unauthorized");
  });
});

test("invalid segment and campaign requests fail with stable contract errors", async () => {
  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const badSegment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", name: "buyers", sourceTypes: ["invalid"], rules: [], isDynamic: "yes" })
    });
    assert.equal(badSegment.status, 400);
    assert.equal(badSegment.body.error, "invalid_segment_request");
    assert.deepEqual(badSegment.body.fields, {
      sourceTypes: "unsupported_value:invalid",
      rules: "required_object",
      isDynamic: "required_boolean"
    });

    const goodSegment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "buyers", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });
    assert.equal(goodSegment.status, 201);

    const badCampaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenant: "statex",
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Launch",
        segmentId: goodSegment.body.segmentId,
        templateRef: "launch-template",
        primaryChannel: "sms",
        scheduleAt: "tomorrow",
        frequencyCapPerDay: 0,
        message: { body: "Hello" }
      })
    });
    assert.equal(badCampaign.status, 400);
    assert.equal(badCampaign.body.error, "invalid_campaign_request");
    assert.deepEqual(badCampaign.body.fields, {
      primaryChannel: "unsupported_value:sms",
      scheduleAt: "must_be_iso_8601_utc_string_or_null",
      frequencyCapPerDay: "must_be_positive_integer"
    });
  });
});

test("real execution requires a stable idempotency contract", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/campaigns/camp-1/execute", {
      method: "POST",
      headers: { Authorization: "Bearer contract-test-token" },
      body: JSON.stringify({ dryRun: false })
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_execution_request");
    assert.deepEqual(response.body.fields, { idempotencyKey: "required_for_real_execution" });
  });
});

test("public preference and unsubscribe endpoints preserve source ownership", async () => {
  await withServer(async (baseUrl) => {
    const preference = await request(baseUrl, "/preferences/auth/auth-1", { method: "GET" });
    assert.equal(preference.status, 200);
    assert.equal(preference.body.status, "external_source_owned");
    assert.equal(preference.body.readOwner, "auth-microservice");

    const unsubscribe = await request(baseUrl, "/preferences/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ owner: "leads", recipientId: "lead-1", channel: "email", purpose: "marketing" })
    });
    assert.equal(unsubscribe.status, 202);
    assert.equal(unsubscribe.body.status, "accepted");
    assert.equal(unsubscribe.body.writeOwner, "leads-microservice");
    assert.equal(unsubscribe.body.sourceWriteStatus, "source_write_pending");
    assert.equal(unsubscribe.body.sourceWriteReason, "leads_service_url_missing");
  });
});

test("public unsubscribe forwards write-through to configured source owner", async () => {
  await withJsonSourceServer(async (sourceUrl, received) => {
    process.env.LEADS_SERVICE_URL = sourceUrl;
    process.env.LEADS_UNSUBSCRIBE_PATH = "/internal/leads/unsubscribe";
    process.env.LEADS_SERVICE_TOKEN = "leads-write-token";

    await withServer(async (baseUrl) => {
      const unsubscribe = await request(baseUrl, "/preferences/unsubscribe", {
        method: "POST",
        body: JSON.stringify({
          owner: "leads",
          recipientId: "lead-42",
          channel: "whatsapp",
          purpose: "marketing",
          tenantId: "statex",
          appId: "flipflop",
          brandId: "statex-main",
          requestId: "req-42"
        })
      });

      assert.equal(unsubscribe.status, 202);
      assert.equal(unsubscribe.body.status, "accepted");
      assert.equal(unsubscribe.body.writeOwner, "leads-microservice");
      assert.equal(unsubscribe.body.sourceWriteStatus, "forwarded");
      assert.equal(unsubscribe.body.sourceStatus, 204);
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].method, "POST");
    assert.equal(received[0].url, "/internal/leads/unsubscribe");
    assert.equal(received[0].authorization, "Bearer leads-write-token");
    const forwardedBody = received[0].body as Json;
    assert.deepEqual(forwardedBody, {
      recipientId: "lead-42",
      channel: "whatsapp",
      purpose: "marketing",
      tenantId: "statex",
      appId: "flipflop",
      brandId: "statex-main",
      requestId: "req-42",
      reason: "marketing_unsubscribe_intake",
      requestedAt: forwardedBody.requestedAt,
      source: "marketing-microservice"
    });
  });
});


test("registry validation rejects invalid tenant app brand references", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/segments", {
      method: "POST",
      headers: { Authorization: "Bearer contract-test-token" },
      body: JSON.stringify({ tenantId: "statex", appId: "unknown-app", brandId: "statex-main", name: "bad scope", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "registry_reference_invalid");
  });
});

test("segment list supports tenant and app scope filters", async () => {
  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const created = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "buyers", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });
    assert.equal(created.status, 201);

    const matching = await request(baseUrl, "/segments?tenantId=statex&appId=flipflop", { method: "GET" });
    assert.equal(matching.status, 200);
    assert.equal((matching.body as unknown as Array<Record<string, unknown>>).length, 1);

    const nonMatching = await request(baseUrl, "/segments?tenantId=statex&appId=speakasap", { method: "GET" });
    assert.equal(nonMatching.status, 200);
    assert.equal((nonMatching.body as unknown as Array<Record<string, unknown>>).length, 0);
  });
});
