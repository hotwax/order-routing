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
export function buildBrokeringAgentSnapshot(): BrokeringAgentSnapshot {
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
