// src/mock/pastSimulationsMock.ts
// Dev-only fixtures for the Past Simulations viewer, used when VITE_SIM_USE_MOCK="true"
// until backend R1/R2 ship. Never imported on production paths (dynamic import gated by useMock()).
import type { PastSimulationsFilters } from "../types/simulation";

// createdDate is epoch millis (Long), matching the real contract.
const HEADERS = [
  { simulationId: "SIM_1001", routingGroupId: "GRP_NYC", productStoreId: "STORE", runType: "VARIATION", statusId: "COMPLETE",
    attemptedItemCount: 100, brokeredItemCount: 90, queuedItemCount: 10, durationMs: 184000, sampleSize: 100, sampleCap: 500,
    simulationRan: "Y", partial: "N", createdDate: 1780999300000, createdByUser: "aditi.patel" },
  { simulationId: "SIM_1000", routingGroupId: "GRP_NYC", productStoreId: "STORE", runType: "SINGLE", statusId: "COMPLETE",
    attemptedItemCount: 80, brokeredItemCount: 64, queuedItemCount: 16, durationMs: 90000, sampleSize: 80, sampleCap: 500,
    simulationRan: "Y", partial: "N", createdDate: 1780930800000, createdByUser: "aditi.patel" },
];

export async function mockPastSimulations(f: PastSimulationsFilters): Promise<{ headers: any[]; total: number }> {
  let rows = [...HEADERS];   // dev mock ignores productStoreId so fixtures show under any current store
  if (f.routingGroupId) rows = rows.filter((h) => h.routingGroupId === f.routingGroupId);
  if (f.statusId) rows = rows.filter((h) => h.statusId === f.statusId);
  if (f.runType) rows = rows.filter((h) => h.runType === f.runType);
  return { headers: rows, total: rows.length };   // service-level shape to the store
}

// Real R2 shape: { simulation: {header}, variants: [...] } with parsed `diff`.
export async function mockPastSimulation(simulationId: string): Promise<any> {
  const header = HEADERS.find((h) => h.simulationId === simulationId) ?? HEADERS[0];
  return {
    simulation: header,
    variants: [
      { variantSeqId: 0, label: "baseline", isBaseline: "Y", failed: "N",
        attemptedItemCount: header.attemptedItemCount, brokeredItemCount: header.brokeredItemCount, queuedItemCount: header.queuedItemCount,
        parameterOverrides: {}, routingDeltas: [] },
      ...(header.runType === "VARIATION" ? [{
        variantSeqId: 1, label: "Tighter distance", isBaseline: "N", failed: "N",
        attemptedItemCount: 100, brokeredItemCount: 95, queuedItemCount: 5,
        diff: { routingBrokeredDelta: 5, finalReasonTransitions: {}, facilityAllocationDelta: {} },
        parameterOverrides: {}, routingDeltas: [],
      }] : []),
    ],
  };
}
