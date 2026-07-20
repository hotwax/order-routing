import { describe, expect, it } from "vitest";
import {
  DEMO_CPCM_FILTER_ENUM,
  DEMO_CPCM_SORT_ENUM,
  DEMO_CPCM_ZONE_OPTIONS,
  demoCarrierPostalCodeMappingDefaults,
  withDemoCarrierPostalCodeMappingEnums
} from "../src/utils/demoCarrierPostalCodeMapping";

describe("demo carrier postal code mapping", () => {
  it("injects one hard-coded filter and sort without dropping live enums", () => {
    const result = withDemoCarrierPostalCodeMappingEnums({
      INV_FILTER_PRM_TYPE: { EXISTING_FILTER: { enumId: "EXISTING_FILTER" } },
      INV_SORT_PARAM_TYPE: { EXISTING_SORT: { enumId: "EXISTING_SORT" } }
    });

    expect(result.INV_FILTER_PRM_TYPE.EXISTING_FILTER).toBeTruthy();
    expect(result.INV_SORT_PARAM_TYPE.EXISTING_SORT).toBeTruthy();
    expect(result.INV_FILTER_PRM_TYPE.IIP_CPCM).toEqual(DEMO_CPCM_FILTER_ENUM);
    expect(result.INV_SORT_PARAM_TYPE.ISP_CPCM).toEqual(DEMO_CPCM_SORT_ENUM);
  });

  it("limits the demo to zones 1 through 4 and creates a valid default filter", () => {
    expect(DEMO_CPCM_ZONE_OPTIONS).toEqual([1, 2, 3, 4]);
    expect(demoCarrierPostalCodeMappingDefaults("IIP_CPCM")).toEqual({
      fieldValue: 4,
      operator: "less-equals"
    });
    expect(demoCarrierPostalCodeMappingDefaults("ISP_CPCM")).toEqual({});
  });
});
