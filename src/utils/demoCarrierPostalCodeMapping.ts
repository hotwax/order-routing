// Demo-only routing criteria. These entries intentionally do not come from the OMS enum API;
// they exist only on the demo integration branch so the CPCM experience can be shown locally.
export const DEMO_CPCM_KEY = "CARRIER_POSTAL_CODE_MAPPING";
export const DEMO_CPCM_FIELD = "carrierPostalCodeMapping";

export const DEMO_CPCM_FILTER_ENUM = {
  enumId: "IIP_CPCM",
  enumTypeId: "INV_FILTER_PRM_TYPE",
  enumCode: DEMO_CPCM_FIELD,
  sequenceNum: 10,
  description: "Carrier postal code mapping"
};

export const DEMO_CPCM_SORT_ENUM = {
  enumId: "ISP_CPCM",
  enumTypeId: "INV_SORT_PARAM_TYPE",
  enumCode: DEMO_CPCM_FIELD,
  sequenceNum: 20,
  description: "Carrier postal code mapping"
};

export const DEMO_CPCM_ZONE_OPTIONS = [1, 2, 3, 4] as const;

export function withDemoCarrierPostalCodeMappingEnums(enums: Record<string, any> = {}) {
  return {
    ...enums,
    INV_FILTER_PRM_TYPE: {
      ...(enums.INV_FILTER_PRM_TYPE || {}),
      [DEMO_CPCM_FILTER_ENUM.enumId]: { ...DEMO_CPCM_FILTER_ENUM }
    },
    INV_SORT_PARAM_TYPE: {
      ...(enums.INV_SORT_PARAM_TYPE || {}),
      [DEMO_CPCM_SORT_ENUM.enumId]: { ...DEMO_CPCM_SORT_ENUM }
    }
  };
}

export function demoCarrierPostalCodeMappingDefaults(enumId: string) {
  return enumId === DEMO_CPCM_FILTER_ENUM.enumId
    ? { fieldValue: 4, operator: "less-equals" }
    : {};
}
