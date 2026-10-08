import { describe, expect, it } from "vitest";
import {
  diffRoutingGroupChildDeletions,
  hasRoutingGroupChildDeletions
} from "../src/utils/routingGroupEditorPayload";

// The whole-group POST upserts but never removes rows that are simply absent from the payload, so
// these specs pin the diff that turns "the user deleted this in the editor" into an explicit DELETE.

function baselineGroup() {
  return {
    routingGroupId: "G1",
    routings: [{
      orderRoutingId: "R1",
      orderFilters: [
        { conditionSeqId: "00001", fieldName: "queue" },
        { conditionSeqId: "00002", fieldName: "orderDate" }
      ],
      rules: [{
        routingRuleId: "RR1",
        inventoryFilters: [
          { conditionSeqId: "00010", fieldName: "facilityGroupId" },
          { conditionSeqId: "00011", fieldName: "distance" }
        ],
        actions: [
          { actionSeqId: "00020", actionTypeEnumId: "ORA_NEXT_RULE" },
          { actionSeqId: "00021", actionTypeEnumId: "ORA_MV_TO_QUEUE" }
        ]
      }]
    }]
  };
}

/** Deep clone so a test mutating the outgoing copy cannot disturb the baseline. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("routing group child deletions diff", () => {
  it("reports nothing when the outgoing group still contains every persisted child", () => {
    const deletions = diffRoutingGroupChildDeletions(baselineGroup(), clone(baselineGroup()));
    expect(hasRoutingGroupChildDeletions(deletions)).toBe(false);
  });

  it("reports a removed route filter, rule condition, and action", () => {
    const outgoing = clone(baselineGroup());
    const routing = outgoing.routings[0];
    routing.orderFilters = routing.orderFilters.filter((f: any) => f.conditionSeqId !== "00002");
    routing.rules[0].inventoryFilters = routing.rules[0].inventoryFilters.filter((f: any) => f.conditionSeqId !== "00011");
    routing.rules[0].actions = routing.rules[0].actions.filter((a: any) => a.actionSeqId !== "00020");

    const deletions = diffRoutingGroupChildDeletions(baselineGroup(), outgoing);

    expect(deletions.orderFilters).toEqual([{ orderRoutingId: "R1", conditionSeqId: "00002" }]);
    expect(deletions.inventoryFilters).toEqual([{ routingRuleId: "RR1", conditionSeqId: "00011" }]);
    expect(deletions.actions).toEqual([{ routingRuleId: "RR1", actionSeqId: "00020" }]);
  });

  it("reports every child when a rule is emptied of conditions and actions", () => {
    const outgoing = clone(baselineGroup());
    outgoing.routings[0].rules[0].inventoryFilters = [];
    outgoing.routings[0].rules[0].actions = [];

    const deletions = diffRoutingGroupChildDeletions(baselineGroup(), outgoing);

    expect(deletions.inventoryFilters.map((c) => c.conditionSeqId)).toEqual(["00010", "00011"]);
    expect(deletions.actions.map((a) => a.actionSeqId)).toEqual(["00020", "00021"]);
  });

  it("ignores children whose parent routing or rule was removed wholesale", () => {
    // Dropping a whole routing/rule is a different operation; the backend owns that cascade and
    // issuing child deletes here would only race it.
    const withoutRule = clone(baselineGroup());
    withoutRule.routings[0].rules = [];
    expect(hasRoutingGroupChildDeletions(diffRoutingGroupChildDeletions(baselineGroup(), withoutRule))).toBe(false);

    const withoutRouting = clone(baselineGroup());
    withoutRouting.routings = [];
    expect(hasRoutingGroupChildDeletions(diffRoutingGroupChildDeletions(baselineGroup(), withoutRouting))).toBe(false);
  });

  it("never reports deletions without a trustworthy same-group baseline", () => {
    const outgoing = clone(baselineGroup());
    outgoing.routings[0].orderFilters = [];

    // No baseline at all (a brand-new group), and a baseline captured for a different group.
    expect(hasRoutingGroupChildDeletions(diffRoutingGroupChildDeletions({}, outgoing))).toBe(false);
    expect(hasRoutingGroupChildDeletions(diffRoutingGroupChildDeletions(undefined, outgoing))).toBe(false);
    const otherGroup = { ...baselineGroup(), routingGroupId: "G2" };
    expect(hasRoutingGroupChildDeletions(diffRoutingGroupChildDeletions(otherGroup, outgoing))).toBe(false);
  });

  it("ignores local-only rows that were never persisted", () => {
    // A draft condition the user added and removed before ever saving has a client-generated uuid
    // (or no seq id at all) and must not produce a DELETE for a row the backend never created.
    const baseline = baselineGroup();
    baseline.routings[0].rules[0].inventoryFilters.push(
      { conditionSeqId: "f2b8c0de-1f4a-4c37-9b2e-7d1a5c6e8f90", fieldName: "draft" } as any,
      { fieldName: "noSeqId" } as any
    );

    const outgoing = clone(baselineGroup());

    const deletions = diffRoutingGroupChildDeletions(baseline, outgoing);
    expect(hasRoutingGroupChildDeletions(deletions)).toBe(false);
  });
});
