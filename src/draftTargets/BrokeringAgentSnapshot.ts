import { useUtilStore } from "@/store/utilStore";
import { productStore } from "@/store/productStore";

export type BrokeringAgentSnapshot = {
  facilities: Record<string, any>;
  shippingMethods: Record<string, any>;
  salesChannels: Record<string, any>;
  facilityGroups: Record<string, any>;
  brokeringFacilityGroups: Record<string, any>;
};

// Reads reference data from the store's data document and returns a plain snapshot.
// Lives in its own module so unit tests for BrokeringRulesDraftTargets can run under
// raw Node (the Pinia store imports here transitively pull in .vue files).
//
// `refData` overrides the shared-store reads for pages whose reference data comes from a different
// backend: the Simulate tab passes its simReferenceStore maps so the agent manifest offers the same
// option IDs as the selects beside it (the sim instance's), never the login OMS's.
export function buildBrokeringAgentSnapshot(refData?: {
  facilities: Record<string, any>;
  shippingMethods: Record<string, any>;
  salesChannels: Record<string, any>;
  facilityGroups: Record<string, any>;
}): BrokeringAgentSnapshot {
  if (refData) {
    return { ...refData, brokeringFacilityGroups: refData.facilityGroups };
  }
  const utilStore = useUtilStore();
  const product = productStore();
  return {
    facilities: product.getVirtualFacilities,
    shippingMethods: product.getShippingMethods,
    salesChannels: utilStore.getEnums["ORDER_SALES_CHANNEL"] || {},
    facilityGroups: product.getFacilityGroups,
    brokeringFacilityGroups: product.getFacilityGroups
  };
}
