import assert from "assert";
import {
  brokeringRouteDraftSchema,
  normalizeBrokeringRouteDraft
} from "../mastra/brokeringRouteDraftSchema";

{
  const result = brokeringRouteDraftSchema.safeParse({
    schemaVersion: "brokering-route-draft.v1",
    applyMode: "merge",
    route: {
      statusId: "ROUTING_DRAFT",
      orderSelection: {
        filters: {
          queues: { include: [], exclude: ["UNFILLABLE_PARKING"] },
          shippingMethods: { include: ["GROUND"], exclude: [] },
          priorities: { include: [], exclude: [] },
          promiseDateDays: { max: 2, excludeMax: null },
          salesChannels: { include: ["WEB"], exclude: [] },
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
            sorts: [
              { field: "proximity", direction: "asc" },
              { field: "inventoryBalance", direction: "desc" }
            ]
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
    summary: "Drafted a stores-first brokering route."
  });

  assert.equal(result.success, true);
}

{
  const result = brokeringRouteDraftSchema.safeParse({
    schemaVersion: "brokering-route-draft.v1",
    applyMode: "merge",
    route: {
      statusId: "ROUTING_DRAFT",
      orderSelection: {
        filters: {
          queues: { include: [], exclude: [], extra: true },
          shippingMethods: { include: [], exclude: [] },
          priorities: { include: [], exclude: [] },
          promiseDateDays: { max: null, excludeMax: null },
          salesChannels: { include: [], exclude: [] },
          originFacilityGroups: { include: [], exclude: [] }
        },
        sorts: []
      },
      inventoryRules: []
    },
    questions: [],
    summary: "Invalid draft."
  });

  assert.equal(result.success, false);
}

{
  const result = brokeringRouteDraftSchema.safeParse({
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
      inventoryRules: [
        {
          ruleKey: "new:invalid",
          name: "Invalid",
          statusId: "RULE_DRAFT",
          sequence: 1,
          inventorySelection: {
            filters: {
              facilityGroups: { include: [], exclude: [] },
              proximity: { maxDistance: null, unit: null },
              safetyStock: { minimum: null },
              facilityOrderLimit: "ignore",
              shipmentThreshold: null
            },
            sorts: []
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
        }
      ]
    },
    questions: [],
    summary: "Invalid draft."
  });

  assert.equal(result.success, false);
}

{
  const normalized = normalizeBrokeringRouteDraft({
    schemaVersion: "wrong",
    applyMode: "replace",
    route: {
      statusId: "ROUTING_ACTIVE",
      orderSelection: {
        filters: {
          queues: { include: ["QUEUE_A"] }
        },
        sorts: [{ field: "priority" }]
      },
      inventoryRules: []
    },
    summary: ""
  });

  assert.equal(normalized.schemaVersion, "brokering-route-draft.v1");
  assert.equal(normalized.applyMode, "replace");
  assert.deepEqual(normalized.route.orderSelection.filters.queues, { include: ["QUEUE_A"], exclude: [] });
  assert.deepEqual(normalized.route.orderSelection.filters.shippingMethods, { include: [], exclude: [] });
  assert.deepEqual(normalized.route.orderSelection.sorts, [{ field: "priority", direction: "asc" }]);
  assert.deepEqual(normalized.questions, []);
  assert.equal(normalized.summary, "Drafted brokering route changes.");
}

console.log("Brokering route draft schema tests passed");
