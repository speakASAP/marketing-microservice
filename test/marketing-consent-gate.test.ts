import test from "node:test";
import assert from "node:assert/strict";
import { hasMarketingConsent } from "../src/sources";

// campaign.appId is the product; campaign.tenantId is "statex", the company.
const campaign: any = {
  tenantId: "statex",
  tenant: "statex",
  appId: "marathon",
  purpose: "marketing",
  primaryChannel: "email",
};

test("allows a recipient with live consent for this product", () => {
  assert.equal(hasMarketingConsent({ marketingConsents: { marathon: true } }, campaign), true);
});

test("refuses a recipient whose consent is for a different product", () => {
  assert.equal(
    hasMarketingConsent({ marketingConsents: { speakasap: true, marathon: false } }, campaign),
    false,
  );
});

test("refuses a recipient with no consent record at all", () => {
  assert.equal(hasMarketingConsent({}, campaign), false);
});

test("refuses a recipient with an empty consent object", () => {
  assert.equal(hasMarketingConsent({ marketingConsents: {} }, campaign), false);
});

test("refuses when consent is explicitly withdrawn", () => {
  assert.equal(hasMarketingConsent({ marketingConsents: { marathon: false } }, campaign), false);
});

test("does not let a tenant-level key grant consent for every app", () => {
  assert.equal(hasMarketingConsent({ marketingConsents: { statex: true } }, campaign), false);
});
