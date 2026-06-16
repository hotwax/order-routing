import { commonUtil } from "@common";

/** A request function with the api()/simApi() signature: takes an axios-style config, returns the
 *  response. orderRoutingStore passes api() (OMS Bearer); the simulate path passes simApi() (sim
 *  api_key in two-instance mode) so the two backends never share a request path. */
export type RoutingRequest = (config: any) => Promise<any>;

/** Pure: normalize a routing group's routing/rule/filter hierarchy in place and return it. Sorts
 *  routings, rules and inventory filters by sequence, and rewrites negative-operator filters to their
 *  `_excluded` fieldName form (mirrors the backend's storage of exclusion filters). Extracted from
 *  orderRoutingStore.fetchCurrentRoutingGroup so the OMS and simulate paths share one implementation. */
export function normalizeRoutingGroupHierarchy(group: any): any {
  if (group?.routings?.length) {
    group.routings = commonUtil.sortSequence(group.routings).map((routing: any) => {
      if (routing.orderFilters?.length) {
        routing.orderFilters = routing.orderFilters.map((filter: any) => {
          if (filter.operator === "not-equals" || filter.operator === "not-in") {
            filter.fieldName = filter.fieldName.replace("_excluded", "") + "_excluded";
          }
          return filter;
        });
      }
      if (routing.rules?.length) {
        routing.rules = commonUtil.sortSequence(routing.rules).map((rule: any) => {
          if (rule.inventoryFilters?.length) {
            const filterSortDesc = import.meta.env.VITE_FILTER_SORT_DESC || "";
            rule.inventoryFilters = commonUtil.sortSequence(rule.inventoryFilters).map((filter: any) => {
              if (filterSortDesc.includes(filter.fieldName)) {
                filter.fieldName = filter.fieldName.replace(" desc", "").replace(" DESC", "");
              }
              if (filter.operator === "not-equals") {
                filter.fieldName = filter.fieldName.replace("_excluded", "") + "_excluded";
              }
              return filter;
            });
          }
          return rule;
        });
      }
      return routing;
    });
  }
  return group;
}

/** Fetch one routing group's full raw hierarchy (routings/rules/filters) and normalize it. `listGroups`
 *  is the already-loaded group list (for the metadata fallback / isNew short-circuit). `request` +
 *  `baseURL` select the instance: api()+undefined for OMS, simApi()+simMoquiUrl() for the sim instance.
 *  Outcomes:
 *  - 200 with an empty/non-object body: "valid group, no routings yet" — list metadata + routings: [].
 *  - request throws (network/5xx) with the group in the list: fall back to the list metadata WITHOUT
 *    a routings array, so cache checks treat it as partial and refetch next visit.
 *  - request throws with no list entry: rethrow — there is nothing to render. */
export async function fetchRoutingGroupDetail(
  routingGroupId: string,
  listGroups: any[],
  request: RoutingRequest,
  baseURL?: string,
): Promise<any> {
  let group = (listGroups || []).find((g: any) => g.routingGroupId === routingGroupId);
  if (!group?.isNew) {
    let resp;
    try {
      resp = await request({ url: `order-routing/groups/${routingGroupId}/raw`, method: "GET", baseURL });
    } catch (err) {
      if (group) return normalizeRoutingGroupHierarchy({ ...group });
      throw err;
    }
    if (!commonUtil.hasError(resp) && resp.data && typeof resp.data === "object" && !Array.isArray(resp.data)) {
      group = resp.data;
    } else if (group) {
      group = { ...group, routings: [] };
    } else {
      throw resp?.data;
    }
  }
  return normalizeRoutingGroupHierarchy(group);
}

/** Fetch the routing-group list for a product store via the given instance's request fn. Used by the
 *  simulate path (simApi + simMoquiUrl); the OMS store keeps its own schedule-enriched list fetch. */
export async function fetchRoutingGroupsList(
  productStoreId: string,
  request: RoutingRequest,
  baseURL?: string,
): Promise<any[]> {
  const resp = await request({
    url: `order-routing/groups`,
    method: "GET",
    baseURL,
    params: { productStoreId, pageSize: 200 },
  });
  return !commonUtil.hasError(resp) && Array.isArray(resp.data) ? resp.data : [];
}

export const RoutingGroupService = {
  normalizeRoutingGroupHierarchy,
  fetchRoutingGroupDetail,
  fetchRoutingGroupsList,
};
