import { describe, expect, it } from "vitest";
import { classifyMovement } from "../src/utils/inventoryMovement";

// Real return movement for product 142834 at facility 100013: return 106068 came back from
// order 123877, whose order name is #996835.
const returnRow = { returnId: "106068", returnItemSeqId: "01", reasonEnumId: "RTN_ITM_RCPT", quantityOnHandDiff: 1 };

describe("classifyMovement return reference", () => {
  it("leads with the order the return came back from once resolved", () => {
    const m = classifyMovement(returnRow, { returnSummaries: { "106068": { orderName: "#996835" } } });

    expect(m.typeKey).toBe("RETURN");
    expect(m.referenceLabel).toBe("#996835");
  });

  it("falls back to the return id when the order is not resolved", () => {
    // sob/returns is not deployed everywhere, and the batch resolver is capped — either way the row
    // must stay identifiable rather than rendering a dash.
    expect(classifyMovement(returnRow, {}).referenceLabel).toBe("106068");
    expect(classifyMovement(returnRow, { returnSummaries: {} }).referenceLabel).toBe("106068");
    expect(classifyMovement(returnRow, { returnSummaries: { "106068": {} } }).referenceLabel).toBe("106068");
  });

  it("keeps the return findable by its own id as well as the order name", () => {
    const m = classifyMovement(returnRow, { returnSummaries: { "106068": { orderName: "#996835" } } });

    expect(m.searchText).toContain("106068");
    expect(m.searchText).toContain("#996835");
  });

  it("does not borrow a summary belonging to a different return", () => {
    const m = classifyMovement(returnRow, { returnSummaries: { "999999": { orderName: "#000000" } } });

    expect(m.referenceLabel).toBe("106068");
  });

  it("leaves non-return movements untouched", () => {
    const sales = classifyMovement({ orderId: "123877" }, {
      orderSummaries: { "123877": { orderId: "123877", orderName: "#996835", orderTypeId: "SALES_ORDER" } },
      returnSummaries: { "106068": { orderName: "#XXXXXX" } }
    });

    expect(sales.typeKey).toBe("SALES_ORDER");
    expect(sales.referenceLabel).toBe("#996835");
  });
});
