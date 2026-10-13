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
  storeShipped: { weeklyUnits: number[]; stores: { facilityId: string; facilityName: string; units: number[] }[] };
  holds: FacilityHold[];
  safetyByReason: ReturnType<typeof buildSafetyByReason>;
  threshold: { activeRules: number; maxThreshold: number };
  status: { routing: SectionStatus; shipping: SectionStatus; inventory: SectionStatus; reasons: SectionStatus };
  // What was last loaded and when, so revisiting a page within a few minutes skips the queries.
  loadedFor: string;
  loadedAt: number | null;
  inventoryLoadedFor: string;
  inventoryLoadedAt: number | null;
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

// Routable orders only: no POS sales or pickup, allocated to a store or warehouse. Applied on the
// server so every order count is a distinct count.
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

// Each load gets a run number per section group; a response from an older run (another product
// store or week range, or a refresh) is dropped instead of overwriting the newer one. Routing and
// inventory are counted separately because the Safety stock page reloads only inventory.
const runs = { routing: 0, inventory: 0 };
type RunKind = keyof typeof runs;
const isStale = (kind: RunKind, run: number) => run !== runs[kind];

// Data younger than this is reused when the user comes back to a page.
const FRESH_FOR_MS = 5 * 60 * 1000;

const emptyReasons = () => ({ reasons: [] as string[], labels: {} as Record<string, string>, stores: [] as any[], totals: {} as Record<string, number> });

export const useRoutingDiagnosticsStore = defineStore("routingDiagnostics", {
  state: (): RoutingDiagnosticsState => ({
    weekCount: 6,
    weeks: [],
    facilities: {},
    ruleSeries: [],
    brokeredOrders: [],
    storeOrders: [],
    storeShipped: { weeklyUnits: [], stores: [] },
    holds: [],
    safetyByReason: emptyReasons(),
    threshold: { activeRules: 0, maxThreshold: 0 },
    status: { routing: "idle", shipping: "idle", inventory: "idle", reasons: "idle" },
    loadedFor: "",
    loadedAt: null,
    inventoryLoadedFor: "",
    inventoryLoadedAt: null
  }),
  actions: {
    // Reloads unless the same product store and week range were loaded in the last few minutes
    // and nothing failed. Refresh, a product store change and a new week range call load().
    async loadIfStale() {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      const failed = Object.values(this.status).some((status) => status === "error");
      const fresh = this.loadedAt && Date.now() - this.loadedAt < FRESH_FOR_MS;
      if(fresh && !failed && this.loadedFor === `${productStoreId}:${this.weekCount}`) {return;}
      await this.load();
    },
    async load(weekCount?: number) {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if(!productStoreId) {return;}
      if(weekCount) {this.weekCount = weekCount;}
      const routingRun = ++runs.routing;
      const inventoryRun = ++runs.inventory;
      this.weeks = lastCompleteWeeks(this.weekCount);
      this.status = { routing: "loading", shipping: "loading", inventory: "loading", reasons: "loading" };
      await this.loadFacilities(productStoreId, inventoryRun);
      if(isStale("routing", routingRun)) {return;}
      await Promise.allSettled([
        this.loadRouting(productStoreId, routingRun),
        this.loadShipping(productStoreId, routingRun),
        this.loadInventory(productStoreId, inventoryRun)
      ]);
      if(isStale("routing", routingRun)) {return;}
      this.loadedFor = `${productStoreId}:${this.weekCount}`;
      this.loadedAt = Date.now();
    },
    // The Safety stock page needs only the inventory sections, not the weekly routing queries.
    async loadSafetyStock(force = false) {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if(!productStoreId) {return;}
      const failed = this.status.inventory === "error" || this.status.reasons === "error";
      const fresh = this.inventoryLoadedAt && Date.now() - this.inventoryLoadedAt < FRESH_FOR_MS;
      if(!force && fresh && !failed && this.inventoryLoadedFor === productStoreId) {return;}
      const run = ++runs.inventory;
      this.status = { ...this.status, inventory: "loading", reasons: "loading" };
      await this.loadFacilities(productStoreId, run);
      if(isStale("inventory", run)) {return;}
      await this.loadInventory(productStoreId, run);
    },
    async loadFacilities(productStoreId: string, run: number) {
      const facilities: Record<string, FacilityInfo> = {};
      try {
        const resp = await api({
          url: `admin/productStores/${productStoreId}/facilities`,
          method: "GET",
          // Physical locations only, the same scope as the other facility lists in the app.
          params: { parentFacilityTypeId: "VIRTUAL_FACILITY", parentFacilityTypeId_not: "Y", facilityTypeId: "VIRTUAL_FACILITY", facilityTypeId_not: "Y", pageSize: 250 }
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
      if(isStale("inventory", run)) {return;}
      this.facilities = facilities;
    },
    async loadRouting(productStoreId: string, run: number) {
      try {
        // Every count is a distinct-order count from the server over routable orders at stores and
        // warehouses, so an order split across rules or locations is never counted twice.
        const perWeek = await inBatches(this.weeks, async (week) => {
          const scope = { ...ROUTABLE_ORDER_FILTER, productStoreId, changeDatetime_from: week.start, changeDatetime_thru: week.end };
          const [rules, all, stores] = await Promise.all([
            queryDocument(DIAGNOSTIC_DOCUMENTS.ruleOrders, ["routingRule", "routingRuleId", "routingGroupId", "orderRoutingId", "orderCount"], scope),
            queryDocument(DIAGNOSTIC_DOCUMENTS.ruleOrders, ["orderCount"], scope),
            queryDocument(DIAGNOSTIC_DOCUMENTS.ruleOrders, ["orderCount"], { ...scope, facilityTypeId: "RETAIL_STORE", facilityTypeId_op: "equals" })
          ]);

          return { rules, all: Number(all[0]?.orderCount) || 0, stores: Number(stores[0]?.orderCount) || 0 };
        });
        // Which location types each rule allocated to, across the whole range.
        const first = this.weeks[0], last = this.weeks[this.weeks.length - 1];
        const typeRows = first ? await queryDocument(
          DIAGNOSTIC_DOCUMENTS.ruleOrders, ["routingRuleId", "facilityTypeId", "orderCount"],
          { ...ROUTABLE_ORDER_FILTER, productStoreId, changeDatetime_from: first.start, changeDatetime_thru: last.end }
        ) : [];
        if(isStale("routing", run)) {return;}
        this.ruleSeries = buildRuleSeries(perWeek.map((week) => week.rules), typeRows);
        this.brokeredOrders = perWeek.map((week) => week.all);
        this.storeOrders = perWeek.map((week) => week.stores);
        this.status.routing = "ready";
      } catch (err) {
        if(isStale("routing", run)) {return;}
        logger.error("routing diagnostics: failed to load orders by rule", err);
        this.ruleSeries = [];
        this.brokeredOrders = [];
        this.storeOrders = [];
        this.status.routing = "error";
      }
    },
    async loadShipping(productStoreId: string, run: number) {
      try {
        const rowsByWeek = await inBatches(this.weeks, (week) => queryDocument(
          DIAGNOSTIC_DOCUMENTS.storeShipped,
          ["facilityId", "shipmentMethodTypeId", "salesChannelEnumId", "shippedUnits"],
          { productStoreId, statusDate_from: week.start, statusDate_thru: week.end }
        ));
        if(isStale("routing", run)) {return;}
        this.storeShipped = buildStoreShipped(rowsByWeek, this.facilities);
        this.status.shipping = "ready";
      } catch (err) {
        if(isStale("routing", run)) {return;}
        logger.error("routing diagnostics: failed to load store-shipped units", err);
        this.storeShipped = { weeklyUnits: [], stores: [] };
        this.status.shipping = "error";
      }
    },
    async loadInventory(productStoreId: string, run: number) {
      const facilityIds = Object.keys(this.facilities);
      try {
        const scope = { facilityId: facilityIds.join(","), facilityId_op: "in" };
        const [available, safetyCapped, safetyShort, thresholdRules] = await Promise.all([
          facilityIds.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.inventoryAvailable, ["facilityId", "allowBrokering", "availableUnits"], scope) : [],
          facilityIds.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.safetyCapped, ["facilityId", "allowBrokering", "heldUnits"], scope) : [],
          facilityIds.length ? queryDocument(DIAGNOSTIC_DOCUMENTS.safetyShort, ["facilityId", "allowBrokering", "heldUnits"], scope) : [],
          fetchActiveRules(productStoreId, "RG_THRESHOLD")
        ]);
        if(isStale("inventory", run)) {return;}
        this.holds = buildFacilityHolds(available, safetyCapped, safetyShort, this.facilities);
        this.threshold = thresholdSummary(thresholdRules);
        this.status.inventory = "ready";
      } catch (err) {
        if(isStale("inventory", run)) {return;}
        logger.error("routing diagnostics: failed to load inventory held back", err);
        this.holds = [];
        this.status.inventory = "error";
        this.status.reasons = "error";

        return;
      }
      await this.loadSafetyReasons(productStoreId, run);
    },
    // Needs the live holds for the store list and the shipping-only units, so it runs after them.
    async loadSafetyReasons(productStoreId: string, run: number) {
      const storeIds = this.holds.filter((hold) => hold.facilityTypeId === "RETAIL_STORE").map((hold) => hold.facilityId);
      if(!storeIds.length) {
        this.safetyByReason = emptyReasons();
        this.status.reasons = "ready";

        return;
      }
      try {
        const rules = (await fetchActiveRules(productStoreId, "RG_SAFETY_STOCK")).map(toSafetyRule);
        const tags = [...new Set(rules.flatMap((rule) => [...rule.includeTags, ...rule.excludeTags]))];
        const groupIds = [...new Set(rules.flatMap((rule) => [...rule.includeFacilityGroupIds, ...rule.excludeFacilityGroupIds]))];
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
        if(isStale("inventory", run)) {return;}
        const tagsByProduct: Record<string, string[]> = {};
        for(const row of tagRows) {(tagsByProduct[row.productId] = tagsByProduct[row.productId] || []).push(row.tag);}
        const storeHolds = this.holds.filter((hold) => storeIds.includes(hold.facilityId));
        this.safetyByReason = buildSafetyByReason(skuRows, tagsByProduct, rules, Object.fromEntries(groupMembers), storeHolds);
        this.status.reasons = "ready";
        this.inventoryLoadedFor = productStoreId;
        this.inventoryLoadedAt = Date.now();
      } catch (err) {
        if(isStale("inventory", run)) {return;}
        logger.error("routing diagnostics: failed to load safety stock by reason", err);
        this.safetyByReason = emptyReasons();
        this.status.reasons = "error";
      }
    }
  }
});
