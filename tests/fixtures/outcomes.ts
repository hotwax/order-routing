import type { SimulationOutcomes } from "../../src/types/simulation";

/** A complete, all-families-available outcomes block. Override per test with `over`. */
export function makeOutcomes(over: Partial<SimulationOutcomes> = {}): SimulationOutcomes {
  return {
    available: { cost: true, sla: true, inventory: true, classification: false },
    fillRate: 0.94,
    unfillable: { itemCount: 30, orderCount: 12, rate: 0.06 },
    sla: {
      available: true,
      compliantItemCount: 420,
      measuredItemCount: 470,
      complianceRate: 0.89,
      avgPromisedDays: 4.2,
      avgEstimatedTransitDays: 3.6,
    },
    cost: {
      available: true,
      currency: "USD",
      totalShippingCost: 1840.5,
      avgCostPerItem: 3.91,
      expedited: { groundItems: 410, airItems: 60, groundCost: 1400.0, airCost: 440.5 },
    },
    inventory: {
      available: true,
      newSeasonStoresAtZero: 3,
      newSeasonStoresAtZeroList: [
        { facilityId: "STORE_42", facilityName: "Store 42", productIds: ["P1", "P2"] },
      ],
    },
    classification: { available: false, fulfillmentMix: null },
    ...over,
  };
}

/** Build a store-shaped results object. Baseline IS a groupRun (outcomes at .outcomes);
 *  each variant nests its groupRun (outcomes at .groupRun.outcomes). */
export function makeResults(
  baselineOutcomes: SimulationOutcomes | null,
  variantSpecs: Array<{ label: string; outcomes: SimulationOutcomes | null; failed?: boolean }>,
  extra: { partial?: boolean; simulationRan?: boolean } = {},
) {
  return {
    baseline: baselineOutcomes
      ? { brokeredItemCount: 470, queuedItemCount: 30, attemptedItemCount: 500, outcomes: baselineOutcomes }
      : { brokeredItemCount: 470, queuedItemCount: 30, attemptedItemCount: 500 },
    variants: variantSpecs.map((v) => ({
      label: v.label,
      failed: v.failed ?? false,
      diff: { finalReasonTransitions: {}, routingBrokeredDelta: {}, facilityAllocationDelta: {} },
      groupRun: v.outcomes
        ? { brokeredItemCount: 480, queuedItemCount: 20, attemptedItemCount: 500, outcomes: v.outcomes }
        : { brokeredItemCount: 480, queuedItemCount: 20, attemptedItemCount: 500 },
    })),
    partial: extra.partial ?? false,
    simulationRan: extra.simulationRan ?? true,
  };
}
