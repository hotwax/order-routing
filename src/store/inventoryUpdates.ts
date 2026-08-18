import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useRuleStore } from "@/store/rule";
import {
  ATP_DATA_MANAGER_CONFIG_ID,
  DATA_MANAGER_PAGE_SIZE,
  DATA_MANAGER_STATUSES,
  FAILED_DATA_MANAGER_STATUSES,
  inventoryUpdateName,
  isActiveJobRun,
  isInventoryRuleGroup,
  QUEUED_DATA_MANAGER_STATUSES
} from "@/utils/inventoryUpdates";

export interface InventoryUpdateSchedule {
  ruleGroupId: string;
  groupName: string;
  groupTypeEnumId: string;
  jobName: string;
  paused: string;
  cronExpression: string;
  cronDescription: string;
  nextExecutionDateTime: number | null;
  executionTimeZone: string;
  activeRun: any | null;
}

export interface InventoryUpdateStats {
  activeRuns: number;
  queuedFiles: number;
  processingFiles: number;
  failedFiles: number;
}

const emptyStats = (): InventoryUpdateStats => ({
  activeRuns: 0,
  queuedFiles: 0,
  processingFiles: 0,
  failedFiles: 0
});

const getLogCount = (response: any) => Number(response?.data?.dataManagerLogsCount || 0);

export const useInventoryUpdatesStore = defineStore("inventoryUpdates", {
  state: () => ({
    schedules: [] as InventoryUpdateSchedule[],
    logs: [] as any[],
    logsCount: 0,
    stats: emptyStats(),
    loading: false,
    lastUpdated: null as number | null,
    loadError: ""
  }),
  getters: {
    nextSchedule: (state) => state.schedules
      .filter((schedule) => schedule.paused !== "Y" && schedule.nextExecutionDateTime)
      .sort((a, b) => Number(a.nextExecutionDateTime) - Number(b.nextExecutionDateTime))[0] || null
  },
  actions: {
    async fetchSchedules() {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if (!productStoreId) {
        this.schedules = [];
        return;
      }

      const groupsResponse = await api({
        url: "available-to-promise/ruleGroups",
        method: "GET",
        params: { productStoreId, statusId: "ATP_RG_ACTIVE", pageSize: 100 }
      }) as any;
      if (commonUtil.hasError(groupsResponse)) throw groupsResponse.data;

      const groups = (Array.isArray(groupsResponse.data) ? groupsResponse.data : [])
        .filter(isInventoryRuleGroup);
      let hadDetailError = false;
      const schedules = await Promise.all(groups.map(async (group: any) => {
        const [scheduleResult, runResult] = await Promise.allSettled([
          api({
            url: `available-to-promise/ruleGroups/${group.ruleGroupId}/schedule`,
            method: "GET"
          }),
          group.jobName
            ? useRuleStore().fetchRuleGroupHistory({
                jobName: group.jobName,
                pageSize: 20,
                pageIndex: 0,
                orderByField: "-startTime"
              })
            : Promise.resolve({ data: [] })
        ]);

        const scheduleResponse: any = scheduleResult.status === "fulfilled" ? scheduleResult.value : null;
        const runResponse: any = runResult.status === "fulfilled" ? runResult.value : null;
        const scheduleFailed = !scheduleResponse || commonUtil.hasError(scheduleResponse);
        const runsFailed = !runResponse || commonUtil.hasError(runResponse);
        hadDetailError ||= scheduleFailed || runsFailed;

        const schedule = scheduleFailed ? {} : scheduleResponse.data?.schedule || {};
        const runs = runsFailed || !Array.isArray(runResponse.data) ? [] : runResponse.data;
        return {
          ruleGroupId: group.ruleGroupId,
          groupName: inventoryUpdateName(group),
          groupTypeEnumId: group.groupTypeEnumId,
          jobName: group.jobName || "",
          paused: schedule.paused || "Y",
          cronExpression: schedule.cronExpression || "",
          cronDescription: schedule.cronExpression ? commonUtil.getCronString(schedule.cronExpression) : "",
          nextExecutionDateTime: schedule.nextExecutionDateTime || null,
          executionTimeZone: schedule.executionTimeZone || "",
          activeRun: runs.find(isActiveJobRun) || null
        } as InventoryUpdateSchedule;
      }));

      // The product store can change while these requests are in flight. Dropping a response that
      // no longer belongs to the selected store keeps Manage controls from binding to rule groups
      // the user is no longer looking at.
      if (useAtpProductStore().currentProductStore?.productStoreId !== productStoreId) return;

      this.schedules = schedules.sort((a, b) => a.groupName.localeCompare(b.groupName));
      this.stats.activeRuns = this.schedules.filter((schedule) => schedule.activeRun).length;
      if (hadDetailError) throw new Error("Some inventory update monitoring data could not be loaded.");
    },
    async fetchSchedule(ruleGroupId: string) {
      const response = await api({
        url: `available-to-promise/ruleGroups/${ruleGroupId}/schedule`,
        method: "GET"
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;
      return response.data?.schedule || {};
    },
    // Rule-group mutations and run history are owned by the rule store, which the rule pages
    // already drive through ScheduleRuleItem/ScheduleActionsPopover. These wrappers only add the
    // hasError-to-throw handling this page's callers expect.
    async fetchJobRuns(jobName: string, pageSize = 5) {
      if (!jobName) return [];
      const response = await useRuleStore().fetchRuleGroupHistory({
        jobName,
        pageSize,
        pageIndex: 0,
        orderByField: "-startTime"
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;
      return Array.isArray(response.data) ? response.data : [];
    },
    async updateSchedule(payload: { ruleGroupId: string; paused: string; cronExpression?: string }) {
      const response = await useRuleStore().scheduleRuleGroup(payload) as any;
      if (commonUtil.hasError(response)) throw response.data;
      return response.data?.schedule || response.data || {};
    },
    async runNow(ruleGroupId: string) {
      const response = await useRuleStore().runNow(ruleGroupId) as any;
      if (commonUtil.hasError(response)) throw response.data;
      return response.data;
    },
    async fetchLogs(pageIndex = 0, statuses: string[] = DATA_MANAGER_STATUSES) {
      const response = await api({
        url: "admin/dataManager/details",
        method: "GET",
        params: {
          configId: ATP_DATA_MANAGER_CONFIG_ID,
          statusId: statuses.join(","),
          statusId_op: "in",
          orderByField: "createdDate DESC",
          pageSize: DATA_MANAGER_PAGE_SIZE,
          pageIndex
        }
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;

      this.logs = response.data?.dataManagerLogs || [];
      this.logsCount = getLogCount(response);
    },
    async fetchStats() {
      const count = (statuses: string[]) => api({
        url: "admin/dataManager/details",
        method: "GET",
        params: {
          configId: ATP_DATA_MANAGER_CONFIG_ID,
          statusId: statuses.join(","),
          statusId_op: "in",
          pageSize: 1,
          pageIndex: 0
        }
      });

      const [queued, processing, failed] = await Promise.all([
        count(QUEUED_DATA_MANAGER_STATUSES),
        count(["DmlsRunning"]),
        count(FAILED_DATA_MANAGER_STATUSES)
      ]);
      if ([queued, processing, failed].some((response) => commonUtil.hasError(response))) {
        throw new Error("Some inventory update monitoring data could not be loaded.");
      }
      this.stats = {
        ...this.stats,
        queuedFiles: getLogCount(queued),
        processingFiles: getLogCount(processing),
        failedFiles: getLogCount(failed)
      };
    },
    async load(pageIndex = 0, statuses: string[] = DATA_MANAGER_STATUSES) {
      this.loading = true;
      this.loadError = "";
      try {
        const results = await Promise.allSettled([
          this.fetchSchedules(),
          this.fetchLogs(pageIndex, statuses),
          this.fetchStats()
        ]);
        if (results.every((result) => result.status === "rejected")) {
          throw new Error("Inventory update monitoring could not be loaded.");
        }
        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length) {
          this.loadError = "Some inventory update monitoring data could not be loaded.";
          failures.forEach((failure) => logger.error("inventory updates: monitoring source failed", failure.reason));
        }
        this.lastUpdated = Date.now();
      } catch (error) {
        this.loadError = "Inventory update monitoring could not be loaded.";
        logger.error("inventory updates: failed to load monitoring", error);
      } finally {
        this.loading = false;
      }
    }
  }
});
