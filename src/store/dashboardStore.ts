import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
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

function isTruthyFlag(v: any) {
  return v === true || v === "Y" || v === "y";
}

export interface DashboardState {
  loading: boolean;
  loadedAt: number | null;
  sourcing: { key: string; label: string; route: string; metric: string; count: number; total: number; blocking: number }[];
  brokering: { total: number; scheduled: number; paused: number; draft: number; nextRun: number | null; errorCount: number };
  foundations: { facilityGroups: number; facilityGroupsByType: Record<string, number>; channels: number };
  jobs: { total: number; running: number };
}

export const useDashboardStore = defineStore("dashboard", {
  state: (): DashboardState => ({
    loading: false,
    loadedAt: null,
    sourcing: [],
    brokering: { total: 0, scheduled: 0, paused: 0, draft: 0, nextRun: null, errorCount: 0 },
    foundations: { facilityGroups: 0, facilityGroupsByType: {}, channels: 0 },
    jobs: { total: 0, running: 0 }
  }),
  getters: {
    getSourcing: (s) => s.sourcing,
    getBrokering: (s) => s.brokering,
    getFoundations: (s) => s.foundations,
    getJobs: (s) => s.jobs,
    isLoading: (s) => s.loading,
    totalSourcingRules: (s) => s.sourcing.reduce((n, x) => n + x.count, 0)
  },
  actions: {
    // Loads every tile in parallel; each section is independent and error-tolerant
    // so one failing endpoint never blanks the whole dashboard.
    async loadDashboard() {
      this.loading = true;
      await Promise.allSettled([this.loadSourcing(), this.loadBrokering(), this.loadFoundations(), this.loadJobs()]);
      this.loadedAt = Date.now();
      this.loading = false;
    },
    async loadSourcing() {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      const result = SOURCING.map((s) => ({ key: s.key, label: s.label, route: s.route, metric: s.metric, count: 0, total: 0, blocking: 0 }));
      if (!productStoreId) {
        this.sourcing = result;
        return;
      }
      try {
        const resp = (await api({
          url: "available-to-promise/ruleGroups",
          method: "GET",
          params: { productStoreId, statusId: "ATP_RG_ACTIVE", pageSize: 100 }
        })) as any;
        const groups = commonUtil.hasError(resp) ? [] : resp.data || [];
        // One call per active rule group (N calls, accepted for Phase 1). The list
        // returns each rule's ruleActions, so we also aggregate configured amounts
        // (threshold/safety stock units) and count pickup/shipping disallow rules.
        const responses = await Promise.allSettled(
          groups.map((g: any) =>
            api({
              url: "available-to-promise/decisionRules",
              method: "GET",
              params: { ruleGroupId: g.ruleGroupId, statusId: "ATP_RULE_ACTIVE", pageSize: 200 }
            })
          )
        );
        groups.forEach((g: any, i: number) => {
          const r: any = responses[i];
          const rules = r.status === "fulfilled" && !commonUtil.hasError(r.value) ? r.value.data || [] : [];
          const def = SOURCING.find((s) => s.groupTypes.includes(g.groupTypeEnumId));
          const cat = def && result.find((c) => c.key === def.key);
          if (!def || !cat) return;
          cat.count += rules.length;
          for (const rule of rules) {
            const actions = rule.ruleActions || [];
            const fieldValue = (type: string) => actions.find((a: any) => a.actionTypeEnumId === type)?.fieldValue;
            if (def.metric === "threshold") {
              const v = Number(fieldValue("ATP_THRESHOLD"));
              if (!isNaN(v)) cat.total += v;
            } else if (def.metric === "safetyStock") {
              const v = Number(fieldValue("ATP_SAFETY_STOCK"));
              if (!isNaN(v)) cat.total += v;
            } else if (def.metric === "pickup") {
              if (fieldValue("ATP_ALLOW_PICKUP") === "N") cat.blocking += 1;
            } else if (def.metric === "shipping") {
              if (fieldValue("ATP_ALLOW_BROKERING") === "N") cat.blocking += 1;
            }
          }
        });
      } catch (err) {
        logger.error("dashboard: failed to load sourcing rules", err);
      }
      this.sourcing = result;
    },
    async loadBrokering() {
      const store = orderRoutingStore();
      const brokering = { total: 0, scheduled: 0, paused: 0, draft: 0, nextRun: null as number | null, errorCount: 0 };
      try {
        await store.fetchOrderRoutingGroups();
        const groups = store.getRoutingGroups || [];
        brokering.total = groups.length;
        const now = Date.now();
        for (const g of groups) {
          const sched = (g as any).schedule;
          if (!sched) brokering.draft++;
          else if (isTruthyFlag(sched.paused)) brokering.paused++;
          else {
            brokering.scheduled++;
            const t = Number((g as any).runTime || sched.nextExecutionDateTime);
            if (t && t > now && (brokering.nextRun === null || t < brokering.nextRun)) brokering.nextRun = t;
          }
        }
        // Last-run status per group (N calls) — best effort.
        const runs = await Promise.allSettled(
          groups.map((g: any) =>
            api({
              url: `order-routing/groups/${g.routingGroupId}/routingRuns`,
              method: "GET",
              params: { orderByField: "startDate DESC", pageSize: 1 }
            })
          )
        );
        runs.forEach((r: any) => {
          if (r.status === "fulfilled" && !commonUtil.hasError(r.value)) {
            const last = (r.value.data || [])[0];
            if (last && isTruthyFlag(last.hasError)) brokering.errorCount++;
          }
        });
      } catch (err) {
        logger.error("dashboard: failed to load brokering runs", err);
      }
      this.brokering = brokering;
    },
    async loadFoundations() {
      const foundations = { facilityGroups: 0, facilityGroupsByType: {} as Record<string, number>, channels: 0 };
      try {
        const fg = useFacilityGroupStore();
        await fg.fetchGroups();
        const groups = fg.getGroups || [];
        foundations.facilityGroups = groups.length;
        for (const g of groups) {
          const t = g.facilityGroupTypeId || "OTHER";
          foundations.facilityGroupsByType[t] = (foundations.facilityGroupsByType[t] || 0) + 1;
        }
      } catch (err) {
        logger.error("dashboard: failed to load facility groups", err);
      }
      try {
        const ch = useChannelStore();
        await ch.fetchInventoryChannels();
        foundations.channels = (ch.getInventoryChannels || []).length;
      } catch (err) {
        logger.error("dashboard: failed to load channels", err);
      }
      this.foundations = foundations;
    },
    async loadJobs() {
      const jobs = { total: 0, running: 0 };
      try {
        const ch = useChannelStore();
        await ch.fetchJobs();
        const list = ch.getJobs || [];
        jobs.total = list.length;
        jobs.running = list.filter((j: any) => j.statusId === "SERVICE_PENDING").length;
      } catch (err) {
        logger.error("dashboard: failed to load publish jobs", err);
      }
      this.jobs = jobs;
    }
  }
});
