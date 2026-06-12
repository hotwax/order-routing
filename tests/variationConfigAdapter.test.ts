// tests/variationConfigAdapter.test.ts
import assert from "node:assert";
import { toConfigPayload, fromVariationRoutings } from "../src/util/variationConfigAdapter";

// ---- Outbound: canvas `working` tree -> PUT /config payload --------------------------------------
const workingRoutings = [
  {
    orderRoutingId: "VM1_100008", routingName: "Standard", statusId: "ROUTING_ACTIVE", sequenceNum: 5,
    orderFilters: [
      { conditionSeqId: "06", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 3 },
      // exclusion: normalized form carries the _excluded suffix; payload must strip it back off
      { conditionSeqId: "07", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId_excluded", operator: "not-equals", fieldValue: "_NA_", sequenceNum: 4 },
    ],
    rules: [
      {
        routingRuleId: "VM1_100524", ruleName: "Pick", statusId: "RULE_ACTIVE", sequenceNum: 1, assignmentEnumId: "ORA_SELECTED",
        inventoryFilters: [
          { conditionSeqId: "01", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "equals", fieldValue: "PICKUP", sequenceNum: 0 },
          { conditionSeqId: "02", conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "distance", operator: null, fieldValue: null, sequenceNum: 1 },
        ],
        actions: [
          { actionSeqId: "01", actionTypeEnumId: "ORA_MV_TO_QUEUE", actionValue: "UNFILLABLE_PARKING" },
        ],
      },
    ],
  },
];

// toConfigPayload returns the bare routings ARRAY — the service layer (variationRequests.replaceConfig)
// owns wrapping it as the { routings } request body. Returning an object here caused a double-wrap
// ({ routings: { routings: [...] } }) that the backend 400'd on.
const payload = toConfigPayload(workingRoutings);
assert.ok(Array.isArray(payload), "toConfigPayload must return an array, not a body object");
assert.deepStrictEqual(payload, [
    {
      routingName: "Standard", statusId: "ROUTING_ACTIVE", sequenceNum: 5,
      filters: [
        { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 3 },
        { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId", operator: "not-equals", fieldValue: "_NA_", sequenceNum: 4 },
      ],
      rules: [
        {
          ruleName: "Pick", statusId: "RULE_ACTIVE", sequenceNum: 1, assignmentEnumId: "ORA_SELECTED",
          inventoryConditions: [
            { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "equals", fieldValue: "PICKUP", sequenceNum: 0 },
            { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "distance", operator: null, fieldValue: null, sequenceNum: 1 },
          ],
          actions: [
            { actionTypeEnumId: "ORA_MV_TO_QUEUE", actionValue: "UNFILLABLE_PARKING" },
          ],
        },
      ],
    },
]);

// ---- Inbound: GET /variations tree -> canvas `working` shape -------------------------------------
const variationRoutings = [
  {
    orderRoutingId: "VM1_100008", routingName: "Standard", statusId: "ROUTING_ACTIVE", sequenceNum: 5,
    filters: [
      // out of order on purpose -> must sort by sequenceNum
      { conditionSeqId: "07", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId", operator: "not-equals", fieldValue: "_NA_", sequenceNum: 4 },
      { conditionSeqId: "06", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 3 },
    ],
    rules: [
      {
        routingRuleId: "VM1_100524", ruleName: "Pick", statusId: "RULE_ACTIVE", sequenceNum: 1, assignmentEnumId: "ORA_SELECTED",
        inventoryConditions: [
          { conditionSeqId: "01", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "equals", fieldValue: "PICKUP", sequenceNum: 0 },
        ],
        actions: [{ actionSeqId: "01", actionTypeEnumId: "ORA_NEXT_RULE", actionValue: null }],
      },
    ],
  },
];

const canvas = fromVariationRoutings(variationRoutings);
// renamed collections + sorted + _excluded rewrite on the not-equals filter
assert.strictEqual(canvas[0].orderFilters[0].fieldName, "salesChannelEnumId"); // seq 3 first
assert.strictEqual(canvas[0].orderFilters[1].fieldName, "facilityId_excluded"); // not-equals -> _excluded
assert.strictEqual(canvas[0].orderFilters[1].operator, "not-equals");
assert.strictEqual(canvas[0].rules[0].inventoryFilters[0].fieldName, "facilityGroupId");
assert.strictEqual(canvas[0].rules[0].actions[0].actionTypeEnumId, "ORA_NEXT_RULE");
assert.strictEqual(canvas[0].rules[0].assignmentEnumId, "ORA_SELECTED");
// ids preserved for the canvas (it keys on them)
assert.strictEqual(canvas[0].orderRoutingId, "VM1_100008");
assert.strictEqual(canvas[0].rules[0].routingRuleId, "VM1_100524");

// round-trip: fromVariationRoutings -> toConfigPayload strips the _excluded suffix back off
const round = toConfigPayload(canvas);
assert.strictEqual(round[0].filters.find((f: any) => f.operator === "not-equals").fieldName, "facilityId");

console.log("variationConfigAdapter tests passed");
