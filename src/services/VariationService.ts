// src/services/VariationService.ts
// Thin REST layer for the sim-routing (variation / what-if) API. The pure `variationRequests` builders
// return axios-style configs (testable without network); the exported async functions add baseURL +
// auth via the isolated simulation client and unwrap/validate the response.
import { commonUtil } from "@common";
import type { VariationConditionInput, VariationActionInput } from "../types/variation";
import type { GroupRunResult, VariationListItem, VariationTree } from "../types/variation";
import { simApi } from "./SimApiService";

// The current backend contract documents group/variation runs in minutes, not seconds. Keep a
// finite client ceiling while leaving enough headroom above the documented 2-5 minute window.
const VARIATION_RUN_TIMEOUT_MS = 10 * 60_000;

/** Pure request builders — { url, method, params?, data? } relative to simApiBaseUrl(). */
export const variationRequests = {
  listVariations: (parentRoutingGroupId: string) =>
    ({ url: "sim-routing/variations", method: "GET", params: { parentRoutingGroupId } }),
  createVariation: (parentRoutingGroupId: string, variationName?: string) =>
    ({ url: `sim-routing/routingGroups/${parentRoutingGroupId}/variations`, method: "POST",
      data: variationName ? { variationName } : {} }),
  getVariation: (vid: string) => ({ url: `sim-routing/variations/${vid}`, method: "GET" }),
  deleteVariation: (vid: string) => ({ url: `sim-routing/variations/${vid}`, method: "DELETE" }),
  replaceConfig: (vid: string, routings: any[]) =>
    ({ url: `sim-routing/variations/${vid}/config`, method: "PUT", data: { routings } }),
  setRouting: (vid: string, rid: string, patch: { statusId?: string; sequenceNum?: number }) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}`, method: "PUT", data: patch }),
  upsertFilter: (vid: string, rid: string, cond: VariationConditionInput) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/filters`, method: "POST", data: cond }),
  deleteFilter: (vid: string, rid: string, seqId: string) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/filters/${seqId}`, method: "DELETE" }),
  setRule: (vid: string, rid: string, ruleId: string, patch: { statusId?: string; sequenceNum?: number }) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/rules/${ruleId}`, method: "PUT", data: patch }),
  upsertInventoryCondition: (vid: string, rid: string, ruleId: string, cond: VariationConditionInput) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/rules/${ruleId}/inventoryConditions`, method: "POST", data: cond }),
  deleteInventoryCondition: (vid: string, rid: string, ruleId: string, seqId: string) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/rules/${ruleId}/inventoryConditions/${seqId}`, method: "DELETE" }),
  upsertAction: (vid: string, rid: string, ruleId: string, action: VariationActionInput) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/rules/${ruleId}/actions`, method: "POST", data: action }),
  deleteAction: (vid: string, rid: string, ruleId: string, seqId: string) =>
    ({ url: `sim-routing/variations/${vid}/routings/${rid}/rules/${ruleId}/actions/${seqId}`, method: "DELETE" }),
  runVariation: (vid: string, sampleCap?: number) =>
    ({ url: `sim-routing/variations/${vid}/simulation`, method: "POST", data: sampleCap != null ? { sampleCap } : {} }),
};

async function call(req: { url: string; method: string; params?: any; data?: any }, timeout?: number, signal?: AbortSignal): Promise<any> {
  const resp: any = await simApi({
    ...req,
    ...(timeout ? { timeout } : {}),
    ...(signal ? { signal } : {}),
  });

  if (commonUtil.hasError(resp)) {
    throw new Error(`sim-routing ${req.method} ${req.url} failed: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  }

  return resp.data;
}

export async function listVariations(parentRoutingGroupId: string, signal?: AbortSignal): Promise<VariationListItem[]> {
  const data = await call(variationRequests.listVariations(parentRoutingGroupId), undefined, signal);

  return data?.variationList ?? [];
}

export async function createVariation(parentRoutingGroupId: string, variationName?: string, signal?: AbortSignal): Promise<string> {
  const data = await call(variationRequests.createVariation(parentRoutingGroupId, variationName), undefined, signal);

  if (!data?.variationGroupId) throw new Error(`createVariation returned no id: ${JSON.stringify(data)?.slice(0, 200)}`);

  return data.variationGroupId;
}

export async function getVariation(vid: string, signal?: AbortSignal): Promise<VariationTree> {
  const data = await call(variationRequests.getVariation(vid), undefined, signal);

  if (!data?.variation?.variationGroupId) throw new Error(`Variation ${vid} could not be loaded.`);

  return data.variation;
}

export async function deleteVariation(vid: string, signal?: AbortSignal): Promise<void> {
  await call(variationRequests.deleteVariation(vid), undefined, signal);
}

/** Persist-on-save: replace the variation's whole config (lossless whole-tree). Returns the canonical
 *  variation tree the backend re-inserted (adopt it as the new client state). */
export async function replaceVariationConfig(vid: string, routings: any[], signal?: AbortSignal): Promise<VariationTree> {
  const data = await call(variationRequests.replaceConfig(vid, routings), undefined, signal);
  // The endpoint returns the canonical tree (same shape as GET). Tolerate either {variation} or a bare tree.
  return data?.variation ?? data;
}

export const setRouting = (vid: string, rid: string, patch: { statusId?: string; sequenceNum?: number }) =>
  call(variationRequests.setRouting(vid, rid, patch));
export const upsertFilter = (vid: string, rid: string, cond: VariationConditionInput) =>
  call(variationRequests.upsertFilter(vid, rid, cond));
export const deleteFilter = (vid: string, rid: string, seqId: string) =>
  call(variationRequests.deleteFilter(vid, rid, seqId));
export const setRule = (vid: string, rid: string, ruleId: string, patch: { statusId?: string; sequenceNum?: number }) =>
  call(variationRequests.setRule(vid, rid, ruleId, patch));
export const upsertInventoryCondition = (vid: string, rid: string, ruleId: string, cond: VariationConditionInput) =>
  call(variationRequests.upsertInventoryCondition(vid, rid, ruleId, cond));
export const deleteInventoryCondition = (vid: string, rid: string, ruleId: string, seqId: string) =>
  call(variationRequests.deleteInventoryCondition(vid, rid, ruleId, seqId));
export const upsertAction = (vid: string, rid: string, ruleId: string, action: VariationActionInput) =>
  call(variationRequests.upsertAction(vid, rid, ruleId, action));
export const deleteAction = (vid: string, rid: string, ruleId: string, seqId: string) =>
  call(variationRequests.deleteAction(vid, rid, ruleId, seqId));

/**
 * Run the variation synchronously with a finite timeout. Newer backends return simulationId beside
 * groupRunResult; older deployments omit it, and a best-effort history persistence failure may also
 * leave it absent. Normalize a returned id onto the result without making it a success requirement.
 */
export async function runVariation(vid: string, sampleCap?: number, signal?: AbortSignal): Promise<GroupRunResult> {
  const data = await call(variationRequests.runVariation(vid, sampleCap), VARIATION_RUN_TIMEOUT_MS, signal);

  if (!data?.groupRunResult) throw new Error(`Variation run returned no result: ${JSON.stringify(data)?.slice(0, 200)}`);

  const simulationId = String(data.simulationId || data.groupRunResult.simulationId || "").trim();
  return simulationId
    ? { ...data.groupRunResult, simulationId }
    : data.groupRunResult;
}

export const VariationService = {
  listVariations,
  createVariation,
  getVariation,
  deleteVariation,
  replaceVariationConfig,
  setRouting,
  upsertFilter,
  deleteFilter,
  setRule,
  upsertInventoryCondition,
  deleteInventoryCondition,
  upsertAction,
  deleteAction,
  runVariation,
};
