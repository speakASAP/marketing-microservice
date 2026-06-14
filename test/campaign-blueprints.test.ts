import test from "node:test";
import assert from "node:assert/strict";
import { getDefaultCampaignBlueprint, listDefaultCampaignBlueprints } from "../src/campaign-blueprints";

const expectedApps = ["flipflop", "speakasap", "marathon", "bazos", "rent-a-box", "runlayer", "shop-assistant", "statics"];
const forbiddenBlueprintFields = ["approvalStatus", "approvedBy", "approvedAt", "approvalNote", "status", "scheduleAt", "execute", "dryRun", "message"];

test("default campaign blueprints cover the application portfolio", () => {
  const blueprints = listDefaultCampaignBlueprints();
  assert.equal(blueprints.length, expectedApps.length);
  assert.deepEqual([...new Set(blueprints.map((blueprint) => blueprint.appId))].sort(), [...expectedApps].sort());
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
  assert.deepEqual(retention.map((blueprint) => blueprint.blueprintId).sort(), ["runlayer.feature-adoption.default", "statics.retention.default"]);

  const flipflop = listDefaultCampaignBlueprints({ appId: "flipflop", lifecycleStage: "abandoned_intent" });
  assert.deepEqual(flipflop.map((blueprint) => blueprint.blueprintId), ["flipflop.abandoned-intent.default"]);
});
