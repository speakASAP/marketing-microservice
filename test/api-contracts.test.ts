import test from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { app } from "../src/main";
import { setRegistryFixtureProviderForTest } from "../src/registry";
import { getStore, resetInMemoryState } from "../src/store";
import { setTestRecipientFixtureProviderForTest } from "../src/sources";
import { testRecipientFixtures } from "./fixtures";

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

async function withAuthValidateServer<T>(rolesByToken: Record<string, string[]>, fn: (baseUrl: string, received: Json[]) => Promise<T>): Promise<T> {
  const received: Json[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) as Json : {};
      received.push({ method: req.method, url: req.url, body });
      if (req.method !== "POST" || req.url !== "/auth/validate") {
        res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not_found" }));
        return;
      }
      const token = typeof body.token === "string" ? body.token : "";
      if (!Object.prototype.hasOwnProperty.call(rolesByToken, token)) {
        res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid_token" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
        valid: true,
        user: { id: `auth-${token}`, email: `${token}@example.com`, type: "end_user", roles: rolesByToken[token] }
      }));
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

async function requestText(baseUrl: string, path: string, options: RequestInit = {}): Promise<{ status: number; body: string; contentType: string }> {
  const response = await fetch(`${baseUrl}${path}`, options);
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type") ?? ""
  };
}

async function requestRedirect(baseUrl: string, path: string): Promise<{ status: number; location: string; setCookie: string }> {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    setCookie: response.headers.get("set-cookie") ?? ""
  };
}

test.beforeEach(() => {
  resetInMemoryState();
  process.env.MARKETING_API_TOKEN = "contract-test-token";
  process.env.MARKETING_USE_TEST_REGISTRY_FIXTURES = "true";
  delete process.env.AUTH_SERVICE_URL;
  delete process.env.AUTH_UNSUBSCRIBE_PATH;
  delete process.env.AUTH_SERVICE_TOKEN;
  delete process.env.AUTH_SESSION_VALIDATE_PATH;
  delete process.env.AUTH_SESSION_VALIDATE_TIMEOUT_MS;
  delete process.env.AUTH_ADMIN_ACCESS_TOKEN_COOKIE;
  delete process.env.MARKETING_ADMIN_VIEWER_ROLES;
  delete process.env.MARKETING_ADMIN_OPERATOR_ROLES;
  delete process.env.MARKETING_ADMIN_ADMIN_ROLES;
  delete process.env.MARKETING_ADMIN_OWNER_ROLES;
  delete process.env.LEADS_SERVICE_URL;
  delete process.env.LEADS_UNSUBSCRIBE_PATH;
  delete process.env.LEADS_SERVICE_TOKEN;
  delete process.env.PREFERENCE_WRITE_TIMEOUT_MS;
  delete process.env.NOTIFICATION_SERVICE_URL;
  delete process.env.NOTIFICATION_SERVICE_TOKEN;
  delete process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES;
  setTestRecipientFixtureProviderForTest(undefined);
  setRegistryFixtureProviderForTest((scope) => scope.tenantId === "statex" && scope.appId === "flipflop" && scope.brandId === "statex-main" ? { ...scope, status: "active" } : undefined);
});

test("public landing page exposes auth-owned entry points without operational controls", async () => {
  await withServer(async (baseUrl) => {
    const landing = await requestText(baseUrl, "/");
    assert.equal(landing.status, 200);
    assert.match(landing.contentType, /text\/html/);
    assert.match(landing.body, /Statex Marketing/);
    assert.match(landing.body, /Campaign control/);
    assert.match(landing.body, /Notifications-owned/);
    assert.match(landing.body, /href="\/auth\/register"/);
    assert.match(landing.body, /href="\/auth\/login"/);
    assert.match(landing.body, /href="\/admin"/);
    assert.doesNotMatch(landing.body, /MARKETING_API_TOKEN|SERVICE_API_TOKEN|x-service-token|\/campaigns\/[^" ]+\/execute|\/scheduler\/run-due/);

    const aliased = await requestText(baseUrl, "/landing");
    assert.equal(aliased.status, 200);
    assert.match(aliased.body, /Recipient protection/);

    const css = await requestText(baseUrl, "/assets/landing.css");
    assert.equal(css.status, 200);
    assert.match(css.contentType, /text\/css/);
    assert.match(css.body, /--green/);
  });
});

test("public auth entry points delegate login and registration to auth with return state", async () => {
  process.env.AUTH_SERVICE_PUBLIC_URL = "https://auth.alfares.cz";
  process.env.MARKETING_PUBLIC_URL = "https://marketing.alfares.cz";

  await withServer(async (baseUrl) => {
    for (const [path, expectedPath] of [["/auth/login", "/login"], ["/auth/register", "/register"]] as const) {
      const response = await requestRedirect(baseUrl, path);
      assert.equal(response.status, 302);
      assert.match(response.setCookie, /marketing_auth_state=/);
      assert.match(response.setCookie, /Path=\/auth\/callback/);
      assert.match(response.setCookie, /SameSite=Lax/);

      const location = new URL(response.location);
      assert.equal(location.origin, "https://auth.alfares.cz");
      assert.equal(location.pathname, expectedPath);
      assert.equal(location.searchParams.get("return_url"), "https://marketing.alfares.cz/auth/callback");
      assert.equal(location.searchParams.get("client_id"), "marketing-microservice");
      assert.match(location.searchParams.get("state") ?? "", /^[0-9a-f-]{36}$/);
    }

    const callback = await requestText(baseUrl, "/auth/callback");
    assert.equal(callback.status, 200);
    assert.match(callback.body, /auth_access_token/);
    assert.match(callback.body, /marketing_auth_state/);
    assert.match(callback.body, /window\.location\.replace\("\/admin"\)/);
    assert.doesNotMatch(callback.body, /MARKETING_API_TOKEN|SERVICE_API_TOKEN|x-service-token|refresh_token\)/);
  });
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

test("admin shell rejects anonymous browser requests", async () => {
  process.env.AUTH_SERVICE_URL = "http://auth-microservice:3370";
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/admin", { method: "GET" });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, "admin_auth_required");
  });
});

test("admin shell protects navigation placeholders without exposing operational controls", async () => {
  await withAuthValidateServer({ viewer: ["marketing_viewer"] }, async (authUrl) => {
    process.env.AUTH_SERVICE_URL = authUrl;
    await withServer(async (baseUrl) => {
      for (const path of ["/admin/journeys", "/admin/runs", "/admin/audit", "/admin/settings"]) {
        const anonymous = await request(baseUrl, path, { method: "GET" });
        assert.equal(anonymous.status, 401);
        assert.equal(anonymous.body.error, "admin_auth_required");

        const authorized = await requestText(baseUrl, path, { headers: { Authorization: "Bearer viewer" } });
        assert.equal(authorized.status, 200);
        assert.match(authorized.contentType, /text\/html/);
        assert.match(authorized.body, /Marketing Admin/);
        assert.match(authorized.body, /Protected placeholder/);
        assert.doesNotMatch(authorized.body, /MARKETING_API_TOKEN|SERVICE_API_TOKEN|x-service-token|\/campaigns\/[^" ]+\/execute|\/scheduler\/run-due/);
      }
    });
  });
});

test("admin session is verified through auth and maps viewer operator admin owner roles", async () => {
  const rolesByToken: Record<string, string[]> = {
    viewer: ["marketing_viewer"],
    operator: ["app:marketing-microservice:marketing_operator"],
    admin: ["internal:marketing-microservice:admin"],
    owner: ["global:superadmin"],
    none: ["app:marketing-microservice:user"]
  };

  await withAuthValidateServer(rolesByToken, async (authUrl, received) => {
    process.env.AUTH_SERVICE_URL = authUrl;
    await withServer(async (baseUrl) => {
      for (const [token, expected] of Object.entries({ viewer: "viewer", operator: "operator", admin: "admin", owner: "owner" })) {
        const response = await request(baseUrl, "/admin/api/session", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.authenticated, true);
        assert.equal(response.body.accessLevel, expected);
        assert.equal((response.body.user as Json).email, `${token}@example.com`);
        assert.equal(Object.prototype.hasOwnProperty.call(response.body, "accessToken"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(response.body, "serviceToken"), false);
      }

      const forbidden = await request(baseUrl, "/admin/api/session", {
        method: "GET",
        headers: { Authorization: "Bearer none" }
      });
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.body.error, "admin_forbidden");
    });

    assert.equal(received.length, 5);
    assert.deepEqual(received.map((item) => (item.body as Json).token), ["viewer", "operator", "admin", "owner", "none"]);
  });
});

test("admin session supports configurable auth cookie and does not accept service tokens as browser identity", async () => {
  await withAuthValidateServer({ cookie: ["marketing_viewer"] }, async (authUrl) => {
    process.env.AUTH_SERVICE_URL = authUrl;
    process.env.AUTH_ADMIN_ACCESS_TOKEN_COOKIE = "statex_auth";
    await withServer(async (baseUrl) => {
      const cookieSession = await request(baseUrl, "/admin/api/session", {
        method: "GET",
        headers: { Cookie: "statex_auth=cookie" }
      });
      assert.equal(cookieSession.status, 200);
      assert.equal(cookieSession.body.accessLevel, "viewer");
      assert.equal(JSON.stringify(cookieSession.body).includes("contract-test-token"), false);

      const serviceTokenAsBrowserToken = await request(baseUrl, "/admin/api/session", {
        method: "GET",
        headers: { Authorization: "Bearer contract-test-token" }
      });
      assert.equal(serviceTokenAsBrowserToken.status, 401);
      assert.equal(serviceTokenAsBrowserToken.body.error, "admin_auth_invalid");
    });
  });
});

test("admin campaign and segment console APIs are protected by RBAC and return sanitized dry-run summaries", async () => {
  process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = "true";
  setTestRecipientFixtureProviderForTest(() => testRecipientFixtures);
  const rolesByToken: Record<string, string[]> = {
    viewer: ["marketing_viewer"],
    operator: ["marketing_operator"],
    admin: ["marketing_admin"]
  };

  await withAuthValidateServer(rolesByToken, async (authUrl) => {
    process.env.AUTH_SERVICE_URL = authUrl;
    await withServer(async (baseUrl) => {
      const serviceAuth = { Authorization: "Bearer contract-test-token" };
      const segment = await request(baseUrl, "/segments", {
        method: "POST",
        headers: serviceAuth,
        body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "Consented users", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
      });
      assert.equal(segment.status, 201);

      const campaign = await request(baseUrl, "/campaigns", {
        method: "POST",
        headers: serviceAuth,
        body: JSON.stringify({
          tenant: "statex",
          tenantId: "statex",
          appId: "flipflop",
          brandId: "statex-main",
          environment: "test",
          name: "Admin launch",
          segmentId: segment.body.segmentId,
          templateRef: "admin-template",
          message: { body: "Hello" }
        })
      });
      assert.equal(campaign.status, 201);

      const anonymous = await request(baseUrl, "/admin/api/campaigns", { method: "GET" });
      assert.equal(anonymous.status, 401);
      assert.equal(anonymous.body.error, "admin_auth_required");

      const campaigns = await request(baseUrl, "/admin/api/campaigns", { method: "GET", headers: { Authorization: "Bearer viewer" } });
      assert.equal(campaigns.status, 200);
      assert.equal(Array.isArray(campaigns.body), true);
      assert.equal((campaigns.body as unknown[]).length, 1);
      assert.equal(JSON.stringify(campaigns.body).includes("contract-test-token"), false);

      const segments = await request(baseUrl, "/admin/api/segments", { method: "GET", headers: { Authorization: "Bearer viewer" } });
      assert.equal(segments.status, 200);
      assert.equal(Array.isArray(segments.body), true);
      assert.equal((segments.body as unknown[]).length, 1);

      const campaignsPage = await requestText(baseUrl, "/admin/campaigns", { headers: { Authorization: "Bearer viewer" } });
      assert.equal(campaignsPage.status, 200);
      assert.match(campaignsPage.body, /Campaign definitions/);
      assert.doesNotMatch(campaignsPage.body, /MARKETING_API_TOKEN|SERVICE_API_TOKEN|x-service-token|\/campaigns\/[^" ]+\/execute|\/scheduler\/run-due/);

      const segmentsPage = await requestText(baseUrl, "/admin/segments", { headers: { Authorization: "Bearer viewer" } });
      assert.equal(segmentsPage.status, 200);
      assert.match(segmentsPage.body, /Segment definitions/);
      assert.doesNotMatch(segmentsPage.body, /MARKETING_API_TOKEN|SERVICE_API_TOKEN|x-service-token|\/campaigns\/[^" ]+\/execute|\/scheduler\/run-due/);

      const viewerDryRun = await request(baseUrl, `/admin/api/campaigns/${campaign.body.campaignId}/dry-run`, {
        method: "POST",
        headers: { Authorization: "Bearer viewer" },
        body: JSON.stringify({ idempotencyKey: "viewer-dry-run" })
      });
      assert.equal(viewerDryRun.status, 403);
      assert.equal(viewerDryRun.body.error, "admin_forbidden");

      const dryRun = await request(baseUrl, `/admin/api/campaigns/${campaign.body.campaignId}/dry-run`, {
        method: "POST",
        headers: { Authorization: "Bearer operator" },
        body: JSON.stringify({ idempotencyKey: "operator-dry-run" })
      });
      assert.equal(dryRun.status, 200);
      assert.equal(dryRun.body.dryRun, true);
      assert.equal(typeof dryRun.body.totalRecipients, "number");
      assert.equal(dryRun.body.totalSent, 0);
      assert.equal(JSON.stringify(dryRun.body).includes("user1@example.com"), false);
      assert.equal(JSON.stringify(dryRun.body).includes("lead1@example.com"), false);

      const viewerApprove = await request(baseUrl, `/admin/api/campaigns/${campaign.body.campaignId}/approve`, {
        method: "POST",
        headers: { Authorization: "Bearer viewer" },
        body: JSON.stringify({ approvalNote: "not allowed" })
      });
      assert.equal(viewerApprove.status, 403);
      assert.equal(viewerApprove.body.error, "admin_forbidden");

      const approved = await request(baseUrl, `/admin/api/campaigns/${campaign.body.campaignId}/approve`, {
        method: "POST",
        headers: { Authorization: "Bearer admin" },
        body: JSON.stringify({ approvalNote: "Owner approved from admin console" })
      });
      assert.equal(approved.status, 200);
      assert.equal(approved.body.approvalStatus, "approved");
      assert.equal(approved.body.approvedBy, "admin@example.com");
      assert.equal(approved.body.status, "scheduled");
    });
  });
});


test("admin analytics dashboard and exports are protected and redacted", async () => {
  const rolesByToken: Record<string, string[]> = { viewer: ["marketing_viewer"] };

  await withAuthValidateServer(rolesByToken, async (authUrl) => {
    process.env.AUTH_SERVICE_URL = authUrl;
    await withServer(async (baseUrl) => {
      const serviceAuth = { Authorization: "Bearer contract-test-token" };
      const segment = await request(baseUrl, "/segments", {
        method: "POST",
        headers: serviceAuth,
        body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "Analytics users", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
      });
      assert.equal(segment.status, 201);

      const campaign = await request(baseUrl, "/campaigns", {
        method: "POST",
        headers: serviceAuth,
        body: JSON.stringify({
          tenant: "statex",
          tenantId: "statex",
          appId: "flipflop",
          brandId: "statex-main",
          environment: "test",
          name: "Analytics launch",
          segmentId: segment.body.segmentId,
          templateRef: "analytics-template",
          catalogMetadata: { campaignFamily: "activation", lifecycleStage: "activation", audienceKey: "analytics-users" },
          message: { subject: "Hidden subject", body: "Hidden body" }
        })
      });
      assert.equal(campaign.status, 201);
      const campaignId = String(campaign.body.campaignId);

      await getStore().saveRun({
        id: "analytics-api-run",
        campaignId,
        idempotencyKey: "analytics-api-key",
        startedAt: "2026-06-14T08:00:00.000Z",
        completedAt: "2026-06-14T08:00:05.000Z",
        status: "completed",
        dryRun: false,
        totalRecipients: 3,
        totalSent: 1,
        results: [
          { deliveryId: "analytics-sent", campaignId, recipientRef: "auth:user-1", recipientSource: "auth", recipientAddress: "user1@example.com", requestedChannel: "email", effectiveChannel: "email", status: "sent", decisionReason: "sent_via_notifications", processedAt: "2026-06-14T08:00:01.000Z", duration_ms: 30, correlationId: "marketing:analytics-api-run:auth:user-1" },
          { deliveryId: "analytics-skipped", campaignId, recipientRef: "lead:lead-1", recipientSource: "leads", recipientAddress: "lead1@example.com", requestedChannel: "email", effectiveChannel: "email", status: "skipped", decisionReason: "consent_missing", processedAt: "2026-06-14T08:00:02.000Z", duration_ms: 0 },
          { deliveryId: "analytics-failed", campaignId, recipientRef: "auth:user-2", recipientSource: "auth", recipientAddress: "user2@example.com", requestedChannel: "email", effectiveChannel: "telegram", status: "failed", decisionReason: "notification_url_missing", processedAt: "2026-06-14T08:00:03.000Z", duration_ms: 20, correlationId: "marketing:analytics-api-run:auth:user-2" }
        ]
      });

      const anonymous = await request(baseUrl, "/admin/api/analytics/summary", { method: "GET" });
      assert.equal(anonymous.status, 401);
      assert.equal(anonymous.body.error, "admin_auth_required");

      const page = await requestText(baseUrl, "/admin/analytics", { headers: { Authorization: "Bearer viewer" } });
      assert.equal(page.status, 200);
      assert.match(page.body, /Campaign analytics/);
      assert.match(page.body, /Attributed value/);
      assert.doesNotMatch(page.body, /MARKETING_API_TOKEN|SERVICE_API_TOKEN|x-service-token|\/campaigns\/[^" ]+\/execute|\/scheduler\/run-due/);

      const summary = await request(baseUrl, "/admin/api/analytics/summary", { method: "GET", headers: { Authorization: "Bearer viewer" } });
      assert.equal(summary.status, 200);
      assert.equal(((summary.body.summary as Json).totals as Json).sent, 1);
      assert.equal(((summary.body.summary as Json).externalAttribution as Json).available, false);
      assert.equal(JSON.stringify(summary.body).includes("user1@example.com"), false);
      assert.equal(JSON.stringify(summary.body).includes("Hidden body"), false);

      const supplied = await request(baseUrl, "/admin/api/analytics/summary", {
        method: "POST",
        headers: { Authorization: "Bearer viewer" },
        body: JSON.stringify({ externalAttributionFacts: [
          { factType: "delivered", sourceService: "notifications-microservice", campaignId, runId: "analytics-api-run", correlationId: "marketing:analytics-api-run:auth:user-1", count: 1, occurredAt: "2026-06-14T08:01:00.000Z" },
          { factType: "converted", sourceService: "analytics-service", campaignId, runId: "analytics-api-run", count: 1, occurredAt: "2026-06-14T08:30:00.000Z" },
          { factType: "attributed_value", sourceService: "analytics-service", campaignId, runId: "analytics-api-run", value: 1200, currency: "CZK", occurredAt: "2026-06-14T08:30:00.000Z" }
        ] })
      });
      assert.equal(supplied.status, 200);
      const rows = supplied.body.rows as Json[];
      assert.equal(rows[0].sent, 1);
      assert.equal(rows[0].skipped, 1);
      assert.equal(rows[0].failed, 1);
      assert.equal(rows[0].delivered, 1);
      assert.equal(rows[0].converted, 1);
      assert.equal(rows[0].attributedValue, 1200);

      const csv = await requestText(baseUrl, "/admin/api/analytics/export.csv", { headers: { Authorization: "Bearer viewer" } });
      assert.equal(csv.status, 200);
      assert.match(csv.contentType, /text\/csv/);
      assert.match(csv.body, /campaignId,name,tenantId,appId/);
      assert.doesNotMatch(csv.body, /user1@example\.com|lead1@example\.com|user2@example\.com|Hidden body|Hidden subject|contract-test-token/);
    });
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

test("campaign catalog metadata is accepted as non-executable discovery metadata", async () => {
  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const segment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "buyers", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });
    assert.equal(segment.status, 201);

    const campaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenant: "statex",
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        productLine: "marketplace",
        lifecycleScope: "activation",
        name: "Activation launch",
        segmentId: segment.body.segmentId,
        templateRef: "activation-template",
        message: { body: "Hello" },
        catalogMetadata: {
          campaignFamily: "activation",
          lifecycleStage: "activation",
          audienceKey: "new-buyers",
          audienceLabel: "New buyers",
          catalogCategory: "onboarding",
          catalogTags: ["flipflop", "activation"],
          sourceBlueprintId: "flipflop.activation.default"
        }
      })
    });
    assert.equal(campaign.status, 201);
    assert.deepEqual(campaign.body.catalogMetadata, {
      campaignFamily: "activation",
      lifecycleStage: "activation",
      audienceKey: "new-buyers",
      audienceLabel: "New buyers",
      catalogCategory: "onboarding",
      catalogTags: ["flipflop", "activation"],
      sourceBlueprintId: "flipflop.activation.default"
    });
    assert.equal(campaign.body.approvalStatus, "pending");
    assert.equal(campaign.body.status, "draft");

    const catalogCampaigns = await request(baseUrl, "/campaign-catalog/campaigns?tenantId=statex&appId=flipflop&productLine=marketplace&lifecycleStage=activation&purpose=marketing&catalogTag=activation");
    assert.equal(catalogCampaigns.status, 200);
    assert.deepEqual(catalogCampaigns.body.map((item) => item.name), ["Activation launch"]);

    const emptyCatalogCampaigns = await request(baseUrl, "/campaign-catalog/campaigns?tenantId=statex&appId=flipflop&lifecycleStage=reactivation");
    assert.equal(emptyCatalogCampaigns.status, 200);
    assert.deepEqual(emptyCatalogCampaigns.body, []);

    const invalid = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenant: "statex",
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Invalid catalog metadata",
        segmentId: segment.body.segmentId,
        templateRef: "activation-template",
        message: { body: "Hello" },
        catalogMetadata: {
          campaignFamily: "custom-growth-loop",
          lifecycleStage: "custom-stage",
          catalogTags: ["valid", 42],
          approvalStatus: "approved",
          scheduleAt: "2026-06-13T00:00:00.000Z"
        }
      })
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "invalid_campaign_request");
    assert.deepEqual(invalid.body.fields, {
      "catalogMetadata.approvalStatus": "not_catalog_metadata",
      "catalogMetadata.scheduleAt": "not_catalog_metadata",
      "catalogMetadata.campaignFamily": "unsupported_value:custom-growth-loop",
      "catalogMetadata.lifecycleStage": "unsupported_value:custom-stage",
      "catalogMetadata.catalogTags": "must_be_string_array"
    });
  });
});

test("campaign catalog blueprint APIs expose read-only filtered defaults", async () => {
  await withServer(async (baseUrl) => {
    const runlayer = await request(baseUrl, "/campaign-catalog/blueprints?appId=runlayer&purpose=retention&lifecycleStage=feature_adoption");
    assert.equal(runlayer.status, 200);
    assert.deepEqual(runlayer.body.map((item) => item.blueprintId), ["runlayer.feature-adoption.default"]);
    assert.equal(runlayer.body[0].catalogMetadata.sourceBlueprintId, "runlayer.feature-adoption.default");
    assert.equal(Object.prototype.hasOwnProperty.call(runlayer.body[0], "approvalStatus"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(runlayer.body[0], "message"), false);

    const tagged = await request(baseUrl, "/campaign-catalog/blueprints?catalogTag=renewal");
    assert.equal(tagged.status, 200);
    assert.deepEqual(tagged.body.map((item) => item.blueprintId), ["rent-a-box.renewal.default"]);

    const detail = await request(baseUrl, "/campaign-catalog/blueprints/flipflop.abandoned-intent.default");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.appId, "flipflop");
    assert.equal(detail.body.catalogMetadata.sourceBlueprintId, "flipflop.abandoned-intent.default");

    const missing = await request(baseUrl, "/campaign-catalog/blueprints/missing.blueprint");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, "blueprint_not_found");
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


test("journey definition APIs create draft non-executable journeys", async () => {
  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const segment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", productLine: "marketplace", lifecycleScope: "activation", name: "activation segment", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });
    assert.equal(segment.status, 201);

    const campaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenant: "statex",
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        productLine: "marketplace",
        lifecycleScope: "activation",
        name: "Activation step",
        segmentId: segment.body.segmentId,
        templateRef: "activation-template",
        message: { body: "Hello" }
      })
    });
    assert.equal(campaign.status, 201);

    const journey = await request(baseUrl, "/journeys", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        productLine: "marketplace",
        lifecycleScope: "activation",
        name: "Flipflop activation journey",
        description: "Draft definition only",
        trigger: { type: "segment_entry", segmentId: segment.body.segmentId, rules: { source: "signup" } },
        steps: [
          { stepId: "welcome", name: "Welcome", campaignId: campaign.body.campaignId, delayMinutes: 0, maxExecutionsPerRecipient: 1 }
        ],
        exitRules: [
          { ruleId: "became-active", type: "app_signal", rules: { eventType: "user.activated" } }
        ],
        suppressionRules: [
          { ruleId: "recent-send", type: "recently_sent", campaignId: campaign.body.campaignId, windowMinutes: 1440 },
          { ruleId: "unsubscribed", type: "unsubscribed" }
        ]
      })
    });

    assert.equal(journey.status, 201);
    assert.equal(journey.body.status, "draft");
    assert.equal(journey.body.approvalStatus, "pending");
    assert.equal(journey.body.approvedBy, null);
    assert.equal(journey.body.steps[0].campaignId, campaign.body.campaignId);
    assert.equal(journey.body.trigger.segmentId, segment.body.segmentId);
    assert.deepEqual(journey.body.suppressionRules.map((rule) => rule.type), ["recently_sent", "unsubscribed"]);

    const detail = await request(baseUrl, `/journeys/${journey.body.journeyId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.name, "Flipflop activation journey");

    const list = await request(baseUrl, "/journeys?tenantId=statex&appId=flipflop&productLine=marketplace&lifecycleScope=activation");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.map((item) => item.journeyId), [journey.body.journeyId]);
  });
});


test("journey activation requires explicit approval evidence and does not execute steps", async () => {
  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const segment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "activation segment", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });
    assert.equal(segment.status, 201);
    const campaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenant: "statex", tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "Activation step", segmentId: segment.body.segmentId, templateRef: "activation-template", message: { body: "Hello" } })
    });
    assert.equal(campaign.status, 201);
    const journey = await request(baseUrl, "/journeys", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Activation journey",
        trigger: { type: "manual" },
        steps: [{ stepId: "send", name: "Send", campaignId: campaign.body.campaignId, delayMinutes: 0, conditions: { lifecycle: "activation" }, maxExecutionsPerRecipient: 1 }],
        exitRules: [{ ruleId: "manual-exit", type: "manual" }],
        suppressionRules: [{ ruleId: "recent-send", type: "recently_sent", windowMinutes: 1440 }]
      })
    });
    assert.equal(journey.status, 201);

    const blocked = await request(baseUrl, `/journeys/${journey.body.journeyId}/activate`, { method: "POST", headers: auth, body: JSON.stringify({}) });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.error, "journey_not_approved");

    const approveMissingActor = await request(baseUrl, `/journeys/${journey.body.journeyId}/approve`, { method: "POST", headers: auth, body: JSON.stringify({}) });
    assert.equal(approveMissingActor.status, 400);
    assert.equal(approveMissingActor.body.error, "approved_by_required");

    const approved = await request(baseUrl, `/journeys/${journey.body.journeyId}/approve`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ approvedBy: "owner@example.com", approvalNote: "approved for activation" })
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, "draft");
    assert.equal(approved.body.approvalStatus, "approved");
    assert.equal(approved.body.approvedBy, "owner@example.com");
    assert.equal(approved.body.approvalNote, "approved for activation");

    const activated = await request(baseUrl, `/journeys/${journey.body.journeyId}/activate`, { method: "POST", headers: auth, body: JSON.stringify({}) });
    assert.equal(activated.status, 200);
    assert.equal(activated.body.status, "active");
    assert.equal(activated.body.approvalStatus, "approved");
    assert.equal(activated.body.approvedBy, "owner@example.com");
    assert.equal(typeof activated.body.activatedAt, "string");

    const executions = await request(baseUrl, "/executions");
    assert.equal(executions.status, 200);
    assert.deepEqual(executions.body, []);
  });
});

test("journey definitions reject executable metadata and missing references", async () => {
  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const invalid = await request(baseUrl, "/journeys", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Invalid journey",
        status: "active",
        execute: true,
        trigger: { type: "segment_entry" },
        steps: [{ stepId: "send", name: "Send", campaignId: "missing-campaign", delayMinutes: 0, message: { body: "not allowed" } }],
        suppressionRules: [{ ruleId: "bad", type: "provider_throttle" }]
      })
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "invalid_journey_request");
    assert.deepEqual(invalid.body.fields, {
      status: "read_only",
      execute: "read_only",
      "trigger.segmentId": "required_for_segment_entry",
      "steps.0.message": "not_journey_step_metadata",
      "suppressionRules.0.type": "unsupported_value:provider_throttle"
    });

    const missingReferences = await request(baseUrl, "/journeys", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Missing refs",
        trigger: { type: "manual" },
        steps: [{ stepId: "send", name: "Send", campaignId: "missing-campaign", delayMinutes: 0 }],
        exitRules: [{ ruleId: "left", type: "segment_match", segmentId: "missing-segment" }]
      })
    });
    assert.equal(missingReferences.status, 400);
    assert.equal(missingReferences.body.error, "invalid_journey_references");
    assert.deepEqual(missingReferences.body.fields, {
      "segment:missing-segment": "segment_not_found",
      "campaign:missing-campaign": "campaign_not_found"
    });
  });
});


test("journey scheduler claims due active steps idempotently", async () => {
  process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = "true";
  setTestRecipientFixtureProviderForTest(() => testRecipientFixtures);

  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const segment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "activation segment", sourceTypes: ["auth_users"], rules: {}, isDynamic: true })
    });
    assert.equal(segment.status, 201);

    const campaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenant: "statex", tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "Activation step", segmentId: segment.body.segmentId, templateRef: "activation-template", message: { body: "Hello" } })
    });
    assert.equal(campaign.status, 201);

    const approvedCampaign = await request(baseUrl, "/campaigns/" + campaign.body.campaignId + "/approve", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ approvedBy: "owner@example.com" })
    });
    assert.equal(approvedCampaign.status, 200);
    assert.equal(approvedCampaign.body.approvalStatus, "approved");

    const journey = await request(baseUrl, "/journeys", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Activation journey",
        trigger: { type: "manual" },
        steps: [{ stepId: "send", name: "Send", campaignId: campaign.body.campaignId, delayMinutes: 0, conditions: { lifecycle: "activation" }, maxExecutionsPerRecipient: 1 }],
        exitRules: [{ ruleId: "manual-exit", type: "manual" }],
        suppressionRules: [{ ruleId: "recent-send", type: "recently_sent", windowMinutes: 1440 }]
      })
    });
    assert.equal(journey.status, 201);

    const approvedJourney = await request(baseUrl, "/journeys/" + journey.body.journeyId + "/approve", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ approvedBy: "journey-owner@example.com" })
    });
    assert.equal(approvedJourney.status, 200);

    const activated = await request(baseUrl, "/journeys/" + journey.body.journeyId + "/activate", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({})
    });
    assert.equal(activated.status, 200);
    assert.equal(activated.body.status, "active");

    const firstSchedulerRun = await request(baseUrl, "/scheduler/run-due", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ schedulerOwner: "journey-scheduler-test", batchSize: 10, lockTtlMs: 60000 })
    });
    assert.equal(firstSchedulerRun.status, 200);
    assert.equal(firstSchedulerRun.body.claimed, 0);
    assert.equal(firstSchedulerRun.body.journeySteps.claimed, 1);
    assert.equal(firstSchedulerRun.body.journeySteps.executed, 1);
    assert.equal(firstSchedulerRun.body.journeySteps.failed, 0);
    assert.match(firstSchedulerRun.body.journeySteps.runs[0].idempotencyKey, new RegExp("^journey:" + journey.body.journeyId + ":send:"));
    assert.equal(firstSchedulerRun.body.journeySteps.runs[0].campaignId, campaign.body.campaignId);
    assert.equal(firstSchedulerRun.body.journeySteps.decisions.length, 1);
    const stepDecision = firstSchedulerRun.body.journeySteps.decisions[0] as Json;
    const decisionEvidence = stepDecision.decisionEvidence as Json;
    assert.equal(stepDecision.status, "completed");
    assert.equal(stepDecision.idempotencyKey, firstSchedulerRun.body.journeySteps.runs[0].idempotencyKey);
    assert.equal(decisionEvidence.decision, "execute_campaign_step");
    assert.equal(decisionEvidence.reason, "step_due");
    assert.equal(decisionEvidence.idempotencyKey, firstSchedulerRun.body.journeySteps.runs[0].idempotencyKey);
    assert.deepEqual(decisionEvidence.conditionKeys, ["lifecycle"]);
    assert.deepEqual((decisionEvidence.exitRuleRefs as Json[]).map((rule) => rule.type), ["manual"]);
    assert.deepEqual((decisionEvidence.suppressionRuleRefs as Json[]).map((rule) => rule.type), ["recently_sent"]);

    const secondSchedulerRun = await request(baseUrl, "/scheduler/run-due", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ schedulerOwner: "journey-scheduler-test", batchSize: 10, lockTtlMs: 60000 })
    });
    assert.equal(secondSchedulerRun.status, 200);
    assert.equal(secondSchedulerRun.body.journeySteps.claimed, 0);
    assert.equal(secondSchedulerRun.body.journeySteps.executed, 0);

    const executions = await request(baseUrl, "/executions");
    assert.equal(executions.status, 200);
    assert.equal(executions.body.length, 1);
    assert.equal(executions.body[0].idempotencyKey, firstSchedulerRun.body.journeySteps.runs[0].idempotencyKey);
  });
});


test("journey dry-run previews enrollment and next actions without activating or scheduling", async () => {
  process.env.MARKETING_USE_TEST_RECIPIENT_FIXTURES = "true";
  setTestRecipientFixtureProviderForTest(() => testRecipientFixtures);

  await withServer(async (baseUrl) => {
    const auth = { Authorization: "Bearer contract-test-token" };
    const segment = await request(baseUrl, "/segments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "activation segment", sourceTypes: ["auth_users"], rules: {}, isDynamic: true, estimatedCount: 2 })
    });
    assert.equal(segment.status, 201);

    const firstCampaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenant: "statex", tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "Welcome", segmentId: segment.body.segmentId, templateRef: "welcome-template", message: { body: "Hello" } })
    });
    assert.equal(firstCampaign.status, 201);

    const secondCampaign = await request(baseUrl, "/campaigns", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ tenant: "statex", tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "Follow up", segmentId: segment.body.segmentId, templateRef: "follow-template", message: { body: "Next" } })
    });
    assert.equal(secondCampaign.status, 201);

    const journey = await request(baseUrl, "/journeys", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        tenantId: "statex",
        appId: "flipflop",
        brandId: "statex-main",
        environment: "test",
        name: "Activation journey",
        trigger: { type: "segment_entry", segmentId: segment.body.segmentId, rules: { source: "signup" } },
        steps: [
          { stepId: "welcome", name: "Welcome", campaignId: firstCampaign.body.campaignId, delayMinutes: 0 },
          { stepId: "follow-up", name: "Follow up", campaignId: secondCampaign.body.campaignId, delayMinutes: 60 }
        ]
      })
    });
    assert.equal(journey.status, 201);

    const previewStartAt = "2026-06-13T12:00:00.000Z";
    const preview = await request(baseUrl, "/journeys/" + journey.body.journeyId + "/dry-run", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ previewStartAt })
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.status, "dry_run_completed");
    assert.equal(preview.body.dryRun, true);
    assert.equal(preview.body.journeyStatus, "draft");
    assert.equal(preview.body.previewStartAt, previewStartAt);
    assert.deepEqual(preview.body.enrollmentPreview, {
      triggerType: "segment_entry",
      triggerSegmentId: segment.body.segmentId,
      triggerSegmentName: "activation segment",
      triggerRules: { source: "signup" },
      estimatedCount: 2,
      sourceTypes: ["auth_users"]
    });
    assert.equal(preview.body.nextActions.length, 2);
    assert.equal(preview.body.nextActions[0].stepId, "welcome");
    assert.equal(preview.body.nextActions[0].isDue, true);
    assert.equal(preview.body.nextActions[0].wouldSend, 1);
    assert.equal(preview.body.nextActions[0].totalSkipped, 1);
    assert.equal(preview.body.nextActions[0].reasonCounts.dry_run_would_send, 1);
    assert.equal(preview.body.nextActions[0].reasonCounts.unsubscribed, 1);
    assert.equal(preview.body.nextActions[1].stepId, "follow-up");
    assert.equal(preview.body.nextActions[1].dueAt, "2026-06-13T13:00:00.000Z");
    assert.equal(preview.body.nextActions[1].isDue, false);
    assert.equal(preview.body.errors.length, 0);

    const unchangedJourney = await request(baseUrl, "/journeys/" + journey.body.journeyId);
    assert.equal(unchangedJourney.status, 200);
    assert.equal(unchangedJourney.body.status, "draft");
    assert.equal(unchangedJourney.body.activatedAt, null);

    const scheduler = await request(baseUrl, "/scheduler/run-due", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ schedulerOwner: "journey-preview-test" })
    });
    assert.equal(scheduler.status, 200);
    assert.equal(scheduler.body.journeySteps.claimed, 0);

    const executions = await request(baseUrl, "/executions");
    assert.equal(executions.status, 200);
    assert.equal(executions.body.length, 2);
    assert.deepEqual(executions.body.map((run) => run.status).sort(), ["dry_run_completed", "dry_run_completed"]);
    assert.ok(executions.body.every((run) => String(run.idempotencyKey).startsWith("dry-run:journey-dry-run:")));
  });
});


test("segment contract accepts crm account signal source", async () => {
  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, "/segments", {
      method: "POST",
      headers: { Authorization: "Bearer contract-test-token" },
      body: JSON.stringify({ tenantId: "statex", appId: "flipflop", brandId: "statex-main", environment: "test", name: "crm accounts", sourceTypes: ["crm_accounts", "auth_users"], rules: { lifecycleStage: "renewal" }, isDynamic: true })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.sourceTypes, ["crm_accounts", "auth_users"]);
  });
});
