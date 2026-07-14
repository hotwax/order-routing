import { computed, ref } from "vue";
import { alertController } from "@ionic/vue";
import cronstrue from "cronstrue";
import { commonUtil, translate } from "@common";
import router from "@/router";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";
import { Group } from "@/types";

// Shared logic for the routing groups pages (list + calendar). Each caller gets
// its own reactive state (function-scoped refs) so the two pages don't share a
// single instance. Page-specific concerns (heatmap math, store selector,
// assistant modal, group-actions popover, etc.) stay in the page components.
export function useRoutingGroups() {
  const utilStore = useUtilStore();
  const groups = computed(() => orderRoutingStore().getRoutingGroups);

  let cronExpressions: Record<string, string> = {};
  try {
    cronExpressions = JSON.parse(import.meta.env?.VITE_CRON_EXPRESSIONS || "{}");
  } catch {
    cronExpressions = {};
  }

  const isLoading = ref(false);
  const routingGroups = ref<any[]>([]);
  const selectedFilter = ref("all");

  function isActive(group: any) {
    return group.schedule?.paused === "N";
  }

  // Sort active runs first, then alphabetically by name within each status.
  function sortGroups(list: any[]) {
    return [...list].sort((a: any, b: any) => {
      const aActive = isActive(a);
      const bActive = isActive(b);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (a.groupName || "").localeCompare(b.groupName || "");
    });
  }

  // Status filter ("all" | "active" | "draft") + sorting applied to the list.
  const displayedGroups = computed(() => {
    let list = routingGroups.value;
    if (selectedFilter.value === "active") list = list.filter((group: any) => isActive(group));
    else if (selectedFilter.value === "draft") list = list.filter((group: any) => !isActive(group));
    return sortGroups(list);
  });

  // Human-readable cadence for a schedule object. Prefers a named preset from
  // VITE_CRON_EXPRESSIONS, falling back to cronstrue for arbitrary expressions.
  function getScheduleFrequency(schedule: any) {
    let description: any = Object.keys(cronExpressions).find((key) => cronExpressions[key] === schedule?.cronExpression);
    if (!description && schedule?.cronExpression) {
      description = cronstrue.toString(schedule.cronExpression);
      if (/^[a-z]/.test(description)) description = description.charAt(0).toUpperCase() + description.slice(1);
    }
    return description || "-";
  }

  // Shared fetch + local snapshot. `beforeFetch` lets a page inject page-specific
  // work (e.g. clearing the current group) after the loader shows but before the
  // fetch, preserving each page's original ordering.
  async function refreshRoutingGroups(beforeFetch?: () => Promise<void> | void) {
    isLoading.value = true;
    if (beforeFetch) await beforeFetch();
    await orderRoutingStore().fetchOrderRoutingGroups();
    isLoading.value = false;
    routingGroups.value = JSON.parse(JSON.stringify(groups.value));
    utilStore.fetchEnums({ parentTypeId: "ORDER_ROUTING" });
  }

  async function addRoutingGroup() {
    const newRunAlert = await alertController.create({
      header: translate("New routing group"),
      buttons: [
        { text: translate("Cancel"), role: "cancel" },
        {
          text: translate("Save"),
          handler: (data) => {
            if (!data.runName?.trim().length) {
              commonUtil.showToast(translate("Please enter a valid name"));
              return false;
            }
          }
        }
      ],
      inputs: [{ name: "runName", placeholder: translate("routing group name") }]
    });

    newRunAlert.onDidDismiss().then(async (result: any) => {
      if (result.role) return;
      if (result.data?.values?.runName.trim()) {
        await orderRoutingStore().createRoutingGroup(result.data.values.runName.trim());
        routingGroups.value = JSON.parse(JSON.stringify(groups.value));
      }
    });

    return newRunAlert.present();
  }

  function redirect(group: Group) {
    router.push(`/order-routing/${group.routingGroupId}`);
  }

  return {
    groups,
    isLoading,
    routingGroups,
    selectedFilter,
    isActive,
    sortGroups,
    displayedGroups,
    getScheduleFrequency,
    refreshRoutingGroups,
    addRoutingGroup,
    redirect
  };
}
