import assert from "assert";
import {
  generateValidatedBrokeringRouteDraft
} from "../mastra/brokeringRouteDraftGeneration";
import type { PageCapabilityManifest } from "../mastra/pageCapabilitySchema";

const manifest: PageCapabilityManifest = {
  pageId: "order-routing.rules",
  route: "/tabs/circuit",
  visibleEntities: {},
  editableTargets: [
    target("route.statusId", "enum", "ROUTING_DRAFT", [
      option("ROUTING_DRAFT"),
      option("ROUTING_ACTIVE"),
      option("ROUTING_ARCHIVED")
    ]),
    target("selectedRule.statusId", "enum", "RULE_DRAFT", [
      option("RULE_DRAFT"),
      option("RULE_ACTIVE"),
      option("RULE_ARCHIVED")
    ]),
    target("selectedRule.inventoryFilters.PROXIMITY", "number"),
    target("selectedRule.inventoryFilters.MEASUREMENT_SYSTEM", "enum", undefined, [
      option("IMPERIAL"),
      option("METRIC")
    ]),
    target("selectedRule.inventorySorts.PROXIMITY", "boolean", false),
    target("selectedRule.partialAllocation", "boolean", false),
    target("selectedRule.partialGroupItemsAllocation", "boolean", false),
    target("selectedRule.unavailableItemsAction", "enum", "ORA_NEXT_RULE", [
      option("ORA_NEXT_RULE"),
      option("ORA_MV_TO_QUEUE")
    ]),
    target("selectedRule.clearAutoCancelDays", "boolean", false),
    target("selectedRule.autoCancelDays", "number", 0)
  ],
  outputContract: {
    operations: ["set"],
    operationShape: {},
    responseShape: {}
  }
};

function option(id: string) {
  return { id, label: id };
}

function target(targetName: string, valueType: string, currentValue?: unknown, options?: any[]) {
  return {
    target: targetName,
    label: targetName,
    valueType,
    currentValue,
    options,
    editable: true
  };
}

function draftWithProximity(unit: "IMPERIAL" | null) {
  return {
    schemaVersion: "brokering-route-draft.v1",
    applyMode: "merge",
    route: {
      statusId: "ROUTING_DRAFT",
      orderSelection: {
        filters: {
          queues: { include: [], exclude: [] },
          shippingMethods: { include: [], exclude: [] },
          priorities: { include: [], exclude: [] },
          promiseDateDays: { max: null, excludeMax: null },
          salesChannels: { include: [], exclude: [] },
          originFacilityGroups: { include: [], exclude: [] }
        },
        sorts: []
      },
      inventoryRules: [{
        ruleKey: "new:stores-fallback",
        name: "Stores fallback",
        statusId: "RULE_DRAFT",
        sequence: 10,
        inventorySelection: {
          filters: {
            facilityGroups: { include: [], exclude: [] },
            proximity: { maxDistance: null, unit },
            safetyStock: { minimum: null },
            facilityOrderLimit: "unchanged",
            shipmentThreshold: null
          },
          sorts: [{ field: "proximity", direction: "asc" }]
        },
        allocation: {
          partialOrderAllocation: false,
          partialGroupedItemAllocation: false
        },
        unavailableItems: {
          action: "nextRule",
          queueId: null,
          autoCancel: { mode: "none", days: null }
        }
      }]
    },
    questions: [],
    summary: "Drafted stores fallback."
  };
}

{
  let attempts = 0;
  const prompts: any[] = [];
  const result = await generateValidatedBrokeringRouteDraft({
    prompt: "Use closest stores.",
    conversationHistory: [],
    orderRoutingDomainKnowledge: "domain knowledge",
    pageCapabilityManifest: manifest,
    outputContract: manifest.outputContract,
    maxAttempts: 2,
    generate: async (messages) => {
      attempts += 1;
      prompts.push(JSON.parse(messages[0].content));
      return {
        object: attempts === 1
          ? draftWithProximity("IMPERIAL")
          : draftWithProximity(null)
      };
    }
  });

  assert.equal(attempts, 2);
  assert.ok(prompts[1].previousValidationFailure.issues[0].includes("unit requires"));
  assert.equal(result.route.inventoryRules[0].inventorySelection.filters.proximity.unit, null);
}

console.log("Brokering route draft generation tests passed");
