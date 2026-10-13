import { api, commonUtil, logger } from "@common";
import { defineStore } from "pinia";
import { useAtpProductStore } from "@/store/atpProductStore";
import {
  EXCLUDED_SALES_CHANNELS,
  EXCLUDED_SHIPMENT_METHODS,
  FULFILLMENT_FACILITY_TYPES,
  type FacilityHold,
  type FacilityInfo,
  type RuleSeries,
  type Week,
  buildFacilityHolds,
  buildRuleSeries,
  buildSafetyByReason,
  buildStoreShipped,
  lastCompleteWeeks,
  thresholdSummary,
  toSafetyRule
} from "@/utils/routingDiagnostics";

// DataDocuments the dashboard reads through oms/dataDocumentView. Most are aggregate views,
// so the OMS returns a handful of grouped rows rather than raw records.
export const DIAGNOSTIC_DOCUMENTS = {
  ruleOrders: "RoutingDashRuleOrders",
  storeShipped: "RoutingDashStoreShipped",
  inventoryAvailable: "RoutingDashInvAvailable",
  safetyCapped: "RoutingDashInvSafetyCapped",
  safetyShort: "RoutingDashInvSafetyShort",
  safetySku: "RoutingDashSafetySku",
  variantTags: "RoutingDashVariantTags"
};

type SectionStatus = "idle" | "loading" | "ready" | "error";

export interface RoutingDiagnosticsState {
  weekCount: number;
  weeks: Week[];
  facilities: Record<string, FacilityInfo>;
  ruleSeries: RuleSeries[];
  // Distinct orders brokered each week, all locations and stores only.
  brokeredOrders: number[];
  storeOrders: number[];
  storeShipped: { weeklyUnits: number[]; weeklyOrders: number[]; stores: { facilityId: string; facilityName: string; units: number[] }[] };
  holds: FacilityHold[];
  safetyByReason: ReturnType<typeof buildSafetyByReason>;
  safetyRuleIds: Record<string, string>;
  threshold: { activeRules: number; maxThreshold: number };
  status: { routing: SectionStatus; shipping: SectionStatus; inventory: SectionStatus; reasons: SectionStatus };
  loadedAt: number | null;
}

async function queryDocument(dataDocumentId: string, fieldsToSelect: string[], customParametersMap: Record<string, any>, options: { pageSize?: number; pageIndex?: number; distinct?: boolean; filterByDate?: boolean } = {}) {
  const resp = await api({
    url: "oms/dataDocumentView",
    method: "POST",
    data: { dataDocumentId, pageSize: options.pageSize || 1000, pageIndex: options.pageIndex || 0, distinct: !!options.distinct, filterByDate: !!options.filterByDate, fieldsToSelect: fieldsToSelect.join(","), customParametersMap }
  }) as any;
  if(commonUtil.hasError(resp)) {throw resp.data;}

  return (resp.data?.entityValueList || []) as any[];
}

// Pages through a row-level document until a short page comes back.
async function queryAllPages(dataDocumentId: string, fieldsToSelect: string[], customParametersMap: Record<string, any>, pageSize = 5000) {
  const rows: any[] = [];
  for(let pageIndex = 0; ; pageIndex++) {
    const page = await queryDocument(dataDocumentId, fieldsToSelect, customParametersMap, { pageSize, pageIndex });
    rows.push(...page);
    if(page.length < pageSize) {return rows;}
  }
}

// Runs requests a few at a time; these are aggregate queries against the live OMS.
async function inBatches<T, R>(items: T[], fn: (item: T) => Promise<R>, size = 3) {
  const results: R[] = [];
  for(let i = 0; i < items.length; i += size) {
    results.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }

  return results;
}

async function fetchActiveRules(productStoreId: string, groupTypeEnumId: string) {
  const groupsResp = await api({
    url: "available-to-promise/ruleGroups",
    method: "GET",
    params: { productStoreId, groupTypeEnumId, statusId: "ATP_RG_ACTIVE", pageSize: 100 }
  }) as any;
  const groups = (Array.isArray(groupsResp.data) ? groupsResp.data : groupsResp.data?.ruleGroups || [])
    .filter((group: any) => group.groupTypeEnumId === groupTypeEnumId);
  const rules = await inBatches(groups, async (group: any) => {
    const resp = await api({
      url: "available-to-promise/decisionRules",
      method: "GET",
      params: { ruleGroupId: group.ruleGroupId, statusId: "ATP_RULE_ACTIVE", pageSize: 200 }
    }) as any;

    return (Array.isArray(resp.data) ? resp.data : resp.data?.decisionRules || []) as any[];
  });

  return rules.flat().filter((rule: any) => rule.statusId === "ATP_RULE_ACTIVE");
}

// The same exclusions buildRuleSeries applies to rule rows, expressed as query filters.
const ROUTABLE_ORDER_FILTER = {
  salesChannelEnumId: EXCLUDED_SALES_CHANNELS.join(","),
  salesChannelEnumId_op: "in",
  salesChannelEnumId_not: "Y",
  shipmentMethodTypeId: EXCLUDED_SHIPMENT_METHODS.join(","),
  shipmentMethodTypeId_op: "in",
  shipmentMethodTypeId_not: "Y",
  facilityTypeId: FULFILLMENT_FACILITY_TYPES.join(","),
  facilityTypeId_op: "in"
};

const emptyReasons = () => ({ reasons: [] as string[], stores: [] as any[], totals: {} as Record<string, number> });

export const useRoutingDiagnosticsStore = defineStore("routingDiagnostics", {
  state: (): RoutingDiagnosticsState => ({
    weekCount: 6,
    weeks: [],
    facilities: {},
    ruleSeries: [],
    brokeredOrders: [],
    storeOrders: [],
    storeShipped: { weeklyUnits: [], weeklyOrders: [], stores: [] },
    holds: [],
    safetyByReason: emptyReasons(),
    safetyRuleIds: {},
    threshold: { activeRules: 0, maxThreshold: 0 },
    status: { routing: "idle", shipping: "idle", inventory: "idle", reasons: "idle" },
    loadedAt: null
  }),
  actions: {
    async load(weekCount?: number) {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if(!productStoreId) {return;}
      if(weekCount) {this.weekCount = weekCount;}
      this.weeks = lastCompleteWeeks(this.weekCount);
      this.status = { routing: "loading", shipping: "loading", inventory: "loading", reasons: "loading" };
      await this.loadFacilities(productStoreId);
      await Promise.allSettled([
        this.loadRouting(productStoreId),
        this.loadShipping(productStoreId),
        this.loadInventory(productStoreId)
      ]);
      this.loadedAt = Date.now();
    },
    // The Safety stock page needs only the inventory sections, not the weekly routing queries.
    async loadSafetyStock() {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if(!productStoreId) {return;}
      this.status = { ...this.status, inventory: "loading", reasons: "loading" };
      await this.loadFacilities(productStoreId);
      await this.loadInventory(productStoreId);
    },
    async loadFacilities(productStoreId: string) {
      const facilities: Record<string, FacilityInfo> = {};
      try {
        const resp = await api({
          url: `admin/productStores/${productStoreId}/facilities`,
          method: "GET",
          params: { facilityTypeId: "VIRTUAL_FACILITY", facilityTypeId_not: "Y", pageSize: 250 }
        }) as any;
        for(const facility of resp.data || []) {
          facilities[facility.facilityId] = {
            facilityId: facility.facilityId,
            facilityName: facility.facilityName || facility.facilityId,
            facilityTypeId: facility.facilityTypeId
          };
        }
      } catch (err) {
        logger.error("routing diagnostics: failed to load product store facilities", err);
      }
      this.facilities = facilities;
    },
    async loadRouting(productStoreId: string) {
      try {
        const rowsByWeek = await inBatches(this.weeks, (week) => queryDocument(
          DIAGNOSTIC_DOCUMENTS.ruleOrders,
          ["routingRule", "routingRuleId", "routingGroupId", "orderRoutingId", "orderCount", "salesChannelEnumId", "shipmentMethodTypeId", "facilityTypeId"],
          { productStoreId, changeDatetime_from: week.start, changeDatetime_thru: week.end }
        ));
        this.ruleSeries = buildRuleSeries(rowsByWeek);
        // An order split across rules counts once under each rule, so weekly totals are
        // counted distinct on the server rather than added up from the rule rows.
        const totals = await inBatches(this.weeks, async (week) => {
          const scope = { ...ROUTABLE_ORDER_FILTER, productStoreId, changeDatetime_from: week.start, changeDatetime_thru: week.end };
          const [all, stores] = await Promise.all([
            queryDocument(DIAGNOSTIC_DOCUMENTS.ruleOrders, ["orderCount"], scope),
            queryDocument(DIAGNOSTIC_DOCUMENTS.ruleOrders, ["orderCount"], { ...scope, facilityTypeId: "RETAIL_STORE", facilityTypeId_op: "equals" })
          ]);

          return { all: Number(all[0]?.orderCount) || 0, stores: Number(stores[0]?.orderCount) || 0 };
        });
        this.brokeredOrders = totals.map((week) => week.all);
        this.storeOrders = totals.map((week) => week.stores);
        this.status.routing = "ready";
      } catch (err) {
        logger.error("routing diagnostics: failed to load orders by rule", err);
        this.ruleSeries = [];
        this.brokeredOrders = [];
        this.storeOrders = [];
        this.status.routing = "error";
      }
    },
    async loadShipping(productStoreId: string) {
      try {
        const rowsByWeek = await inBatches(this.weeks, (week) => queryDocument(
          DIAGNOSTIC_DOCUMENTS.storeShipped,
          ["facilityId", "shipmentMethodTypeId", "salesChannelEnumId", "shippedUnits", "shippedOrders"],
          { productStoreId, statusDate_from: week.start, statusDate_thru: week.end }
        ));
        this.storeShipped = buildStoreShipped(rowsByWeek, this.facilities);
        this.status.shipping = "ready";
      } catch (err) {
        logger.error("routing diagnostics: failed to load store-shipped units", err);
        this.storeShipped = { weeklyUnits: [], weeklyOrders: [], stores: [] };
        this.status.shipping = "error";
      }
    },
    async loadInventory(productStoreId: string) {
      const facilityIds = Object.keys(this.facilities);
      try {
        const scope = { facilityId: facilityIds.join(","), facilityId_op: "in" };
        const [available, safetyCapped, safetyShort, thresholdRules] = await Promise.all([
          facilityIds.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.inventoryAvailable, ["facilityId", "allowBrokering", "availableUnits"], scope) : [],
          facilityIds.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.safetyCapped, ["facilityId", "allowBrokering", "heldUnits"], scope) : [],
          facilityIds.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.safetyShort, ["facilityId", "allowBrokering", "heldUnits"], scope) : [],
          fetchActiveRules(productStoreId, "RG_THRESHOLD")
        ]);
        this.holds = buildFacilityHolds(available, safetyCapped, safetyShort, this.facilities);
        this.threshold = thresholdSummary(thresholdRules);
        this.status.inventory = "ready";
      } catch (err) {
        logger.error("routing diagnostics: failed to load inventory held back", err);
        this.holds = [];
        this.status.inventory = "error";
        this.status.reasons = "error";

        return;
      }
      await this.loadSafetyReasons(productStoreId);
    },
    // Needs the live holds for the store list and the shipping-only units, so it runs after them.
    async loadSafetyReasons(productStoreId: string) {
      const storeIds = this.holds.filter((hold) => hold.facilityTypeId === "RETAIL_STORE").map((hold) => hold.facilityId);
      if(!storeIds.length) {
        this.safetyByReason = emptyReasons();
        this.status.reasons = "ready";

        return;
      }
      try {
        const rules = (await fetchActiveRules(productStoreId, "RG_SAFETY_STOCK")).map(toSafetyRule);
        const tags = [...new Set(rules.flatMap((rule) => [...rule.includeTags, ...rule.excludeTags]))];
        const groupIds = [...new Set(rules.flatMap((rule) => rule.facilityGroupIds))];
        const [skuRows, tagRows, groupMembers] = await Promise.all([
          queryAllPages(
            DIAGNOSTIC_DOCUMENTS.safetySku, ["productId", "facilityId", "minimumStock", "lastInventoryCount"],
            { facilityId: storeIds.join(","), facilityId_op: "in", lastInventoryCount_from: 1 }
          ),
          // filterByDate keeps only current variant-parent associations, so a variant takes its present parent's tags.
          tags.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.variantTags, ["productId", "tag"], { tag: tags.join(","), tag_op: "in" }, { pageSize: 20000, distinct: true, filterByDate: true }) : [],
          inBatches(groupIds, async (facilityGroupId) => {
            const resp = await api({ url: "oms/groupFacilities", method: "GET", params: { facilityGroupId, pageSize: 500 } }) as any;

            return [facilityGroupId, (resp.data || []).map((facility: any) => facility.facilityId)] as [string, string[]];
          })
        ]);
        const tagsByProduct: Record<string, string[]> = {};
        for(const row of tagRows) {(tagsByProduct[row.productId] = tagsByProduct[row.productId] || []).push(row.tag);}
        const storeHolds = this.holds.filter((hold) => storeIds.includes(hold.facilityId));
        this.safetyByReason = buildSafetyByReason(skuRows, tagsByProduct, rules, Object.fromEntries(groupMembers), storeHolds);
        this.safetyRuleIds = Object.fromEntries(rules.map((rule) => [rule.ruleName, rule.ruleId]));
        this.status.reasons = "ready";
      } catch (err) {
        logger.error("routing diagnostics: failed to load safety stock by reason", err);
        this.safetyByReason = emptyReasons();
        this.status.reasons = "error";
      }
    }
  }
});
