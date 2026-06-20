import { describe, expect, it } from "vitest";
import { buildInventoryFacilitySearchParams, resolveInventoryFacilityId } from "../src/utils/inventoryFacility";

describe("inventory facility search params", () => {
  it("does not build search params until a facility is selected", () => {
    const params = buildInventoryFacilitySearchParams({
      pageSize: 50,
      pageIndex: 0,
      searchQuery: "",
      facilityId: ""
    });

    expect(params).toBeNull();
  });

  it("includes the selected facility and trimmed keyword when building search params", () => {
    const params = buildInventoryFacilitySearchParams({
      pageSize: 50,
      pageIndex: 2,
      searchQuery: "  hoodie  ",
      facilityId: "BROOKLYN"
    });

    expect(params).toEqual({
      pageSize: 50,
      pageIndex: 2,
      keyword: "hoodie",
      facilityId: "BROOKLYN"
    });
  });

  it("resolves the saved inventory facility before falling back to the first facility", () => {
    expect(resolveInventoryFacilityId("BROOKLYN", [{ facilityId: "DALLAS" }])).toBe("BROOKLYN");
    expect(resolveInventoryFacilityId("", [{ facilityId: "DALLAS" }])).toBe("DALLAS");
    expect(resolveInventoryFacilityId("", [])).toBe("");
  });
});
