import { api, commonUtil } from "@common";

const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_DURATION_MS = 90 * 60_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export interface PersistedSimulation {
  simulation: {
    simulationId: string;
    statusId: string;
    routingGroupId?: string;
    productStoreId?: string;
    runType?: string;
    attemptedItemCount?: number;
    brokeredItemCount?: number;
    queuedItemCount?: number;
  };
  variants: Array<{
    variantSeqId: number;
    label?: string;
    isBaseline?: string;
    failed?: string;
    failureReason?: string;
    attemptedItemCount?: number;
    brokeredItemCount?: number;
    queuedItemCount?: number;
  }>;
}

export interface SimulationItem {
  ruleResultSeqId: number;
  itemSeqId: number;
  orderId?: string;
  orderItemSeqId?: string;
  productId?: string;
  facilityId?: string;
  finalReason?: string;
  routedQty?: number;
  itemQty?: number;
}

export interface SimulationRuleResult {
  ruleResultSeqId: number;
  orderRoutingId?: string;
  sequenceNum?: number;
  eligibleEntryCount?: number;
  attemptedItemCount?: number;
  brokeredItemCount?: number;
  queuedItemCount?: number;
}

const aborted = () => new DOMException("Simulation request was cancelled.", "AbortError");

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(aborted());
    const onAbort = () => { clearTimeout(timer); reject(aborted()); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isTransient(error: any): boolean {
  const status = Number(error?.response?.status);
  return !Number.isFinite(status) || status === 408 || status === 429 || status >= 500;
}

/** These routes are explicit Main OMS services; the browser never authenticates to Sim Routing. */
export async function fetchRoutingGroupDetail(routingGroupId: string, signal?: AbortSignal): Promise<any> {
  const response: any = await api({
    url: `order-routing/simulation/groups/${encodeURIComponent(routingGroupId)}`,
    method: "GET",
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(response) || !response.data?.group?.routingGroupId) {
    throw new Error(`Routing group ${routingGroupId} could not be loaded from Sim Routing.`);
  }
  return response.data.group;
}

export async function submitSimulation(routingGroupIds: string[]): Promise<{ simulationId: string; statusId: string; jobRunId?: string }> {
  if (!routingGroupIds.length || routingGroupIds.some((id) => !id)) throw new Error("Select a routing group to simulate.");
  const response: any = await api({
    url: "order-routing/simulation/simulations", method: "POST", data: { routingGroupIds },
  });
  if (commonUtil.hasError(response) || !response.data?.simulationId) {
    throw new Error("Sim Routing did not accept the simulation run.");
  }
  return response.data;
}

export async function getSimulation(simulationId: string): Promise<PersistedSimulation> {
  const response: any = await api({
    url: `order-routing/simulation/simulations/${encodeURIComponent(simulationId)}`, method: "GET",
  });
  if (commonUtil.hasError(response) || !response.data?.simulation?.simulationId) {
    throw new Error(`Simulation ${simulationId} could not be loaded.`);
  }
  return response.data;
}

export async function listSimulations(filters: {
  productStoreId?: string;
  routingGroupId?: string;
  statusId?: string;
  pageIndex?: number;
  pageSize?: number;
} = {}): Promise<{ simulationList: PersistedSimulation["simulation"][]; totalCount: number }> {
  const response: any = await api({
    url: "order-routing/simulation/simulations", method: "GET",
    params: { ...filters, pageIndex: filters.pageIndex ?? 0, pageSize: filters.pageSize ?? 25 },
  });
  if (commonUtil.hasError(response) || !Array.isArray(response.data?.simulationList)) {
    throw new Error("Sim Routing did not return a simulation list.");
  }
  return response.data;
}

export async function listSimulationItems(
  simulationId: string,
  variantSeqId: number,
  pageIndex = 0,
  pageSize = 25,
): Promise<{ itemList: SimulationItem[]; totalCount: number }> {
  if (!simulationId || !Number.isInteger(variantSeqId) || variantSeqId < 1 || pageIndex < 0 || pageSize < 1 || pageSize > 100) {
    throw new Error("Select a valid simulation variant and page to inspect.");
  }
  const response: any = await api({
    url: `order-routing/simulation/simulations/${encodeURIComponent(simulationId)}/variants/${variantSeqId}/items`,
    method: "GET", params: { pageIndex, pageSize },
  });
  if (commonUtil.hasError(response) || !Array.isArray(response.data?.itemList)) {
    throw new Error("Sim Routing did not return simulation item outcomes.");
  }
  return response.data;
}

export async function listSimulationRuleResults(
  simulationId: string,
  variantSeqId: number,
  pageIndex = 0,
  pageSize = 25,
): Promise<{ ruleResultList: SimulationRuleResult[]; totalCount: number }> {
  if (!simulationId || !Number.isInteger(variantSeqId) || variantSeqId < 1 || pageIndex < 0 || pageSize < 1 || pageSize > 100) {
    throw new Error("Select a valid simulation variant and page to inspect.");
  }
  const response: any = await api({
    url: `order-routing/simulation/simulations/${encodeURIComponent(simulationId)}/variants/${variantSeqId}/rules`,
    method: "GET", params: { pageIndex, pageSize },
  });
  if (commonUtil.hasError(response) || !Array.isArray(response.data?.ruleResultList)) {
    throw new Error("Sim Routing did not return simulation routing outcomes.");
  }
  return response.data;
}

export async function waitForSimulation(
  simulationId: string,
  onUpdate?: (run: PersistedSimulation) => void,
  signal?: AbortSignal,
): Promise<PersistedSimulation> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  let consecutiveErrors = 0;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw aborted();
    let run: PersistedSimulation;
    try {
      run = await getSimulation(simulationId);
      consecutiveErrors = 0;
    } catch (error: any) {
      if (signal?.aborted) throw aborted();
      if (!isTransient(error)) throw error;
      if (++consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        throw new Error("Simulation status could not be refreshed. Open the saved run to check its status.");
      }
      await sleep(POLL_INTERVAL_MS, signal);
      continue;
    }
    onUpdate?.(run);
    if (run.simulation.statusId === "BRSIM_COMPLETE") return run;
    if (run.simulation.statusId === "BRSIM_FAILED") {
      const failed = run.variants?.find((variant) => variant.failed === "Y");
      throw new Error(failed?.failureReason || "Simulation failed. Open the saved run for details.");
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
  throw new Error("Simulation is taking longer than expected. Open the saved run to check its status.");
}

export const SimulationService = {
  fetchRoutingGroupDetail,
  submitSimulation,
  getSimulation,
  listSimulations,
  listSimulationItems,
  listSimulationRuleResults,
  waitForSimulation,
};
