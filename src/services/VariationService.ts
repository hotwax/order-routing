// src/services/VariationService.ts
// Thin REST layer for the sim-routing (variation / what-if) API. The pure `variationRequests` builders
// return axios-style configs (testable without network); the exported async functions add baseURL +
// auth via simApi() and unwrap/validate the response.
import { simApi, simRoutingApiBaseUrl } from "./SimulationService";
import type { GroupRunResult, VariationListItem, VariationTree } from "../types/variation";

export interface VariationConditionInput {
  conditionSeqId: string;
  fieldName: string;
  operator: string;
  fieldValue: string;
  sequenceNum: number;
  conditionTypeEnumId?: string;
}

export interface VariationActionInput {
  actionSeqId: string;
  actionTypeEnumId: string;
  actionValue: string | null;
}

/** Pure request builders — { url, method, params?, data? } relative to simRoutingApiBaseUrl(). */
export const variationRequests = {
  listVariations: (parentRoutingGroupId: string) =>
    ({ url: "variations", method: "GET", params: { parentRoutingGroupId } }),
  createVariation: (parentRoutingGroupId: string, variationName?: string) =>
    ({ url: `routingGroups/${parentRoutingGroupId}/variations`, method: "POST",
      data: variationName ? { variationName } : {} }),
  getVariation: (vid: string) => ({ url: `variations/${vid}`, method: "GET" }),
  setRouting: (vid: string, rid: string, patch: { statusId?: string; sequenceNum?: number }) =>
    ({ url: `variations/${vid}/routings/${rid}`, method: "PUT", data: patch }),
  upsertFilter: (vid: string, rid: string, cond: VariationConditionInput) =>
    ({ url: `variations/${vid}/routings/${rid}/filters`, method: "POST", data: cond }),
  deleteFilter: (vid: string, rid: string, seqId: string) =>
    ({ url: `variations/${vid}/routings/${rid}/filters/${seqId}`, method: "DELETE" }),
  setRule: (vid: string, rid: string, ruleId: string, patch: { statusId?: string; sequenceNum?: number }) =>
    ({ url: `variations/${vid}/routings/${rid}/rules/${ruleId}`, method: "PUT", data: patch }),
  upsertInventoryCondition: (vid: string, rid: string, ruleId: string, cond: VariationConditionInput) =>
    ({ url: `variations/${vid}/routings/${rid}/rules/${ruleId}/inventoryConditions`, method: "POST", data: cond }),
  deleteInventoryCondition: (vid: string, rid: string, ruleId: string, seqId: string) =>
    ({ url: `variations/${vid}/routings/${rid}/rules/${ruleId}/inventoryConditions/${seqId}`, method: "DELETE" }),
  upsertAction: (vid: string, rid: string, ruleId: string, action: VariationActionInput) =>
    ({ url: `variations/${vid}/routings/${rid}/rules/${ruleId}/actions`, method: "POST", data: action }),
  deleteAction: (vid: string, rid: string, ruleId: string, seqId: string) =>
    ({ url: `variations/${vid}/routings/${rid}/rules/${ruleId}/actions/${seqId}`, method: "DELETE" }),
  runVariation: (vid: string, sampleCap?: number) =>
    ({ url: `variations/${vid}/simulation`, method: "POST", data: sampleCap != null ? { sampleCap } : {} }),
};

async function call(req: { url: string; method: string; params?: any; data?: any }, timeout?: number): Promise<any> {
  const { commonUtil } = await import("@common");
  const resp: any = await simApi({ ...req, baseURL: simRoutingApiBaseUrl(), ...(timeout ? { timeout } : {}) });

  if (commonUtil.hasError(resp)) {
    throw new Error(`sim-routing ${req.method} ${req.url} failed: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  }

  return resp.data;
}

export async function listVariations(parentRoutingGroupId: string): Promise<VariationListItem[]> {
  const data = await call(variationRequests.listVariations(parentRoutingGroupId));

  return data?.variationList ?? [];
}

export async function createVariation(parentRoutingGroupId: string, variationName?: string): Promise<string> {
  const data = await call(variationRequests.createVariation(parentRoutingGroupId, variationName));

  if (!data?.variationGroupId) throw new Error(`createVariation returned no id: ${JSON.stringify(data)?.slice(0, 200)}`);

  return data.variationGroupId;
}

export async function getVariation(vid: string): Promise<VariationTree> {
  const data = await call(variationRequests.getVariation(vid));

  if (!data?.variation?.variationGroupId) throw new Error(`Variation ${vid} could not be loaded.`);

  return data.variation;
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

/** Run the variation. Synchronous, ~25–150s — long client timeout. Returns the GroupRunResult. */
export async function runVariation(vid: string, sampleCap?: number): Promise<GroupRunResult> {
  const data = await call(variationRequests.runVariation(vid, sampleCap), 200_000);

  if (!data?.groupRunResult) throw new Error(`Variation run returned no result: ${JSON.stringify(data)?.slice(0, 200)}`);

  return data.groupRunResult;
}
