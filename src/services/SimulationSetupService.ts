import { api, commonUtil } from "@common";

const root = "order-routing/simulation";
const id = (value: string) => encodeURIComponent(value);

export interface SimDatastore {
  simDatastoreId: string;
  datastoreName: string;
  displayName?: string;
  statusId: string;
  filledFrom?: string;
}

export interface SimFillProgress {
  fillId: string;
  statusId: string;
  jobRunId?: string;
  taskCounts?: Record<string, number>;
  rowsWritten?: number;
  batchesSent?: number;
  tasks?: SimFillTask[];
}

export interface SimFillTask {
  taskId: string;
  name: string;
  stepNum: number;
  statusId: string;
  rowsWritten?: number | null;
  jobRunId?: string | null;
  errorText?: string | null;
}

export interface SimRoutingGroup {
  routingGroupId: string;
  groupName?: string;
  productStoreId?: string;
}

export interface SimGroupValidity {
  verdict: string;
  validCount?: number;
  notInCopyCount?: number;
  sourceGapCount?: number;
  references?: Array<Record<string, unknown>>;
}

export interface SimRun {
  simulationId: string;
  statusId: string;
  jobRunId?: string;
  attemptedItemCount?: number;
  brokeredItemCount?: number;
  queuedItemCount?: number;
  durationMs?: number;
}

export interface SimRunVariant {
  variantSeqId: number;
  label?: string;
  isBaseline?: string;
  failed?: string;
  failureReason?: string;
  attemptedItemCount?: number;
  brokeredItemCount?: number;
  queuedItemCount?: number;
}

function responseData(response: any): any {
  if (commonUtil.hasError(response) || response?.data?.errors) {
    const data = response?.data ?? {};
    throw new Error(data._ERROR_MESSAGE_ || data.errors || data.error || "Sim Routing request failed.");
  }
  return response?.data;
}

function requireObject<T>(value: unknown, name: string): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Sim Routing did not return ${name}.`);
  }
  return value as T;
}

export function simulationSetupError(error: any): string {
  const data = error?.response?.data;
  const message = data?._ERROR_MESSAGE_
    || data?._ERROR_MESSAGE_LIST_?.join?.("; ")
    || data?.errors
    || data?.error
    || error?.message;
  return String(message || "The request failed.");
}

export async function listSimDatastores(): Promise<SimDatastore[]> {
  const data = responseData(await api({ url: `${root}/datastores`, method: "GET" }));
  if (!Array.isArray(data?.datastoreList)) throw new Error("Sim Routing did not return a datastore list.");
  return data.datastoreList;
}

export async function getSimDatastore(simDatastoreId: string): Promise<SimDatastore> {
  const data = responseData(await api({ url: `${root}/datastores/${id(simDatastoreId)}`, method: "GET" }));
  const datastore = requireObject<SimDatastore>(data?.datastore, "the datastore");
  if (!datastore.simDatastoreId || !datastore.statusId) throw new Error("Sim Routing returned an incomplete datastore.");
  return datastore;
}

export async function createSimDatastore(displayName: string): Promise<string> {
  const data = responseData(await api({
    url: `${root}/datastores`, method: "POST", data: { displayName },
  }));
  if (!data?.simDatastoreId) throw new Error("Sim Routing did not return a datastore ID.");
  return String(data.simDatastoreId);
}

export async function deleteSimDatastore(simDatastoreId: string): Promise<void> {
  responseData(await api({
    url: `${root}/datastores/${id(simDatastoreId)}`, method: "DELETE",
  }));
}

export async function startSimFill(simDatastoreId: string): Promise<{ fillId: string; taskCount: number }> {
  const data = responseData(await api({
    url: `${root}/datastores/${id(simDatastoreId)}/fill`, method: "POST",
  }));
  if (!data?.runWorkEffortId) throw new Error("Sim Routing did not return a fill run ID.");
  return { fillId: String(data.runWorkEffortId), taskCount: Number(data.taskCount) || 0 };
}

export async function getSimFill(simDatastoreId: string, fillId: string): Promise<SimFillProgress> {
  const data = responseData(await api({
    url: `${root}/datastores/${id(simDatastoreId)}/fill/${id(fillId)}`, method: "GET",
  }));
  const fill = requireObject<SimFillProgress>(data?.fill, "fill progress");
  if (!fill.statusId) throw new Error("Sim Routing returned fill progress without a status.");
  return fill;
}

export async function openSimDatastore(simDatastoreId: string): Promise<string> {
  const data = responseData(await api({
    url: `${root}/datastores/${id(simDatastoreId)}/open`, method: "POST",
  }));
  if (!data?.datastoreName) throw new Error("Sim Routing did not confirm which datastore opened.");
  return String(data.datastoreName);
}

export async function listSimRoutingGroups(pageIndex = 0): Promise<{ groups: SimRoutingGroup[]; totalCount: number }> {
  const data = responseData(await api({
    url: `${root}/groups`, method: "GET", params: { pageIndex, pageSize: 200 },
  }));
  if (!Array.isArray(data?.groupList)) throw new Error("Sim Routing did not return routing groups.");
  return { groups: data.groupList, totalCount: Number(data.totalCount) || data.groupList.length };
}

export async function validateSimRoutingGroup(routingGroupId: string): Promise<SimGroupValidity> {
  const data = responseData(await api({
    url: `${root}/groups/${id(routingGroupId)}/validation`, method: "GET",
  }));
  return requireObject<SimGroupValidity>(data?.validity, "group validation");
}

export async function cloneSimVariation(routingGroupId: string, variationName: string): Promise<string> {
  const data = responseData(await api({
    url: `${root}/groups/${id(routingGroupId)}/variations`, method: "POST",
    data: { variationName },
  }));
  if (!data?.variationGroupId) throw new Error("Sim Routing did not return a variation ID.");
  return String(data.variationGroupId);
}

export async function submitSimRun(routingGroupIds: string[]): Promise<{ simulationId: string; jobRunId?: string }> {
  const data = responseData(await api({
    url: `${root}/simulations`, method: "POST", data: { routingGroupIds },
  }));
  if (!data?.simulationId || data.statusId !== "BRSIM_QUEUED") {
    throw new Error("Sim Routing did not confirm a queued simulation.");
  }
  return { simulationId: String(data.simulationId), jobRunId: data.jobRunId };
}

export async function getSimRun(simulationId: string): Promise<{ simulation: SimRun; variants: SimRunVariant[] }> {
  const data = responseData(await api({
    url: `${root}/simulations/${id(simulationId)}`, method: "GET",
  }));
  const simulation = requireObject<SimRun>(data?.simulation, "the simulation");
  if (!simulation.statusId) throw new Error("Sim Routing returned a simulation without a status.");
  if (!Array.isArray(data?.variants)) throw new Error("Sim Routing did not return simulation variants.");
  return { simulation, variants: data.variants };
}
