import { translate } from "@common";
import { computed } from "vue";
import { useRoutingDiagnosticsStore } from "@/store/routingDiagnosticsStore";
import { SHIPPING_REASON, UNATTRIBUTED_REASON, totalHolds } from "@/utils/routingDiagnostics";

const RULE_TONES = ["primary", "secondary", "tertiary", "success", "dark"];

// Store safety-stock figures shared by the dashboard and the Safety stock page, all read from
// the routing diagnostics store so both pages show the same numbers.
export function useSafetyStockSummary() {
  const diagnostics = useRoutingDiagnosticsStore();

  const storeHolds = computed(() => diagnostics.holds.filter((hold) => hold.facilityTypeId === "RETAIL_STORE"));
  const storeHoldTotals = computed(() => totalHolds(storeHolds.value));

  // One entry per reason: key is the rule id or one of the two reason constants.
  const reasonLegend = computed(() => {
    const { reasons, labels, totals } = diagnostics.safetyByReason;
    let ruleIndex = 0;

    return reasons.map((reason) => {
      if(reason === UNATTRIBUTED_REASON) {
        return { key: reason, label: translate("Unattributed safety stock"), tone: "medium", total: totals[reason] || 0, ruleId: "", description: translate("Minimum stock no current rule explains") };
      }
      if(reason === SHIPPING_REASON) {
        return { key: reason, label: translate("Shipping beyond safety stock"), tone: "danger", total: totals[reason] || 0, ruleId: "", description: translate("Extra units at locations not allowed to ship the product") };
      }

      return { key: reason, label: labels[reason] || reason, tone: RULE_TONES[ruleIndex++ % RULE_TONES.length], total: totals[reason] || 0, ruleId: reason, description: "" };
    });
  });

  return { storeHolds, storeHoldTotals, reasonLegend };
}
