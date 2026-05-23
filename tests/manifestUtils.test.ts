import assert from "assert";
import {
  pruneManifestForDraft,
  pruneManifestForInquiry
} from "../mastra/manifestUtils";
import type { PageCapabilityManifest } from "../mastra/pageCapabilitySchema";

const manifest: PageCapabilityManifest = {
  pageId: "order-routing.rules",
  route: "/tabs/circuit",
  visibleEntities: {
    brokeringRun: { groupName: "Holiday run" },
    route: {
      routingName: "US 2-day",
      statusId: "ROUTING_DRAFT",
      availableInventoryRules: [
        { routingRuleId: "rule-warehouse-1", ruleName: "Warehouses", statusId: "RULE_ACTIVE", sequenceNum: 10 },
        { routingRuleId: "rule-stores-1", ruleName: "Stores fallback", statusId: "RULE_ACTIVE", sequenceNum: 20 }
      ],
      draftLimitations: { canCreateInventoryRules: true }
    },
    selectedRule: { routingRuleId: "rule-warehouse-1", ruleName: "Warehouses" }
  },
  editableTargets: [
    { target: "route.statusId", editable: true, currentValue: "ROUTING_DRAFT" },
    { target: "selectedRule.statusId", editable: true, staticDisabled: true, currentValue: "RULE_DRAFT" }
  ],
  outputContract: { operations: ["set"] }
};

{
  const pruned = pruneManifestForDraft(manifest);

  assert.deepEqual(pruned.editableTargets.map((target: any) => target.target), ["route.statusId"],
    "pruneManifestForDraft should strip staticDisabled targets");

  const route = (pruned.visibleEntities as any).route;
  assert.ok(route, "pruneManifestForDraft must keep visibleEntities.route");
  assert.equal(route.routingName, "US 2-day");
  assert.equal(route.statusId, "ROUTING_DRAFT");
  assert.equal(route.availableInventoryRules.length, 2,
    "pruneManifestForDraft must retain availableInventoryRules so the agent can reuse routingRuleId instead of inventing new:* keys");
  assert.equal(route.availableInventoryRules[0].routingRuleId, "rule-warehouse-1");
  assert.deepEqual(route.draftLimitations, { canCreateInventoryRules: true });

  assert.equal((pruned.visibleEntities as any).selectedRule?.routingRuleId, "rule-warehouse-1",
    "pruneManifestForDraft must retain selectedRule so the agent defaults to editing it");

  assert.equal((pruned.visibleEntities as any).brokeringRun, undefined,
    "pruneManifestForDraft should not leak unrelated visibleEntities like brokeringRun");
}

{
  const inquiry = pruneManifestForInquiry(manifest);
  assert.deepEqual(inquiry.visibleEntities, manifest.visibleEntities,
    "pruneManifestForInquiry should keep visibleEntities untouched");
  assert.equal((inquiry as any).editableTargets, undefined,
    "pruneManifestForInquiry should drop editableTargets");
}

console.log("manifestUtils tests passed");
