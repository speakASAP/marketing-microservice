import test from "node:test";
import assert from "node:assert/strict";
import { appendUnsubscribeLink, shouldAppendUnsubscribeLink } from "../src/executor";

const campaign: any = {
  tenantId: "statex",
  appId: "marathon",
  purpose: "marketing",
  primaryChannel: "email",
};

process.env.MARKETING_UNSUBSCRIBE_SECRET = "test-secret-value";

test("appends an unsubscribe URL on the product's own domain", () => {
  const out = appendUnsubscribeLink("Hello", campaign, "user-1");
  assert.ok(out.includes("https://marathon.alfares.cz/unsubscribe?token="));
});

test("uses the speakasap domain for speakasap campaigns", () => {
  const out = appendUnsubscribeLink("Hello", { ...campaign, appId: "speakasap" }, "user-1");
  assert.ok(out.includes("https://speakasap.alfares.cz/unsubscribe?token="));
});

test("keeps the original body intact", () => {
  const out = appendUnsubscribeLink("Hello body", campaign, "user-1");
  assert.ok(out.startsWith("Hello body"));
});

test("mints a token that carries the recipient and product", () => {
  const out = appendUnsubscribeLink("Hello", campaign, "user-1");
  const token = out.split("token=")[1].trim();
  const payload = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
  assert.ok(payload.startsWith("user-1|marathon|"));
});

test("refuses to build a link without a configured secret", () => {
  const saved = process.env.MARKETING_UNSUBSCRIBE_SECRET;
  delete process.env.MARKETING_UNSUBSCRIBE_SECRET;
  assert.throws(() => appendUnsubscribeLink("Hello", campaign, "user-1"));
  process.env.MARKETING_UNSUBSCRIBE_SECRET = saved;
});

test("refuses to send marketing to a contact with no resolvable auth user id", () => {
  assert.throws(() => appendUnsubscribeLink("Hello", campaign, undefined));
});

test("applies to marketing campaigns for our consent-backed products", () => {
  assert.equal(shouldAppendUnsubscribeLink(campaign), true);
  assert.equal(shouldAppendUnsubscribeLink({ ...campaign, appId: "speakasap" }), true);
});

test("leaves transactional mail and other apps untouched", () => {
  assert.equal(shouldAppendUnsubscribeLink({ ...campaign, purpose: "system" }), false);
  assert.equal(shouldAppendUnsubscribeLink({ ...campaign, appId: "flipflop" }), false);
});
