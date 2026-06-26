import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
import { DateTime } from "luxon";
import { useAtpProductStore } from "@/store/atpProductStore";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useFacilityGroupStore } from "@/store/facilityGroupStore";
import { useChannelStore } from "@/store/channel";

// The four sourcing areas, the ATP rule-group types that roll up into each, and
// which configuration aggregate is meaningful for that area:
//  - threshold / safetyStock -> sum the configured amount (units)
//  - pickup / shipping        -> count rules that DISALLOW the channel (blocking)
const SOURCING = [
  { key: "threshold", label: "Threshold", route: "/threshold", groupTypes: ["RG_THRESHOLD"], metric: "threshold" },
  { key: "safetyStock", label: "Safety stock", route: "/safety-stock", groupTypes: ["RG_SAFETY_STOCK"], metric: "safetyStock" },
  { key: "storePickup", label: "Store pickup", route: "/store-pickup", groupTypes: ["RG_PICKUP_FACILITY", "RG_PICKUP_CHANNEL"], metric: "pickup" },
  { key: "shipping", label: "Shipping", route: "/shipping", groupTypes: ["RG_SHIPPING_FACILITY", "RG_SHIPPING_CHANNEL"], metric: "shipping" }
];

const BROKERING_GROUP_TYPE = "BROKERING_GROUP";

function isTruthyFlag(value: any) {
  return value === true || value === "Y" || value === "y";
}

// Helper function to process requests in concurrent batches to avoid network congestion
async function fetchInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 5
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export interface BrokeringRun {
  routingRunId: string;
  routingGroupId: string;
  orderRoutingId: string;
  routingBatchId: string;
  startDate: number;
  endDate: number;
  orderItemCount: number;
  brokeredItemCount: number;
  hasError: string;
  routingResult: string;
}

export interface BrokeringState {
  total: number;
  scheduled: number;
  paused: number;
  draft: number;
  nextRun: number | null;
  errorCount: number;
  runs: BrokeringRun[];
  queueDepth: number;
  totalAttempted: number;
  totalBrokered: number;
  lastRun: BrokeringRun | null;
}

export interface FacilityOrder {
  facilityId: string;
  facilityName: string;
  orderCount: number;
  maximumOrderLimit: number | null;
  utilization: number;
}

export interface DashboardState {
  loading: boolean;
  loadedAt: number | null;
  sourcing: { key: string; label: string; route: string; metric: string; count: number; total: number; blocking: number }[];
  brokering: BrokeringState;
  facilityOrders: FacilityOrder[];
  facilityOrdersDate: string | null;
  facilityOrdersIsToday: boolean;
  foundations: { facilityGroups: number; facilityGroupsByType: Record<string, number>; channels: number };
  jobs: { total: number; running: number };
}

export const useDashboardStore = defineStore("dashboard", {
  state: (): DashboardState => ({
    loading: false,
    loadedAt: null,
    sourcing: [],
    brokering: { total: 0, scheduled: 0, paused: 0, draft: 0, nextRun: null, errorCount: 0, runs: [], queueDepth: 0, totalAttempted: 0, totalBrokered: 0, lastRun: null },
    facilityOrders: [],
    facilityOrdersDate: null,
    facilityOrdersIsToday: false,
    foundations: { facilityGroups: 0, facilityGroupsByType: {}, channels: 0 },
    jobs: { total: 0, running: 0 }
  }),
  getters: {
    getSourcing: (state) => state.sourcing,
    getBrokering: (state) => state.brokering,
    getFacilityOrders: (state) => state.facilityOrders,
    getFacilityOrdersDate: (state) => state.facilityOrdersDate,
    getFacilityOrdersIsToday: (state) => state.facilityOrdersIsToday,
    getFoundations: (state) => state.foundations,
    getJobs: (state) => state.jobs,
    isLoading: (state) => state.loading,
    totalSourcingRules: (state) => state.sourcing.reduce((total, sourcing) => total + sourcing.count, 0)
  },
  actions: {
    // Loads every tile in parallel; each section is independent and error-tolerant
    // so one failing endpoint never blanks the whole dashboard.
    async loadDashboard() {
      this.loading = true;
      await Promise.allSettled([this.loadSourcing(), this.loadBrokering(), this.loadFacilityOrders(), this.loadFoundations(), this.loadJobs()]);
      this.loadedAt = Date.now();
      this.loading = false;
    },
    async loadSourcing() {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      const result = SOURCING.map((source) => ({ key: source.key, label: source.label, route: source.route, metric: source.metric, count: 0, total: 0, blocking: 0 }));
      if (!productStoreId) {
        this.sourcing = result;
        return;
      }
      try {
        const response = (await api({
          url: "available-to-promise/ruleGroups",
          method: "GET",
          params: { productStoreId, statusId: "ATP_RG_ACTIVE", pageSize: 100 }
        })) as any;
        const ruleGroups = commonUtil.hasError(response) ? [] : response.data || [];
        // Concurrency-limited calls per active rule group (N calls, accepted for Phase 1).
        // The list returns each rule's ruleActions, so we also aggregate configured amounts
        // (threshold/safety stock units) and count pickup/shipping disallow rules.
        const ruleResponses = await fetchInBatches(
          ruleGroups,
          (ruleGroup: any) =>
            api({
              url: "available-to-promise/decisionRules",
              method: "GET",
              params: { ruleGroupId: ruleGroup.ruleGroupId, statusId: "ATP_RULE_ACTIVE", pageSize: 200 }
            })
        );
        ruleGroups.forEach((ruleGroup: any, index: number) => {
          const ruleResponse: any = ruleResponses[index];
          const rules = ruleResponse.status === "fulfilled" && !commonUtil.hasError(ruleResponse.value) ? ruleResponse.value.data || [] : [];
          const sourcingConfig = SOURCING.find((source) => source.groupTypes.includes(ruleGroup.groupTypeEnumId));
          const sourcingCategory = sourcingConfig && result.find((category) => category.key === sourcingConfig.key);
          if (!sourcingConfig || !sourcingCategory) return;
          sourcingCategory.count += rules.length;
          for (const rule of rules) {
            const actions = rule.ruleActions || [];
            const fieldValue = (type: string) => actions.find((action: any) => action.actionTypeEnumId === type)?.fieldValue;
            if (sourcingConfig.metric === "threshold") {
              const value = Number(fieldValue("ATP_THRESHOLD"));
              if (!isNaN(value)) sourcingCategory.total += value;
            } else if (sourcingConfig.metric === "safetyStock") {
              const value = Number(fieldValue("ATP_SAFETY_STOCK"));
              if (!isNaN(value)) sourcingCategory.total += value;
            } else if (sourcingConfig.metric === "pickup") {
              if (fieldValue("ATP_ALLOW_PICKUP") === "N") sourcingCategory.blocking += 1;
            } else if (sourcingConfig.metric === "shipping") {
              if (fieldValue("ATP_ALLOW_BROKERING") === "N") sourcingCategory.blocking += 1;
            }
          }
        });
      } catch (err) {
        logger.error("dashboard: failed to load sourcing rules", err);
      }
      this.sourcing = result;
    },
    async loadBrokering() {
      const routingStore = orderRoutingStore();
      const brokering: BrokeringState = { total: 0, scheduled: 0, paused: 0, draft: 0, nextRun: null, errorCount: 0, runs: [], queueDepth: 0, totalAttempted: 0, totalBrokered: 0, lastRun: null };
      try {
        await routingStore.fetchOrderRoutingGroups();
        const routingGroups = routingStore.getRoutingGroups || [];
        brokering.total = routingGroups.length;
        const now = Date.now();
        for (const routingGroup of routingGroups) {
          const schedule = (routingGroup as any).schedule;
          if (!schedule) {
            brokering.draft++;
          } else if (isTruthyFlag(schedule.paused)) {
            brokering.paused++;
          } else {
            brokering.scheduled++;
            const runTime = Number((routingGroup as any).runTime || schedule.nextExecutionDateTime);
            if (runTime && runTime > now && (brokering.nextRun === null || runTime < brokering.nextRun)) {
              brokering.nextRun = runTime;
            }
          }
        }
        // Fetch recent runs per group (pageSize 50) for performance metrics.
        const allRuns: BrokeringRun[] = [];
        const runResponses = await fetchInBatches(
          routingGroups,
          (routingGroup: any) =>
            api({
              url: `order-routing/groups/${routingGroup.routingGroupId}/routingRuns`,
              method: "GET",
              params: { orderByField: "startDate DESC", pageSize: 50 }
            })
        );
        runResponses.forEach((runResponse: any) => {
          if (runResponse.status === "fulfilled" && !commonUtil.hasError(runResponse.value)) {
            const runs = runResponse.value.data || [];
            for (const run of runs) {
              allRuns.push(run);
              if (isTruthyFlag(run.hasError)) brokering.errorCount++;
            }
          }
        });
        allRuns.sort((a, b) => b.startDate - a.startDate);
        brokering.runs = allRuns;
        brokering.lastRun = allRuns.find(r => r.orderItemCount > 0) || allRuns[0] || null;
        brokering.totalAttempted = allRuns.reduce((sum, r) => sum + (r.orderItemCount || 0), 0);
        brokering.totalBrokered = allRuns.reduce((sum, r) => sum + (r.brokeredItemCount || 0), 0);

        // Fetch live queue depth per routing.
        // Collect unique routing IDs from the runs we already fetched.
        const routingIds = [...new Set(allRuns.map(r => r.orderRoutingId).filter(Boolean))];
        if (routingIds.length) {
          const queueResponses = await fetchInBatches(
            routingIds,
            (orderRoutingId: string) =>
              api({
                url: `order-routing/routings/${orderRoutingId}/orderCount`,
                method: "GET"
              })
          );
          queueResponses.forEach((qr: any) => {
            if (qr.status === "fulfilled" && !commonUtil.hasError(qr.value)) {
              brokering.queueDepth += Number(qr.value.data?.orderItemCount || 0);
            }
          });
        }
      } catch (err) {
        logger.error("dashboard: failed to load brokering runs", err);
      }
      this.brokering = brokering;
    },
    async loadFacilityOrders() {
      let facilityOrders: FacilityOrder[] = [];
      let facilityOrdersDate: string | null = null;
      let facilityOrdersIsToday = false;
      try {
        const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
        if (!productStoreId) {
          this.facilityOrders = [];
          this.facilityOrdersDate = null;
          this.facilityOrdersIsToday = false;
          return;
        }
        const resp = await api({
          url: `admin/productStores/${productStoreId}/facilities`,
          method: "GET",
          params: {
            productStoreId,
            parentFacilityTypeId: "VIRTUAL_FACILITY",
            parentFacilityTypeId_not: "Y",
            facilityTypeId: "VIRTUAL_FACILITY",
            facilityTypeId_not: "Y",
            pageSize: 250
          }
        }) as any;
        if (commonUtil.hasError(resp) || !resp.data?.length) {
          this.facilityOrders = [];
          this.facilityOrdersDate = null;
          this.facilityOrdersIsToday = false;
          return;
        }
        const facilities = resp.data;
        const facilityMap: Record<string, any> = {};
        for (const f of facilities) facilityMap[f.facilityId] = f;
        const facilityIds = Object.keys(facilityMap);

        const today = DateTime.now().toFormat("yyyy-MM-dd");
        let countMap: Record<string, number> = {};

        const todayResp = await api({
          url: "admin/facilities/orderCount",
          method: "GET",
          params: { facilityId: facilityIds.join(","), facilityId_op: "in", entryDate: today }
        }) as any;
        if (!commonUtil.hasError(todayResp) && todayResp.data?.length) {
          for (const entry of todayResp.data) {
            const count = Number(entry.lastOrderCount) || 0;
            if (count > 0) countMap[entry.facilityId] = count;
          }
        }

        if (Object.keys(countMap).length > 0) {
          facilityOrdersDate = today;
          facilityOrdersIsToday = true;
        } else {
          const fallbackResp = await api({
            url: "admin/facilities/orderCount",
            method: "GET",
            params: { facilityId: facilityIds.join(","), facilityId_op: "in", orderByField: "-entryDate", pageSize: 1 }
          }) as any;
          if (!commonUtil.hasError(fallbackResp) && fallbackResp.data?.length) {
            const latestEntry = fallbackResp.data[0];
            const latestDate = DateTime.fromMillis(Number(latestEntry.entryDate)).toFormat("yyyy-MM-dd");
            facilityOrdersDate = latestDate;
            const dateResp = await api({
              url: "admin/facilities/orderCount",
              method: "GET",
              params: { facilityId: facilityIds.join(","), facilityId_op: "in", entryDate: latestDate }
            }) as any;
            if (!commonUtil.hasError(dateResp) && dateResp.data?.length) {
              for (const entry of dateResp.data) {
                const count = Number(entry.lastOrderCount) || 0;
                if (count > 0) countMap[entry.facilityId] = count;
              }
            }
          }
        }

        for (const facilityId of facilityIds) {
          const facility = facilityMap[facilityId];
          const orderCount = countMap[facilityId] || 0;
          const limit = facility.maximumOrderLimit != null ? Number(facility.maximumOrderLimit) : null;
          const utilization = limit && limit > 0 ? Math.round((orderCount / limit) * 100) : 0;
          facilityOrders.push({
            facilityId,
            facilityName: facility.facilityName || facilityId,
            orderCount,
            maximumOrderLimit: limit,
            utilization
          });
        }
        facilityOrders.sort((a, b) => b.orderCount - a.orderCount);
        facilityOrders.splice(10);
      } catch (err) {
        logger.error("dashboard: failed to load facility orders", err);
      }
      this.facilityOrders = facilityOrders;
      this.facilityOrdersDate = facilityOrdersDate;
      this.facilityOrdersIsToday = facilityOrdersIsToday;
    },
    async loadFoundations() {
      const foundations = { facilityGroups: 0, facilityGroupsByType: {} as Record<string, number>, channels: 0 };
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if (!productStoreId) {
        this.foundations = foundations;
        return;
      }
      try {
        const facilityGroupStore = useFacilityGroupStore();
        await facilityGroupStore.fetchGroups({ productStoreId, facilityGroupTypeId: BROKERING_GROUP_TYPE });
        const facilityGroups = facilityGroupStore.getGroups || [];
        foundations.facilityGroups = facilityGroups.length;
        for (const facilityGroup of facilityGroups) {
          const facilityGroupTypeId = facilityGroup.facilityGroupTypeId || "OTHER";
          foundations.facilityGroupsByType[facilityGroupTypeId] = (foundations.facilityGroupsByType[facilityGroupTypeId] || 0) + 1;
        }
      } catch (err) {
        logger.error("dashboard: failed to load facility groups", err);
      }
      try {
        const channelStore = useChannelStore();
        await channelStore.fetchInventoryChannels();
        foundations.channels = (channelStore.getInventoryChannels || []).length;
      } catch (err) {
        logger.error("dashboard: failed to load channels", err);
      }
      this.foundations = foundations;
    },
    async loadJobs() {
      const jobs = { total: 0, running: 0 };
      try {
        const channelStore = useChannelStore();
        await channelStore.fetchJobs();
        const jobsList = channelStore.getJobs || [];
        jobs.total = jobsList.length;
        jobs.running = jobsList.filter((job: any) => job.statusId === "SERVICE_PENDING").length;
      } catch (err) {
        logger.error("dashboard: failed to load publish jobs", err);
      }
      this.jobs = jobs;
    }
  }
});
