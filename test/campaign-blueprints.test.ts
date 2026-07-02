import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultCampaignBlueprint, getHolidayDiscountCampaignContentContract, listDefaultCampaignBlueprints } from "../src/campaign-blueprints";

const expectedApps = ["flipflop", "speakasap", "marathon", "bazos", "rent-a-box", "runlayer", "shop-assistant", "statics"];
const forbiddenBlueprintFields = ["approvalStatus", "approvedBy", "approvedAt", "approvalNote", "status", "scheduleAt", "execute", "dryRun", "message"];

test("default campaign blueprints cover the application portfolio", () => {
  const blueprints = listDefaultCampaignBlueprints();
  const apps = new Set(blueprints.map((blueprint) => blueprint.appId));
  assert.ok(blueprints.length >= expectedApps.length);
  for (const app of expectedApps) {
    assert.equal(apps.has(app), true, `missing blueprint coverage for ${app}`);
  }
  assert.equal(new Set(blueprints.map((blueprint) => blueprint.blueprintId)).size, blueprints.length);
});

test("campaign blueprints are non-executable metadata and segment suggestions", () => {
  for (const blueprint of listDefaultCampaignBlueprints()) {
    for (const field of forbiddenBlueprintFields) {
      assert.equal(Object.prototype.hasOwnProperty.call(blueprint, field), false, `${blueprint.blueprintId} must not contain ${field}`);
      assert.equal(Object.prototype.hasOwnProperty.call(blueprint.catalogMetadata, field), false, `${blueprint.blueprintId} catalog metadata must not contain ${field}`);
    }
    assert.equal(blueprint.catalogMetadata.sourceBlueprintId, blueprint.blueprintId);
    assert.equal(blueprint.catalogMetadata.campaignFamily, blueprint.campaignFamily);
    assert.equal(blueprint.catalogMetadata.lifecycleStage, blueprint.lifecycleStage);
    assert.equal(blueprint.catalogMetadata.audienceKey, blueprint.audienceKey);
    assert.ok(blueprint.templateRef.length > 0);
    assert.ok(blueprint.segment.sourceTypes.length > 0);
    assert.equal(blueprint.segment.isDynamic, true);
  }
});

test("campaign blueprint lookup and filters are deterministic", () => {
  const runlayer = getDefaultCampaignBlueprint("runlayer.feature-adoption.default");
  assert.equal(runlayer?.appId, "runlayer");
  assert.equal(runlayer?.purpose, "retention");

  const retention = listDefaultCampaignBlueprints({ purpose: "retention" });
  assert.deepEqual(retention.map((blueprint) => blueprint.blueprintId).sort(), [
    "runlayer.crm-onboarding.default",
    "runlayer.crm-renewal.default",
    "runlayer.feature-adoption.default",
    "statics.retention.default"
  ]);

  const crmAccountBlueprints = listDefaultCampaignBlueprints({ catalogTag: "crm_accounts" });
  assert.deepEqual(crmAccountBlueprints.map((blueprint) => blueprint.blueprintId), [
    "runlayer.crm-onboarding.default",
    "runlayer.crm-renewal.default",
    "runlayer.crm-upsell.default",
    "runlayer.crm-winback.default"
  ]);

  const flipflop = listDefaultCampaignBlueprints({ appId: "flipflop", lifecycleStage: "abandoned_intent" });
  assert.deepEqual(flipflop.map((blueprint) => blueprint.blueprintId), ["flipflop.abandoned-intent.default"]);
});


test("b2b crm account blueprints use read-only crm segment rules", () => {
  const expectedRules = new Map<string, Record<string, string | number | boolean>>([
    ["runlayer.crm-onboarding.default", { lifecycleStage: "onboarding", onboardingStatus: "blocked", healthStatus: "at_risk" }],
    ["runlayer.crm-renewal.default", { lifecycleStage: "renewal", opportunityType: "renewal", opportunityStatus: "open" }],
    ["runlayer.crm-upsell.default", { lifecycleStage: "expansion", opportunityType: "upsell", opportunityStatus: "open", healthScoreMin: 70 }],
    ["runlayer.crm-winback.default", { lifecycleStage: "winback", opportunityType: "winback", opportunityStatus: "open", healthStatus: "at_risk" }]
  ]);

  for (const [blueprintId, rules] of expectedRules) {
    const blueprint = getDefaultCampaignBlueprint(blueprintId);
    assert.ok(blueprint, `missing ${blueprintId}`);
    assert.equal(blueprint.appId, "runlayer");
    assert.equal(blueprint.catalogCategory, "b2b_account_lifecycle");
    assert.equal(blueprint.segment.isDynamic, true);
    assert.deepEqual(blueprint.segment.sourceTypes, ["crm_accounts", "auth_users", "leads"]);
    assert.deepEqual(blueprint.segment.rules, rules);
    assert.equal(Object.prototype.hasOwnProperty.call(blueprint.segment.rules, "contactRefs"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(blueprint, "approvalStatus"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(blueprint, "message"), false);
  }
});


test("holiday discount content contract exposes typed non-executable slot refs", () => {
  const blueprint = getDefaultCampaignBlueprint("holiday-2026-main");
  assert.ok(blueprint, "missing holiday discount blueprint");
  assert.equal(blueprint.appId, "shop-assistant");
  assert.equal(blueprint.templateRef, "holiday-2026-main");
  assert.equal(blueprint.segment.rules.processId, "holiday-discount-2026");
  assert.equal(blueprint.segment.rules.processVersion, 1);
  assert.equal(blueprint.segment.rules.policyRef, "holiday-10-percent-selected-categories");
  assert.equal(Object.prototype.hasOwnProperty.call(blueprint, "message"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(blueprint, "execute"), false);

  const contract = getHolidayDiscountCampaignContentContract();
  assert.equal(contract.processId, "holiday-discount-2026");
  assert.equal(contract.processVersion, 1);
  assert.equal(contract.policyRef, "holiday-10-percent-selected-categories");
  assert.equal(contract.campaignRef, "holiday-2026-main");
  assert.deepEqual(contract.contentRefs.map((item) => item.slot), ["product_badge", "cart_banner", "upsell_block", "post_purchase_message"]);
  for (const ref of contract.contentRefs) {
    assert.match(ref.contentRef, /^marketing:holiday-2026-main:/);
    assert.equal(ref.metadata?.processId, "holiday-discount-2026");
    assert.equal(ref.metadata?.processVersion, 1);
    assert.equal(ref.metadata?.policyRef, "holiday-10-percent-selected-categories");
    for (const field of ["execute", "delivery", "send", "price", "discount", "cart", "checkout"]) {
      assert.equal(Object.prototype.hasOwnProperty.call(ref, field), false, `${ref.slot} must not contain ${field}`);
      assert.equal(Object.prototype.hasOwnProperty.call(ref.metadata ?? {}, field), false, `${ref.slot} metadata must not contain ${field}`);
    }
  }
});
