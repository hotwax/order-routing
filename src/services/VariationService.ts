import { api, commonUtil } from "@common";
import type { VariationListItem, VariationTree } from "../types/variation";

/** Saved variations live in Sim Routing; all browser requests pass through authenticated Main OMS services. */
export async function listVariations(parentRoutingGroupId: string, signal?: AbortSignal): Promise<VariationListItem[]> {
  const variations: VariationListItem[] = [];
  for (let pageIndex = 0; ; pageIndex++) {
    const response: any = await api({
      url: "order-routing/simulation/variations", method: "GET",
      params: { parentRoutingGroupId, pageIndex, pageSize: 200 },
      ...(signal ? { signal } : {}),
    });
    if (commonUtil.hasError(response) || !Array.isArray(response.data?.variationList)) {
      throw new Error("Sim Routing did not return a variation list.");
    }
    variations.push(...response.data.variationList);
    const totalCount = Number(response.data.totalCount);
    if (!Number.isFinite(totalCount) || variations.length >= totalCount || !response.data.variationList.length) break;
  }
  return variations;
}

export async function createVariation(parentRoutingGroupId: string, variationName?: string, signal?: AbortSignal): Promise<string> {
  const response: any = await api({
    url: `order-routing/simulation/groups/${encodeURIComponent(parentRoutingGroupId)}/variations`,
    method: "POST", data: variationName ? { variationName } : {},
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(response) || !response.data?.variationGroupId) {
    throw new Error("Sim Routing did not create the variation.");
  }
  return response.data.variationGroupId;
}

export async function getVariation(variationGroupId: string, signal?: AbortSignal): Promise<VariationTree> {
  const response: any = await api({
    url: `order-routing/simulation/variations/${encodeURIComponent(variationGroupId)}`,
    method: "GET", ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(response) || !response.data?.variation?.variationGroupId) {
    throw new Error(`Variation ${variationGroupId} could not be loaded.`);
  }
  return response.data.variation;
}

export async function deleteVariation(variationGroupId: string, signal?: AbortSignal): Promise<void> {
  const response: any = await api({
    url: `order-routing/simulation/variations/${encodeURIComponent(variationGroupId)}`,
    method: "DELETE", ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(response)) throw new Error(`Variation ${variationGroupId} could not be deleted.`);
}

/** Whole-tree replacement returns the canonical tree with server-generated IDs. */
export async function replaceVariationConfig(variationGroupId: string, routings: any[], signal?: AbortSignal): Promise<VariationTree> {
  const response: any = await api({
    url: `order-routing/simulation/variations/${encodeURIComponent(variationGroupId)}/config`,
    method: "PUT", data: { routings }, ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(response) || !response.data?.variation?.variationGroupId) {
    throw new Error(`Variation ${variationGroupId} could not be updated.`);
  }
  return response.data.variation;
}

export const VariationService = {
  listVariations,
  createVariation,
  getVariation,
  deleteVariation,
  replaceVariationConfig,
};
