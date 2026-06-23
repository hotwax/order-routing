import assert from "assert";
import { it, vi } from "vitest";
// @common's barrel eagerly imports .vue components (Login.vue, ImageModal.vue via imagePreview),
// which node can't load. Mock the (tiny) surface DraftAssistantService actually uses so this runs
// under vitest. fetch is stubbed inline per-call by the tests below.
vi.mock("@common", () => ({
  commonUtil: { getMaargURL: () => "", getOmsURL: () => "" },
  cookieHelper: () => ({ get: () => "" }),
}));
import {
  applyDraftProposal,
  convertBrokeringRouteDraftToOperations,
  createDraftOutputContract,
  createDraftProposal,
  formatDraftProposalSections,
  requestBrokeringRouteDraftOperations,
  summarizeDraftOperations,
  validateDraftOperations
} from "../src/services/DraftAssistantService";
import type {
  BrokeringRouteDraft,
  DraftConversationMessage,
  DraftOperation,
  DraftProposal,
  PageCapabilityManifest
} from "../src/types/draft";

it("draft assistant service validation", async () => {

const manifest: PageCapabilityManifest = {
  pageId: "test.page",
  route: "/test",
  visibleEntities: {},
  editableTargets: [
    {
      target: "selected.statusId",
      label: "Selected status",
      valueType: "enum",
      currentValue: "DRAFT",
      options: [
        { id: "ACTIVE", label: "Active", aliases: ["activate"] },
        { id: "DRAFT", label: "Draft" }
      ],
      editable: true
    },
    {
      target: "selected.disabledStatusId",
      label: "Disabled status",
      valueType: "enum",
      currentValue: "DRAFT",
      options: [{ id: "ACTIVE", label: "Active" }],
      editable: true,
      disabled: true,
      disabledReason: "This field is locked."
    },
    {
      target: "selected.ambiguousStatusId",
      label: "Ambiguous status",
      valueType: "enum",
      currentValue: "DRAFT",
      options: [
        { id: "FIRST", label: "First", aliases: ["same"] },
        { id: "SECOND", label: "Second", aliases: ["same"] }
      ],
      editable: true
    },
    {
      target: "selected.queueId",
      label: "Queue",
      valueType: "enum",
      currentValue: "BROKERING_QUEUE",
      options: [
        { id: "BROKERING_QUEUE", label: "Brokering Queue" },
        { id: "UNFILLABLE_PARKING", label: "Unfillable Parking", aliases: ["unfillable queue"] }
      ],
      editable: true
    }
  ],
  outputContract: createDraftOutputContract()
};

function validate(operations: DraftOperation[]) {
  return validateDraftOperations(operations, manifest);
}

{
  const result = validate([{ op: "set", target: "selected.statusId", value: "activate" }]);
  assert.equal(result.unansweredQuestions.length, 0);
  assert.deepEqual(result.operations, [{ op: "set", target: "selected.statusId", value: "ACTIVE" }]);
}

{
  const result = validate([{ op: "set", target: "selected.statusId", value: "ARCHIVED" }]);
  assert.equal(result.operations.length, 0);
  assert.equal(result.unansweredQuestions.length, 1);
  assert.ok(result.unansweredQuestions[0].includes("Active (ACTIVE)"));
  assert.ok(result.unansweredQuestions[0].includes("Draft (DRAFT)"));
}

{
  const result = validate([{ op: "set", target: "selected.disabledStatusId", value: "ACTIVE" }]);
  assert.equal(result.operations.length, 0);
  assert.equal(result.unansweredQuestions.length, 1);
}

{
  const result = validate([{ op: "set", target: "selected.unknown", value: "ACTIVE" }]);
  assert.equal(result.operations.length, 0);
  assert.equal(result.unansweredQuestions.length, 1);
}

{
  const result = validate([{ op: "set", target: "selected.ambiguousStatusId", value: "same" }]);
  assert.equal(result.operations.length, 0);
  assert.equal(result.unansweredQuestions.length, 1);
  assert.ok(result.unansweredQuestions[0].includes("First (FIRST)"));
  assert.ok(result.unansweredQuestions[0].includes("Second (SECOND)"));
}

{
  const result = validateDraftOperations([{ op: "append", target: "selected.statusId", value: "ACTIVE" } as any], manifest);
  assert.equal(result.operations.length, 0);
  assert.equal(result.unansweredQuestions.length, 1);
}

{
  const result = summarizeDraftOperations([{ op: "set", target: "selected.queueId", value: "unfillable queue" }], manifest);
  assert.equal(result, "Queue: Unfillable Parking");
}

{
  const brokeringManifest: PageCapabilityManifest = {
    ...manifest,
    editableTargets: [
      {
        target: "route.orderFilters.SHIPPING_METHOD",
        label: "Shipping method filter",
        valueType: "string[]",
        currentValue: [],
        options: [{ id: "STANDARD", label: "Standard Shipping" }],
        multiple: true,
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.FACILITY_GROUP",
        label: "Inventory facility group filter",
        valueType: "enum",
        currentValue: "",
        options: [
          { id: "WAREHOUSE", label: "All Warehouses" },
          { id: "STORES", label: "All Stores" }
        ],
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK",
        label: "Brokering safety stock filter",
        valueType: "number",
        currentValue: undefined,
        editable: true
      },
      {
        target: "selectedRule.inventorySorts.PROXIMITY",
        label: "Inventory proximity sort",
        valueType: "boolean",
        currentValue: false,
        editable: true
      }
    ]
  };
  const result = formatDraftProposalSections([
    { op: "set", target: "route.orderFilters.SHIPPING_METHOD", value: ["STANDARD"] },
    { op: "set", target: "selectedRule.inventoryFilters.FACILITY_GROUP", value: "WAREHOUSE", ruleKey: "new:warehouse-first", ruleName: "Rule 1: Warehouse first" },
    { op: "set", target: "selectedRule.inventoryFilters.FACILITY_GROUP", value: "STORES", ruleKey: "new:stores-threshold", ruleName: "Rule 2: Store threshold" },
    { op: "set", target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", value: 3, ruleKey: "new:stores-threshold", ruleName: "Rule 2: Store threshold" },
    { op: "set", target: "selectedRule.inventorySorts.PROXIMITY", value: true, ruleKey: "new:stores-threshold", ruleName: "Rule 2: Store threshold" }
  ], brokeringManifest);

  assert.equal(result, [
    "Order filters",
    "- Shipping method filter: Standard Shipping",
    "",
    "Inventory rule: Rule 1: Warehouse first",
    "- Inventory facility group filter: All Warehouses",
    "",
    "Inventory rule: Rule 2: Store threshold",
    "- Inventory facility group filter: All Stores",
    "- Brokering safety stock filter: 3",
    "- Inventory proximity sort: true"
  ].join("\n"));
}

{
  const proposal = createDraftProposal({
    operations: [
      { op: "set", target: "selected.statusId", value: "activate" },
      { op: "set", target: "selected.unknown", value: "ACTIVE" }
    ],
    unansweredQuestions: [],
    summary: "Draft updated"
  }, manifest);

  assert.equal(proposal.operations.length, 1);
  assert.equal(proposal.operations[0].value, "ACTIVE");
  assert.equal(proposal.unansweredQuestions.length, 1);
  assert.equal(proposal.summary, "Selected status: Active");
}

{
  const brokeringManifest: PageCapabilityManifest = {
    ...manifest,
    editableTargets: [
      {
        target: "route.statusId",
        label: "Route status",
        valueType: "enum",
        currentValue: "ROUTING_DRAFT",
        options: [
          { id: "ROUTING_DRAFT", label: "Draft" },
          { id: "ROUTING_ACTIVE", label: "Active" }
        ],
        editable: true
      },
      {
        target: "route.orderFilters.SALES_CHANNEL",
        label: "Sales channel filter",
        valueType: "string[]",
        currentValue: [],
        options: [{ id: "WEB", label: "Web" }],
        multiple: true,
        editable: true
      },
      {
        target: "route.orderSorts.SHIP_BY",
        label: "Ship-by date sort",
        valueType: "boolean",
        currentValue: false,
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.FACILITY_GROUP",
        label: "Inventory facility group filter",
        valueType: "enum",
        currentValue: "",
        options: [{ id: "STORES", label: "Stores" }],
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED",
        label: "Excluded inventory facility group filter",
        valueType: "enum",
        currentValue: "",
        options: [{ id: "WAREHOUSES", label: "Warehouses" }],
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT",
        label: "Facility order limit check",
        valueType: "boolean",
        currentValue: true,
        options: [
          { id: "false", label: "Respect facility order limits" },
          { id: "true", label: "Bypass facility order limits" }
        ],
        editable: true
      },
      {
        target: "selectedRule.inventorySorts.PROXIMITY",
        label: "Inventory proximity sort",
        valueType: "boolean",
        currentValue: false,
        editable: true
      },
      {
        target: "selectedRule.unavailableItemsAction",
        label: "Unavailable items action",
        valueType: "enum",
        currentValue: "ORA_NEXT_RULE",
        options: [
          { id: "ORA_NEXT_RULE", label: "Next rule" },
          { id: "ORA_MV_TO_QUEUE", label: "Queue" }
        ],
        editable: true
      },
      {
        target: "selectedRule.unavailableItemsQueueId",
        label: "Unavailable items queue",
        valueType: "enum",
        currentValue: "",
        options: [{ id: "UNFILLABLE_PARKING", label: "Unfillable Parking" }],
        editable: true,
        dependencies: [{
          target: "selectedRule.unavailableItemsAction",
          values: ["ORA_MV_TO_QUEUE"],
          description: "Move unavailable items to a queue before selecting the queue."
        }]
      }
    ]
  };
  const result = convertBrokeringRouteDraftToOperations({
    schemaVersion: "brokering-route-draft.v1",
    applyMode: "merge",
    route: {
      statusId: "ROUTING_ACTIVE",
      orderSelection: {
        filters: {
          queues: { include: [], exclude: [] },
          shippingMethods: { include: [], exclude: [] },
          priorities: { include: [], exclude: [] },
          promiseDateDays: { max: null, excludeMax: null },
          salesChannels: { include: ["WEB"], exclude: [] },
          originFacilityGroups: { include: [], exclude: [] }
        },
        sorts: [{ field: "shipByDate", direction: "asc" }]
      },
      inventoryRules: [{
        ruleKey: "new:stores-first",
        name: "Stores first",
        statusId: "RULE_DRAFT",
        sequence: 10,
        inventorySelection: {
          filters: {
            facilityGroups: { include: ["STORES"], exclude: ["WAREHOUSES"] },
            proximity: { maxDistance: null, unit: null },
            safetyStock: { minimum: null },
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
      }]
    },
    questions: [],
    summary: "Drafted a stores-first route."
  }, brokeringManifest);

  assert.deepEqual(result.operations.map((operation) => [operation.target, operation.value]), [
    ["route.statusId", "ROUTING_ACTIVE"],
    ["route.orderFilters.SALES_CHANNEL", ["WEB"]],
    ["route.orderSorts.SHIP_BY", true],
    ["selectedRule.inventoryFilters.FACILITY_GROUP", "STORES"],
    ["selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED", "WAREHOUSES"],
    ["selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT", false],
    ["selectedRule.inventorySorts.PROXIMITY", true],
    ["selectedRule.unavailableItemsAction", "ORA_MV_TO_QUEUE"],
    ["selectedRule.unavailableItemsQueueId", "UNFILLABLE_PARKING"]
  ]);
}

{
  const brokeringManifest: PageCapabilityManifest = {
    ...manifest,
    editableTargets: [
      {
        target: "selectedRule.inventoryFilters.FACILITY_GROUP",
        label: "Inventory facility group filter",
        valueType: "enum",
        currentValue: "",
        options: [
          { id: "WAREHOUSE", label: "Warehouse" },
          { id: "STORES", label: "Stores" }
        ],
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK",
        label: "Brokering safety stock filter",
        valueType: "number",
        currentValue: undefined,
        editable: true
      },
      {
        target: "selectedRule.inventorySorts.PROXIMITY",
        label: "Inventory proximity sort",
        valueType: "boolean",
        currentValue: false,
        editable: true
      }
    ]
  };
  const result = convertBrokeringRouteDraftToOperations({
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
          ruleKey: "new:warehouse-first",
          name: "Warehouse first",
          statusId: "RULE_DRAFT",
          sequence: 10,
          inventorySelection: {
            filters: {
              facilityGroups: { include: ["WAREHOUSE"], exclude: [] },
              proximity: { maxDistance: null, unit: null },
              safetyStock: { minimum: null },
              facilityOrderLimit: "unchanged",
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
        },
        {
          ruleKey: "new:stores-fallback",
          name: "Stores fallback",
          statusId: "RULE_DRAFT",
          sequence: 20,
          inventorySelection: {
            filters: {
              facilityGroups: { include: ["STORES"], exclude: [] },
              proximity: { maxDistance: null, unit: null },
              safetyStock: { minimum: 3 },
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
        }
      ]
    },
    questions: [],
    summary: "Drafted warehouse and stores fallback rules."
  }, brokeringManifest);

  assert.deepEqual(result.operations.map((operation) => [operation.ruleKey, operation.ruleName, operation.target, operation.value]), [
    ["new:warehouse-first", "Warehouse first", "selectedRule.inventoryFilters.FACILITY_GROUP", "WAREHOUSE"],
    ["new:stores-fallback", "Stores fallback", "selectedRule.inventoryFilters.FACILITY_GROUP", "STORES"],
    ["new:stores-fallback", "Stores fallback", "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", 3],
    ["new:stores-fallback", "Stores fallback", "selectedRule.inventorySorts.PROXIMITY", true]
  ]);
}

{
  const brokeringManifest: PageCapabilityManifest = {
    ...manifest,
    editableTargets: [
      {
        target: "selectedRule.partialAllocation",
        label: "Partial allocation",
        valueType: "boolean",
        currentValue: false,
        editable: true
      },
      {
        target: "selectedRule.partialGroupItemsAllocation",
        label: "Grouped item partial allocation",
        valueType: "boolean",
        currentValue: false,
        editable: true,
        disabled: true,
        disabledReason: "Grouped item partial allocation requires partial allocation to be enabled.",
        dependencies: [{
          target: "selectedRule.partialAllocation",
          values: [true],
          description: "Enable partial allocation before changing grouped item partial allocation."
        }]
      }
    ]
  };
  const plan = convertBrokeringRouteDraftToOperations({
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
        ruleKey: "new:warehouse-first",
        name: "Warehouse first",
        statusId: "RULE_DRAFT",
        sequence: 10,
        inventorySelection: {
          filters: {
            facilityGroups: { include: [], exclude: [] },
            proximity: { maxDistance: null, unit: null },
            safetyStock: { minimum: 0 },
            facilityOrderLimit: "unchanged",
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
      }]
    },
    questions: [],
    summary: "Drafted warehouse first rule."
  }, brokeringManifest);
  const proposal = createDraftProposal(plan, brokeringManifest);

  assert.equal(plan.operations.some((operation) => operation.target === "selectedRule.partialGroupItemsAllocation"), false);
  assert.equal(proposal.unansweredQuestions.length, 0);
}

{
  const brokeringManifest: PageCapabilityManifest = {
    ...manifest,
    editableTargets: [
      {
        target: "route.orderFilters.QUEUE",
        label: "Queue filter",
        valueType: "string[]",
        currentValue: [],
        options: [{ id: "BROKERING_QUEUE", label: "Brokering Queue" }],
        multiple: true,
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.FACILITY_GROUP",
        label: "Inventory facility group filter",
        valueType: "enum",
        currentValue: "",
        options: [{ id: "WAREHOUSES", label: "All Warehouses" }],
        editable: true
      },
      {
        target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK",
        label: "Brokering safety stock filter",
        valueType: "number",
        currentValue: 5,
        editable: true
      }
    ]
  };
  const proposal = createDraftProposal({
    operations: [
      { op: "set", target: "selectedRule.inventoryFilters.FACILITY_GROUP", value: "WAREHOUSES" },
      { op: "set", target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", value: 0 }
    ],
    unansweredQuestions: [
      "Which inventory facility group(s) do you want to include for filtering inventory? For example, do you have a facility group named 'All Warehouses'?",
      "Which queue should unavailable items move to?"
    ],
    summary: "Drafted a warehouse-only rule."
  }, brokeringManifest);

  assert.deepEqual(proposal.unansweredQuestions, ["Which queue should unavailable items move to?"]);
}

{
  const history: DraftConversationMessage[] = [
    { role: "user", content: "If no warehouse can fulfill, send it to the exception queue." },
    { role: "assistant", content: "Which exception queue should be used?" },
    { role: "user", content: "UNFILLABLE_PARKING" }
  ];
  let requestBody: any = null;
  let requestUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(url);
    requestBody = JSON.parse(String(init?.body || "{}"));
    return {
      ok: true,
      json: async () => ({
        schemaVersion: "brokering-route-assistant.v1",
        intent: "edit",
        draft: {
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
            inventoryRules: []
          },
          questions: [],
          summary: "No draft changes applied"
        }
      })
    } as Response;
  }) as typeof fetch;

  await requestBrokeringRouteDraftOperations("UNFILLABLE_PARKING", manifest, { conversationHistory: history });
  globalThis.fetch = originalFetch;

  assert.ok(requestUrl.endsWith("/brokering-route-assistant"));
  assert.deepEqual(requestBody.conversationHistory, history);
}

{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      json: async () => ({
        schemaVersion: "brokering-route-assistant.v1",
        intent: "inquiry",
        message: "This routing brokers warehouse inventory first, then uses the store fallback rule.",
        questions: [],
        summary: "Explained current routing."
      })
    } as Response;
  }) as typeof fetch;

  const result = await requestBrokeringRouteDraftOperations("Explain the open routing.", manifest);
  globalThis.fetch = originalFetch;

  assert.equal(result.intent, "inquiry");
  assert.equal(result.operations.length, 0);
  assert.equal(result.summary, "This routing brokers warehouse inventory first, then uses the store fallback rule.");
}

{
  const inquiryManifest: PageCapabilityManifest = {
    ...manifest,
    visibleEntities: {
      brokeringRun: {
        routingGroupId: "100051",
        groupName: "Overnight Priority Orders",
        productStoreId: "STORE",
        schedule: {
          cronExpression: "0 */30 * ? * *",
          timeZone: "America/Chicago",
          paused: "Y"
        }
      },
      route: {
        orderRoutingId: "route-1",
        routingName: "Priority orders",
        statusId: "ROUTING_ACTIVE",
        currentOrderFilters: [
          {
            target: "route.orderFilters.QUEUE",
            label: "Queue filter",
            value: ["UNFILLABLE_PARKING", "BROKERING_QUEUE"],
            valueLabel: "Unfillable Parking, Brokering Queue"
          },
          {
            target: "route.orderFilters.SHIPPING_METHOD",
            label: "Shipping method filter",
            value: ["FEDEX_2_DAY", "NEXT_DAY"],
            valueLabel: "2 Day FedEx Shipping, Next Day"
          }
        ],
        currentOrderSorts: [],
        availableInventoryRules: []
      }
    }
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      json: async () => ({
        schemaVersion: "brokering-route-assistant.v1",
        intent: "inquiry",
        message: "The current brokering run is named Overnight Priority Orders. It is scheduled to execute every 30 minutes according to the configured cron expression but is currently paused (paused = Y). This run targets orders in the queues Unfillable Parking and Brokering Queue and filters for shipping methods 2 Day FedEx Shipping and Next Day. The route is active.",
        questions: [
          "What is the status of the brokering run?",
          "Which order queues are included in this run?",
          "What shipping methods does this run filter by?",
          "Would you like details on specific order filters or sorting criteria applied in this run?",
          "Which inventory rule should I inspect?"
        ],
        summary: "Explained current routing."
      })
    } as Response;
  }) as typeof fetch;

  const plan = await requestBrokeringRouteDraftOperations("help me understand this run", inquiryManifest);
  const proposal = createDraftProposal(plan, inquiryManifest);
  globalThis.fetch = originalFetch;

  assert.deepEqual(proposal.unansweredQuestions, ["Which inventory rule should I inspect?"]);
}

// Regression: "allow partial allocation for B bucket" — the agent returns the
// full B Bucket rule with current values for every field plus partialAllocation
// flipped to true. convertBrokeringRouteDraftToOperations must produce exactly
// one operation (the actual change), not eight.
{
  const ruleId = "RULE_B_BUCKET";
  const bBucketRuleManifest: PageCapabilityManifest = {
    pageId: "order-routing.rules",
    route: "/tabs/circuit",
    visibleEntities: {
      route: {
        availableInventoryRules: [{
          routingRuleId: ruleId,
          ruleName: "B Bucket",
          statusId: "RULE_ACTIVE",
          sequenceNum: 20,
          currentValues: {
            assignmentEnumId: "ORA_SINGLE",
            partialAllocation: false,
            partialGroupedItemAllocation: false,
            inventoryFilters: [
              { target: "selectedRule.inventoryFilters.FACILITY_GROUP", label: "Facility group", value: ["B_BUCKET"] },
              { target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", label: "Safety stock", value: 2 }
            ],
            inventorySorts: [
              { target: "selectedRule.inventorySorts.PROXIMITY", label: "Proximity" },
              { target: "selectedRule.inventorySorts.INV_BALANCE", label: "Inventory balance" }
            ],
            unavailableItems: {
              actionTypeEnumId: "ORA_MV_TO_QUEUE",
              queueId: "UNFILLABLE_PARKING",
              clearAutoCancelDays: false,
              autoCancelDays: null
            }
          }
        }]
      }
    },
    editableTargets: [
      { target: "selectedRule.statusId", label: "Status", valueType: "enum", currentValue: "RULE_ACTIVE", options: [{ id: "RULE_DRAFT" }, { id: "RULE_ACTIVE" }, { id: "RULE_ARCHIVED" }], editable: true } as any,
      { target: "selectedRule.inventoryFilters.FACILITY_GROUP", label: "Facility group", valueType: "string[]", currentValue: ["B_BUCKET"], multiple: true, options: [{ id: "B_BUCKET" }], editable: true } as any,
      { target: "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", label: "Safety stock", valueType: "number", currentValue: 2, editable: true } as any,
      { target: "selectedRule.inventorySorts.PROXIMITY", label: "Proximity sort", valueType: "boolean", currentValue: true, editable: true } as any,
      { target: "selectedRule.inventorySorts.INV_BALANCE", label: "Inventory balance sort", valueType: "boolean", currentValue: true, editable: true } as any,
      { target: "selectedRule.partialAllocation", label: "Partial allocation", valueType: "boolean", currentValue: false, editable: true } as any,
      { target: "selectedRule.partialGroupItemsAllocation", label: "Grouped partial allocation", valueType: "boolean", currentValue: false, editable: true } as any,
      { target: "selectedRule.unavailableItemsAction", label: "Unavailable items action", valueType: "enum", currentValue: "ORA_MV_TO_QUEUE", options: [{ id: "ORA_NEXT_RULE" }, { id: "ORA_MV_TO_QUEUE" }], editable: true } as any,
      { target: "selectedRule.unavailableItemsQueueId", label: "Unavailable items queue", valueType: "enum", currentValue: "UNFILLABLE_PARKING", options: [{ id: "UNFILLABLE_PARKING" }], editable: true } as any
    ],
    outputContract: createDraftOutputContract()
  };

  const result = convertBrokeringRouteDraftToOperations({
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
        ruleKey: ruleId,
        name: "B Bucket",
        statusId: "RULE_ACTIVE",
        sequence: 20,
        inventorySelection: {
          filters: {
            facilityGroups: { include: ["B_BUCKET"], exclude: [] },
            proximity: { maxDistance: null, unit: null },
            safetyStock: { minimum: 2 },
            facilityOrderLimit: "unchanged",
            shipmentThreshold: null
          },
          sorts: [
            { field: "proximity", direction: "asc" },
            { field: "inventoryBalance", direction: "asc" }
          ]
        },
        allocation: {
          partialOrderAllocation: true,
          partialGroupedItemAllocation: false
        },
        unavailableItems: {
          action: "moveToQueue",
          queueId: "UNFILLABLE_PARKING",
          autoCancel: { mode: "none", days: null }
        }
      }]
    },
    questions: [],
    summary: "Enable partial allocation on B Bucket."
  }, bBucketRuleManifest);

  assert.deepEqual(
    result.operations.map((operation) => [operation.target, operation.value]),
    [["selectedRule.partialAllocation", true]],
    "only the actual change (partial allocation) should reach the operation list"
  );
  assert.equal(result.operations[0].ruleKey, ruleId,
    "the partial allocation op must be scoped to the B Bucket rule by ruleKey");
}

// --- targetRouting passthrough ---
{
  const minimalManifest: any = {
    pageId: "order-routing.rules",
    route: "/tabs/circuit",
    visibleEntities: {
      brokeringRun: { availableSiblingRoutings: [] },
      route: { draftLimitations: { canCreateSiblingRoutings: true } }
    },
    editableTargets: [],
    outputContract: {}
  };

  const draft: BrokeringRouteDraft = {
    schemaVersion: "brokering-route-draft.v1",
    applyMode: "merge",
    targetRouting: { action: "create", routingKey: "new:foo", name: "Foo" },
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
      inventoryRules: []
    },
    questions: [],
    summary: "Create Foo"
  };

  const set = convertBrokeringRouteDraftToOperations(draft, minimalManifest);
  assert.deepStrictEqual(set.targetRouting, { action: "create", routingKey: "new:foo", name: "Foo" });
}

// --- createDraftProposal surfaces newRouting when targetRouting.action=create ---
{
  const minimalManifest: any = {
    pageId: "order-routing.rules",
    route: "/tabs/circuit",
    visibleEntities: {
      brokeringRun: { availableSiblingRoutings: [] },
      route: { draftLimitations: { canCreateSiblingRoutings: true } }
    },
    editableTargets: [],
    outputContract: {}
  };

  const proposal = createDraftProposal({
    operations: [],
    unansweredQuestions: [],
    summary: "Create West Coast",
    intent: "edit",
    targetRouting: { action: "create", routingKey: "new:west-coast", name: "West Coast" }
  }, minimalManifest);

  assert.deepStrictEqual(proposal.newRouting, { routingKey: "new:west-coast", name: "West Coast" });
}

{
  // Edit path: no newRouting on the proposal
  const minimalManifest: any = {
    pageId: "order-routing.rules",
    route: "/tabs/circuit",
    visibleEntities: { brokeringRun: { availableSiblingRoutings: [] }, route: { draftLimitations: { canCreateSiblingRoutings: true } } },
    editableTargets: [],
    outputContract: {}
  };
  const proposal = createDraftProposal({
    operations: [],
    unansweredQuestions: [],
    summary: "Edited",
    intent: "edit"
  }, minimalManifest);
  assert.equal(proposal.newRouting, undefined);
}

{
  // formatDraftProposalSections prepends a "Create new routing" section when newRouting is set
  const minimalManifest: any = {
    pageId: "order-routing.rules",
    route: "/tabs/circuit",
    visibleEntities: {},
    editableTargets: [],
    outputContract: {}
  };
  const rendered = formatDraftProposalSections([], minimalManifest, { routingKey: "new:west-coast", name: "West Coast" });
  assert.match(rendered, /Create new routing/);
  assert.match(rendered, /West Coast/);
}

// --- applyDraftProposal wrapper ---
{
  // With newRouting: createSiblingRouting → selectRouting → buildBindings, in that order
  const callOrder: string[] = [];
  const ctx = {
    createSiblingRouting: async (name: string) => {
      callOrder.push(`create:${name}`);
      return "NEW_ID";
    },
    selectRouting: (id: string) => {
      callOrder.push(`select:${id}`);
    },
    buildBindings: () => {
      callOrder.push("buildBindings");
      return {};
    }
  };
  const proposal: DraftProposal = {
    operations: [],
    unansweredQuestions: [],
    summary: "",
    providerSummary: "",
    newRouting: { routingKey: "new:x", name: "X" }
  };
  const minimalManifest: any = { pageId: "x", route: "/x", visibleEntities: {}, editableTargets: [], outputContract: {} };
  await applyDraftProposal(proposal, minimalManifest, ctx);
  assert.deepStrictEqual(callOrder, ["create:X", "select:NEW_ID", "buildBindings"]);
}

{
  // Without newRouting: create/select are skipped entirely
  const callOrder: string[] = [];
  const ctx = {
    createSiblingRouting: async () => { callOrder.push("create"); return ""; },
    selectRouting: () => { callOrder.push("select"); },
    buildBindings: () => { callOrder.push("buildBindings"); return {}; }
  };
  const proposal: DraftProposal = {
    operations: [],
    unansweredQuestions: [],
    summary: "",
    providerSummary: ""
  };
  const minimalManifest: any = { pageId: "x", route: "/x", visibleEntities: {}, editableTargets: [], outputContract: {} };
  await applyDraftProposal(proposal, minimalManifest, ctx);
  assert.deepStrictEqual(callOrder, ["buildBindings"]);
}

{
  // createSiblingRouting returning "" short-circuits; bindings are never built
  const callOrder: string[] = [];
  const ctx = {
    createSiblingRouting: async () => { callOrder.push("create"); return ""; },
    selectRouting: () => { callOrder.push("select"); },
    buildBindings: () => { callOrder.push("buildBindings"); return {}; }
  };
  const proposal: DraftProposal = {
    operations: [],
    unansweredQuestions: [],
    summary: "",
    providerSummary: "",
    newRouting: { routingKey: "new:x", name: "X" }
  };
  const minimalManifest: any = { pageId: "x", route: "/x", visibleEntities: {}, editableTargets: [], outputContract: {} };
  const result = await applyDraftProposal(proposal, minimalManifest, ctx);
  assert.deepStrictEqual(callOrder, ["create"], "select and buildBindings must NOT run when create fails");
  assert.equal(result.appliedCount, 0);
}

console.log("Draft assistant service validation tests passed");

});
