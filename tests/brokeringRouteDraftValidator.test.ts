import assert from "assert";
import {
  BrokeringRouteDraftValidationError,
  validateBrokeringRouteDraftJson
} from "../mastra/brokeringRouteDraftValidator";
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
    target("route.orderFilters.QUEUE", "string[]", [], [
      option("BROKERING_QUEUE"),
      option("UNFILLABLE_PARKING")
    ], true),
    target("route.orderFilters.QUEUE_EXCLUDED", "string[]", [], [
      option("BROKERING_QUEUE"),
      option("UNFILLABLE_PARKING")
    ], true),
    target("route.orderSorts.SHIP_BY", "boolean", false),
    target("selectedRule.statusId", "enum", "RULE_DRAFT", [
      option("RULE_DRAFT"),
      option("RULE_ACTIVE"),
      option("RULE_ARCHIVED")
    ]),
    target("selectedRule.inventoryFilters.FACILITY_GROUP", "enum", undefined, [
      option("STORES"),
      option("WAREHOUSES")
    ]),
    target("selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED", "enum", undefined, [
      option("STORES"),
      option("WAREHOUSES")
    ]),
    target("selectedRule.inventoryFilters.PROXIMITY", "number"),
    target("selectedRule.inventoryFilters.MEASUREMENT_SYSTEM", "enum", undefined, [
      option("IMPERIAL"),
      option("METRIC")
    ]),
    target("selectedRule.inventoryFilters.BRK_SAFETY_STOCK", "number"),
    target("selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT", "boolean", undefined, [
      option("false"),
      option("true")
    ]),
    target("selectedRule.inventorySorts.PROXIMITY", "boolean", false),
    target("selectedRule.inventorySorts.INV_BALANCE", "boolean", false),
    target("selectedRule.partialAllocation", "boolean", false),
    target("selectedRule.partialGroupItemsAllocation", "boolean", false),
    target("selectedRule.unavailableItemsAction", "enum", "ORA_NEXT_RULE", [
      option("ORA_NEXT_RULE"),
      option("ORA_MV_TO_QUEUE")
    ]),
    target("selectedRule.unavailableItemsQueueId", "enum", null, [
      option("BROKERING_QUEUE"),
      option("UNFILLABLE_PARKING")
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

function target(targetName: string, valueType: string, currentValue?: unknown, options?: any[], multiple = false) {
  return {
    target: targetName,
    label: targetName,
    valueType,
    currentValue,
    options,
    multiple,
    editable: true
  };
}

function validDraft(overrides: Record<string, unknown> = {}) {
  const draft = {
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
        sorts: [{ field: "shipByDate", direction: "asc" }]
      },
      inventoryRules: [
        {
          ruleKey: "new:stores-first",
          name: "Stores first",
          statusId: "RULE_DRAFT",
          sequence: 10,
          inventorySelection: {
            filters: {
              facilityGroups: { include: ["STORES"], exclude: ["WAREHOUSES"] },
              proximity: { maxDistance: 50, unit: "IMPERIAL" },
              safetyStock: { minimum: 5 },
              facilityOrderLimit: "respect",
              shipmentThreshold: null
            },
            sorts: [{ field: "proximity", direction: "asc" }]
          },
          allocation: {
            partialOrderAllocation: false,
            partialGroupedItemAllocation: false
          },
          unavailableItems: {
            action: "moveToQueue",
            queueId: "UNFILLABLE_PARKING",
            autoCancel: { mode: "none", days: null }
          }
        }
      ]
    },
    questions: [],
    summary: "Drafted a stores-first brokering route.",
    ...overrides
  };

  return draft;
}

function validationError(value: unknown) {
  try {
    validateBrokeringRouteDraftJson(value, manifest);
  } catch (error) {
    assert.ok(error instanceof BrokeringRouteDraftValidationError);
    return error;
  }

  assert.fail("Expected brokering route draft validation to fail");
}

{
  const result = validateBrokeringRouteDraftJson(validDraft(), manifest);
  assert.equal(result.schemaVersion, "brokering-route-draft.v1");
  assert.equal(result.route.inventoryRules.length, 1);
}

{
  const manifestWithoutFacilityGroupOptions: PageCapabilityManifest = {
    ...manifest,
    editableTargets: manifest.editableTargets.map((target) => {
      if (target.target === "selectedRule.inventoryFilters.FACILITY_GROUP") {
        const { options: _options, ...targetWithoutOptions } = target as any;
        return targetWithoutOptions;
      }

      return target;
    })
  };
  const draft = validDraft();
  draft.route.inventoryRules[0].inventorySelection.filters.facilityGroups = {
    include: ["WAREHOUSES"],
    exclude: []
  };
  const result = validateBrokeringRouteDraftJson(draft, manifestWithoutFacilityGroupOptions);
  assert.equal(result.route.inventoryRules[0].inventorySelection.filters.facilityGroups.include[0], "WAREHOUSES");
}

{
  const error = validationError(validDraft({ schemaVersion: "draft-plan.v1" }));
  assert.ok(error.issues.some((issue) => issue.includes("only validates schemaVersion 'brokering-route-draft.v1'")));
}

{
  const error = validationError(validDraft({
    route: {
      ...validDraft().route,
      orderSelection: {
        ...validDraft().route.orderSelection,
        filters: {
          ...validDraft().route.orderSelection.filters,
          queues: { include: ["UNKNOWN_QUEUE"], exclude: [] }
        }
      }
    }
  }));
  assert.ok(error.issues.some((issue) => issue.includes("UNKNOWN_QUEUE")));
}

{
  const draft = validDraft();
  draft.route.inventoryRules[0].unavailableItems = {
    action: "moveToQueue",
    queueId: null,
    autoCancel: { mode: "none", days: null }
  };
  const error = validationError(draft);
  assert.ok(error.issues.some((issue) => issue.includes("queueId is required")));
}

{
  const draft = validDraft();
  draft.route.inventoryRules[0].inventorySelection.sorts = [
    { field: "proximity", direction: "asc" },
    { field: "proximity", direction: "desc" }
  ];
  const error = validationError(draft);
  assert.ok(error.issues.some((issue) => issue.includes("duplicate sort field 'proximity'")));
}

{
  const draft = validDraft();
  draft.route.inventoryRules[0].allocation = {
    partialOrderAllocation: false,
    partialGroupedItemAllocation: true
  };
  const error = validationError(draft);
  assert.ok(error.issues.some((issue) => issue.includes("partialOrderAllocation")));
}

// --- targetRouting.action="create" validation ---

// Helper: extend the existing manifest with sibling-routing fields for create tests.
function manifestWithSiblings(siblings: Array<{ orderRoutingId: string; routingName: string; statusId: string; sequenceNum: number }>, allow = true): PageCapabilityManifest {
  return {
    ...manifest,
    visibleEntities: {
      ...(manifest.visibleEntities as any),
      brokeringRun: { availableSiblingRoutings: siblings },
      route: { draftLimitations: { canCreateSiblingRoutings: allow } }
    }
  };
}

// Happy path: create with new: ruleKey, unique name
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:west-coast", name: "West Coast" }
  });
  const result = validateBrokeringRouteDraftJson(draft, manifestWithSiblings([
    { orderRoutingId: "ROUTING_A", routingName: "East Coast", statusId: "ROUTING_ACTIVE", sequenceNum: 20 }
  ]));
  assert.equal(result.targetRouting?.action, "create");
  assert.equal(result.targetRouting?.routingKey, "new:west-coast");
}

// Reject: canCreateSiblingRoutings = false blocks creation
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:x", name: "X" }
  });
  let caught: any;
  try {
    validateBrokeringRouteDraftJson(draft, manifestWithSiblings([], false));
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof BrokeringRouteDraftValidationError, "must throw when creation is disallowed");
  assert.match(String(caught.issues?.[0] ?? caught.message), /not permitted/i);
}

// Reject: missing name
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:x" }
  });
  let caught: any;
  try {
    validateBrokeringRouteDraftJson(draft, manifestWithSiblings([]));
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof BrokeringRouteDraftValidationError, "must throw when name is missing");
  assert.match(String(caught.issues?.[0] ?? caught.message), /non-empty name/i);
}

// Reject: routingKey without new: prefix
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:west-coast", name: "West Coast" }
  });
  // Re-strip the prefix on a fresh JSON copy so we can test the validator's own gate.
  const raw = JSON.parse(JSON.stringify(draft));
  raw.targetRouting.routingKey = "west-coast";
  let caught: any;
  try {
    validateBrokeringRouteDraftJson(raw, manifestWithSiblings([]));
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof BrokeringRouteDraftValidationError, "must throw when routingKey is missing the new: prefix");
  assert.match(String(caught.issues?.[0] ?? caught.message), /new:/);
}

// Reject: name collision with non-archived sibling (case-insensitive)
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:east-coast", name: "east COAST" }
  });
  let caught: any;
  try {
    validateBrokeringRouteDraftJson(draft, manifestWithSiblings([
      { orderRoutingId: "ROUTING_A", routingName: "East Coast", statusId: "ROUTING_ACTIVE", sequenceNum: 20 }
    ]));
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof BrokeringRouteDraftValidationError, "must throw on case-insensitive name collision");
  assert.match(String(caught.issues?.[0] ?? caught.message), /already exists/i);
}

// Allow: archived sibling with the same name does NOT collide
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:east-coast", name: "East Coast" }
  });
  const result = validateBrokeringRouteDraftJson(draft, manifestWithSiblings([
    { orderRoutingId: "ROUTING_OLD", routingName: "East Coast", statusId: "ROUTING_ARCHIVED", sequenceNum: 10 }
  ]));
  assert.equal(result.targetRouting?.action, "create");
}

// Reject: inventory rule with non-new: key on a create draft
{
  const draft = validDraft({
    targetRouting: { action: "create", routingKey: "new:x", name: "X" }
  });
  // Mutate the first inventory rule's ruleKey so it's not "new:"
  draft.route.inventoryRules[0].ruleKey = "EXISTING_RULE_ID";
  let caught: any;
  try {
    validateBrokeringRouteDraftJson(draft, manifestWithSiblings([]));
  } catch (e) {
    caught = e;
  }
  assert.ok(caught instanceof BrokeringRouteDraftValidationError, "must throw when a create draft references a non-new rule");
  assert.match(String(caught.issues?.[0] ?? caught.message), /new:/);
}

// Edit path with sibling fields present must still validate (back-compat)
{
  const draft = validDraft(); // no targetRouting
  const result = validateBrokeringRouteDraftJson(draft, manifestWithSiblings([
    { orderRoutingId: "ROUTING_A", routingName: "East Coast", statusId: "ROUTING_ACTIVE", sequenceNum: 20 }
  ]));
  // Schema doesn't require targetRouting; if absent in input, validator does not add it.
  // The assertion is that this still validates without throwing.
  assert.ok(result.route);
}

console.log("Brokering route draft validator tests passed");
