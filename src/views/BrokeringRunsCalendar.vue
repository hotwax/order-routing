<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Brokering runs calendar") }}</ion-title>
        <ion-segment v-if="brokeringGroups.length" slot="end" v-model="selectedFilter" class="cal-filter">
          <ion-segment-button value="all">
            <ion-label>{{ translate("All") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="active">
            <ion-label>{{ translate("Active") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="draft">
            <ion-label>{{ translate("Draft") }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="isLoading" class="cal-loader">
        <ion-spinner name="crescent" />
      </div>

      <div v-else-if="!brokeringGroups.length" class="cal-empty">
        <EmptyState
          :image="brokeringRunsEmptyImage"
          :title="translate('No routing runs yet')"
          :message="translate('Create your first brokering run to define how orders are routed across facilities and inventory rules.')"
        >
          <template #actions>
            <ion-button @click="addNewRun">
              {{ translate("Create brokering run") }}
              <ion-icon slot="end" :icon="addOutline" />
            </ion-button>
          </template>
        </EmptyState>
      </div>

      <div v-else class="cal-layout">
        <!-- Coverage heatmap -->
        <ion-card class="cal-card">
          <ion-card-header class="cal-card-head">
            <ion-card-title>{{ translate("Coverage by day and hour") }}</ion-card-title>
            <div class="cal-legend" aria-hidden="true">
              <span>{{ translate("Fewer") }}</span>
              <span class="cal-swatches">
                <i class="lv0" /><i class="lv1" /><i class="lv2" /><i class="lv3" /><i class="lv4" /><i class="lv5" />
              </span>
              <span>{{ translate("More") }}</span>
            </div>
          </ion-card-header>

          <div class="cal-hmwrap">
            <div class="cal-hmscroll">
              <!-- hour axis -->
              <div class="cal-axis" aria-hidden="true">
                <span class="cal-gutter"></span>
                <span
                  v-for="h in 24"
                  :key="`ax-${h - 1}`"
                  class="cal-axcell"
                  :class="{ 'cal-axnow': (h - 1) === nowHour }"
                >
                  <span v-if="(h - 1) % 3 === 0 || (h - 1) === 23">{{ axisLabel(h - 1) }}</span>
                </span>
              </div>
              <!-- day rows -->
              <div class="cal-daygrid" role="grid" :aria-label="translate('Runs scheduled per day and hour')">
                <div
                  v-for="(day, di) in days"
                  :key="day"
                  class="cal-dayrow"
                  :class="{ 'cal-today': (di + 1) === nowWeekday }"
                  role="row"
                >
                  <span class="cal-daylbl">
                    <span class="dow">{{ translate(day.substring(0, 3)) }}</span>
                    <span class="dt">{{ weekDates[di] }}</span>
                  </span>
                  <button
                    v-for="h in 24"
                    :key="`${day}-${h - 1}`"
                    type="button"
                    role="gridcell"
                    class="cal-cell"
                    :class="[
                      `lv${cellLevel(di + 1, h - 1)}`,
                      {
                        'cal-now': (di + 1) === nowWeekday && (h - 1) === nowHour,
                        'cal-sel': selectedCell && selectedCell.d === (di + 1) && selectedCell.h === (h - 1)
                      }
                    ]"
                    :aria-label="cellAria(di + 1, h - 1)"
                    :title="cellAria(di + 1, h - 1)"
                    @click="selectCell(di + 1, h - 1)"
                  ></button>
                </div>
              </div>
            </div>
          </div>

          <div class="cal-stats">
            <ion-item class="cal-stat" lines="none">
              <ion-label class="ion-text-wrap">
                <ion-note>{{ translate("Busiest hour") }}</ion-note>
                <span class="cal-stat-v">{{ busiest.count ? `${busiest.count} ${busiest.count === 1 ? translate('run') : translate('runs')} at ${axisLabelLong(busiest.hour)}` : "—" }}</span>
              </ion-label>
            </ion-item>
            <ion-item class="cal-stat" lines="none">
              <ion-label class="ion-text-wrap">
                <ion-note>{{ translate("Coverage gaps") }}</ion-note>
                <span class="cal-stat-v">{{ gapHours === 0 ? translate("None") : `${gapHours} ${gapHours === 1 ? translate('hour') : translate('hours')}` }}</span>
              </ion-label>
            </ion-item>
            <ion-item class="cal-stat" lines="none">
              <ion-label class="ion-text-wrap">
                <ion-note>{{ translate("Active") }}</ion-note>
                <span class="cal-stat-v">{{ activeCount }} / {{ brokeringGroups.length }}</span>
              </ion-label>
            </ion-item>
          </div>

          <!-- drill panel -->
          <div aria-live="polite">
            <ion-list lines="full">
              <ion-item-divider color="light">
                <ion-label>{{ selectedCell ? slotTitle : translate("Schedule detail") }}</ion-label>
                <ion-note v-if="selectedCell" slot="end">
                  {{ selectedRuns.length }} {{ selectedRuns.length === 1 ? translate("run") : translate("runs") }}
                </ion-note>
              </ion-item-divider>
              <ion-item
                v-for="run in selectedRuns"
                :key="run.routingGroupId"
                button
                :detail="true"
                @click="redirect(run)"
              >
                <ion-label>{{ run.groupName }}</ion-label>
                <ion-badge slot="end" :color="isActive(run) ? 'primary' : 'medium'">
                  {{ isActive(run) ? translate("Active") : translate("Draft") }}
                </ion-badge>
              </ion-item>
              <ion-item v-if="!selectedRuns.length" lines="none">
                <ion-label color="medium">
                  {{ selectedCell ? translate("No runs scheduled in this hour.") : translate("Select a cell to see which runs fire then.") }}
                </ion-label>
              </ion-item>
            </ion-list>
          </div>
        </ion-card>

        <!-- Runs list -->
        <ion-card class="cal-card">
          <ion-card-header class="cal-card-head">
            <ion-card-title>{{ filteredRuns.length }} {{ translate("Runs") }}</ion-card-title>
            <ion-button fill="clear" size="small" class="cal-add-run" @click="addNewRun">
              <ion-icon slot="start" :icon="addOutline" />
              {{ translate("New Run") }}
            </ion-button>
          </ion-card-header>
          <ion-searchbar
            v-if="displayedGroups.length"
            v-model="searchQuery"
            :placeholder="translate('Search runs')"
            :debounce="150"
          />
          <ion-list v-if="filteredRuns.length" lines="full" class="cal-cadence">
            <ion-item v-for="run in filteredRuns" :key="run.routingGroupId" button :detail="true" @click="redirect(run)">
              <ion-label>
                {{ run.groupName }}
                <p>{{ cadenceLabel(run) }}</p>
              </ion-label>
              <ion-badge v-if="isActive(run)" slot="end" color="dark">{{ nextRunLabel(run) }}</ion-badge>
              <ion-badge v-else slot="end" color="medium">{{ translate("Draft") }}</ion-badge>
            </ion-item>
          </ion-list>
          <ion-list v-else lines="none">
            <ion-item lines="none">
              <ion-label color="medium">
                {{ searchQuery.trim() ? translate("No runs match your search.") : translate("No {filter} runs.", { filter: selectedFilter }) }}
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  alertController,
  onIonViewWillEnter,
  onIonViewWillLeave
} from "@ionic/vue";
import { addOutline } from "ionicons/icons";
import { computed, ref, watch } from "vue";
import { DateTime } from "luxon";
import cronstrue from "cronstrue";
import router from "@/router";
import EmptyState from "@/components/EmptyState.vue";
import { commonUtil, emitter, translate } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";
import { useUserStore } from "@/store/userStore";
import { Group } from "@/types";

const utilStore = useUtilStore();
const userStore = useUserStore();
const groups = computed(() => orderRoutingStore().getRoutingGroups);
const timeZone = computed(() => userStore.getUserProfile?.timeZone);

let cronExpressions: Record<string, string> = {};
try {
  cronExpressions = JSON.parse(import.meta.env?.VITE_CRON_EXPRESSIONS || "{}");
} catch {
  cronExpressions = {};
}
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const brokeringRunsEmptyImage = new URL("../assets/images/BrokeringRunsEmptyState.png", import.meta.url).href;

const isLoading = ref(false);
const brokeringGroups = ref<any[]>([]);
const selectedFilter = ref("all");
const selectedCell = ref<{ d: number; h: number } | null>(null);

// "Now" / week dates are refreshed on every view enter (the page is kept alive
// across navigations, so a once-at-setup snapshot would go stale past midnight).
function getNow() {
  return timeZone.value ? DateTime.now().setZone(timeZone.value) : DateTime.now();
}

const nowWeekday = ref(getNow().weekday); // 1 = Monday … 7 = Sunday
const nowHour = ref(getNow().hour);
const weekDates = ref<number[]>([]);
function refreshNow() {
  const n = getNow();
  nowWeekday.value = n.weekday;
  nowHour.value = n.hour;
  const sow = n.startOf("week");
  weekDates.value = days.map((_, i) => sow.plus({ days: i }).day);
}
refreshNow();
watch(timeZone, refreshNow);

function isActive(group: any) {
  return group.schedule?.paused === "N";
}

// Active runs first, then alphabetical — matches the runs list sort.
function sortGroups(list: any[]) {
  return [...list].sort((a: any, b: any) => {
    const aActive = isActive(a);
    const bActive = isActive(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return (a.groupName || "").localeCompare(b.groupName || "");
  });
}

const displayedGroups = computed(() => {
  let list = brokeringGroups.value;
  if (selectedFilter.value === "active") list = list.filter(isActive);
  else if (selectedFilter.value === "draft") list = list.filter((g: any) => !isActive(g));
  return sortGroups(list);
});

// Runs list narrowed by the local keyword search. Kept separate from
// displayedGroups so the search only filters the list, not the heatmap/stats.
const searchQuery = ref("");
const filteredRuns = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return displayedGroups.value;
  return displayedGroups.value.filter((g: any) => (g.groupName || "").toLowerCase().includes(q));
});

const activeCount = computed(() => brokeringGroups.value.filter(isActive).length);

// Quartz day-of-week numbering (1=SUN..7=SAT) and name aliases.
const DOW_NAMES: Record<string, number> = { SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7 };

// Expand one cron field ("*", "?", "6-22", "0,12", "*/2", "6-22/3") into a set
// of ints within [min,max]. Returns null when it can't be parsed, so the caller
// can fall back to "fires anytime" rather than silently hiding a run.
function expandCronField(field: string | undefined, min: number, max: number): Set<number> | null {
  if (field == null) return null;
  field = String(field).trim();
  if (field === "*" || field === "?") {
    const s = new Set<number>();
    for (let i = min; i <= max; i++) s.add(i);
    return s;
  }
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    if (!step || step < 1) return null;
    let lo: number;
    let hi: number;
    if (range === "*" || range === "?") { lo = min; hi = max; }
    else if (range.includes("-")) { const [a, b] = range.split("-"); lo = parseInt(a, 10); hi = parseInt(b, 10); }
    else { lo = parseInt(range, 10); hi = lo; }
    if (Number.isNaN(lo)) return null;
    if (Number.isNaN(hi)) hi = lo;
    if (lo <= hi) {
      for (let i = lo; i <= hi; i += step) if (i >= min && i <= max) out.add(i);
    } else {
      // Wrap-around range, e.g. overnight hours 22-2 or Quartz days FRI-SUN (6-1).
      for (let i = lo; i <= max; i += step) out.add(i);
      for (let i = min; i <= hi; i += step) out.add(i);
    }
  }
  return out.size ? out : null;
}

// Which (day-of-week, hour) cells a cron touches. Hour granularity is enough for
// the heatmap, so we read the hour + day-of-week fields directly instead of
// iterating occurrences — deterministic, Quartz-safe (6/7-field, "?"), and it
// matches the cronstrue cadence text. Minute/second/day-of-month precision is
// intentionally ignored; an unparseable field falls back to "all".
function parseCronCells(cron: string): { hours: Set<number>; dows: Set<number> } | null {
  const f = cron.trim().toUpperCase().split(/\s+/);
  let hourField: string;
  let dowField: string;
  if (f.length >= 6) { hourField = f[2]; dowField = f[5]; }       // Quartz: s m h dom mon dow [year]
  else if (f.length === 5) { hourField = f[1]; dowField = f[4]; } // standard: m h dom mon dow
  else return null;

  const hours = expandCronField(hourField, 0, 23);
  if (!hours) return null;

  let dows: Set<number>;
  if (!dowField || dowField === "*" || dowField === "?") {
    dows = new Set([1, 2, 3, 4, 5, 6, 7]);
  } else {
    let df = dowField;
    for (const [name, num] of Object.entries(DOW_NAMES)) df = df.split(name).join(String(num));
    const quartz = expandCronField(df, 1, 7);
    // Quartz 1=SUN..7=SAT -> luxon 1=MON..7=SUN.
    dows = quartz ? new Set([...quartz].map((q) => (q === 1 ? 7 : q - 1))) : new Set([1, 2, 3, 4, 5, 6, 7]);
  }
  return { hours, dows };
}

function allCronCells() {
  return {
    hours: new Set(Array.from({ length: 24 }, (_, i) => i)),
    dows: new Set([1, 2, 3, 4, 5, 6, 7])
  };
}

// Map of day (1-7) -> hour (0-23) -> distinct runs firing in that slot.
// Reacts to the status filter so the heatmap reflects what's shown.
const cellMatrix = computed(() => {
  const matrix: Record<number, Record<number, any[]>> = {};
  for (let d = 1; d <= 7; d++) {
    matrix[d] = {};
    for (let h = 0; h < 24; h++) matrix[d][h] = [];
  }
  for (const run of displayedGroups.value) {
    const cron = run.schedule?.cronExpression;
    if (!cron) continue;
    const parsed = parseCronCells(cron) || allCronCells();
    for (const d of parsed.dows) {
      for (const h of parsed.hours) {
        if (matrix[d]?.[h]) matrix[d][h].push(run);
      }
    }
  }
  return matrix;
});

function cellCount(d: number, h: number) {
  return cellMatrix.value[d]?.[h]?.length || 0;
}

const maxCellCount = computed(() => {
  let m = 0;
  for (let d = 1; d <= 7; d++) {
    for (let h = 0; h < 24; h++) m = Math.max(m, cellCount(d, h));
  }
  return m;
});

// Intensity scaled relative to the busiest cell, so a flat-but-dense store
// (many always-on hourly runs) still shows the spikes and quiet hours instead
// of washing out to a single shade.
function cellLevel(d: number, h: number) {
  const c = cellCount(d, h);
  if (c <= 0) return 0;
  const max = maxCellCount.value;
  if (max <= 1) return 5;
  return Math.min(5, Math.max(1, Math.ceil((c / max) * 5)));
}

const busiest = computed(() => {
  let best = { hour: 0, count: 0 };
  for (let h = 0; h < 24; h++) {
    // Days share the same profile unless a weekly cron differs; take the max cell for the hour.
    let c = 0;
    for (let d = 1; d <= 7; d++) c = Math.max(c, cellCount(d, h));
    if (c > best.count) best = { hour: h, count: c };
  }
  return best;
});

const gapHours = computed(() => {
  let gaps = 0;
  for (let h = 0; h < 24; h++) {
    let covered = false;
    for (let d = 1; d <= 7; d++) {
      if (cellCount(d, h) > 0) { covered = true; break; }
    }
    if (!covered) gaps++;
  }
  return gaps;
});

const selectedRuns = computed(() => {
  if (!selectedCell.value) return [];
  return cellMatrix.value[selectedCell.value.d]?.[selectedCell.value.h] || [];
});

const slotTitle = computed(() => {
  if (!selectedCell.value) return "";
  return `${translate(days[selectedCell.value.d - 1].substring(0, 3))} · ${axisLabelLong(selectedCell.value.h)}`;
});

function selectCell(d: number, h: number) {
  selectedCell.value = { d, h };
}

function axisLabel(h: number) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
function axisLabelLong(h: number) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function cellAria(d: number, h: number) {
  const c = cellCount(d, h);
  const isNow = d === nowWeekday.value && h === nowHour.value;
  return `${translate(days[d - 1])} ${axisLabelLong(h)}, ${c} ${c === 1 ? translate("run") : translate("runs")}${isNow ? `, ${translate("current hour")}` : ""}`;
}

function getScheduleFrequency(schedule: any) {
  let description: any = Object.keys(cronExpressions).find((key) => cronExpressions[key] === schedule?.cronExpression);
  if (!description && schedule?.cronExpression) {
    description = cronstrue.toString(schedule.cronExpression);
    if (/^[a-z]/.test(description)) description = description.charAt(0).toUpperCase() + description.slice(1);
  }
  return description || "-";
}
function cadenceLabel(run: any) {
  if (!run.schedule?.cronExpression) return translate("No schedule");
  return getScheduleFrequency(run.schedule);
}
function nextRunLabel(run: any) {
  // Paused/draft runs are not scheduled, so there is no meaningful next run.
  if (!isActive(run)) return "-";
  const t = run.schedule?.nextExecutionDateTime;
  return t ? commonUtil.getRelativeTime(t) : "-";
}

async function fetchRuns() {
  refreshNow();
  isLoading.value = true;
  await orderRoutingStore().fetchOrderRoutingGroups();
  isLoading.value = false;
  brokeringGroups.value = JSON.parse(JSON.stringify(groups.value));
  utilStore.fetchEnums({ parentTypeId: "ORDER_ROUTING" });
  // Default the drill panel to the current hour so the panel isn't empty on open.
  if (!selectedCell.value) selectedCell.value = { d: nowWeekday.value, h: nowHour.value };
}

onIonViewWillEnter(async () => {
  await fetchRuns();
  emitter.on("productStoreOrConfigChanged", fetchRuns);
});
onIonViewWillLeave(() => {
  emitter.off("productStoreOrConfigChanged", fetchRuns);
});

async function addNewRun() {
  const newRunAlert = await alertController.create({
    header: translate("New Run"),
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
    inputs: [{ name: "runName", placeholder: translate("run name") }]
  });
  newRunAlert.onDidDismiss().then(async (result: any) => {
    if (result.role) return;
    if (result.data?.values?.runName.trim()) {
      await orderRoutingStore().createRoutingGroup(result.data.values.runName.trim());
      brokeringGroups.value = JSON.parse(JSON.stringify(groups.value));
    }
  });
  return newRunAlert.present();
}

function redirect(group: Group) {
  router.push(`brokering/${group.routingGroupId}/routes`);
}
</script>

<style scoped>
/* Status filter sits in the toolbar end slot. ion-segment is a block-level
   grid that would otherwise stretch the full toolbar; cap its width so the
   title keeps its room. */
.cal-filter {
  max-width: 320px;
}

.cal-loader {
  display: flex;
  justify-content: center;
  padding: var(--spacer-xl);
}
.cal-empty {
  padding: var(--spacer-base) var(--spacer-sm);
}

/* Two-column workspace; collapses to one column on narrow viewports. */
.cal-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
  align-items: start;
}
@media (max-width: 991px) {
  .cal-layout {
    grid-template-columns: 1fr;
  }
}

/* Ionic card overrides via host styles + exposed vars only. */
.cal-card {
  margin: 0;
}
/* ion-card-header defaults to flex-direction: column; force a row so the title
   sits at the start and the legend/count is pushed to the end. */
.cal-card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacer-2xs) var(--spacer-xs);
  padding: var(--spacer-xs) var(--spacer-sm);
}
/* Push the New Run action to the end of the Runs card header. */
.cal-add-run {
  margin-inline-start: auto;
}

/* Legend */
.cal-legend {
  display: inline-flex;
  align-items: center;
  gap: var(--spacer-2xs);
  margin-inline-start: auto;
  font-size: 11px;
  color: var(--ion-color-medium);
}
.cal-legend .cal-swatches {
  display: inline-flex;
  gap: 2px;
}
.cal-legend i {
  width: 14px;
  height: 11px;
  border-radius: 2px;
  display: block;
}
.cal-legend i.lv0 { background: var(--ion-color-light); }
.cal-legend i.lv1 { background: rgba(var(--ion-color-primary-rgb), 0.16); }
.cal-legend i.lv2 { background: rgba(var(--ion-color-primary-rgb), 0.34); }
.cal-legend i.lv3 { background: rgba(var(--ion-color-primary-rgb), 0.55); }
.cal-legend i.lv4 { background: rgba(var(--ion-color-primary-rgb), 0.80); }
.cal-legend i.lv5 { background: var(--ion-color-primary-shade); }

/* Heatmap: raw CSS grid, themed entirely from Ionic variables.
   Cells use minmax(14px, 1fr) so the grid fills available width and only
   forces a horizontal scroll on phone-sized viewports (<~460px). */
.cal-hmwrap {
  padding: var(--spacer-2xs) var(--spacer-sm) var(--spacer-xs);
  overflow-x: auto;
}
.cal-hmscroll {
  min-width: 0;
}
.cal-axis,
.cal-dayrow {
  display: grid;
  grid-template-columns: 52px repeat(24, minmax(14px, 1fr));
  gap: 3px;
}
.cal-axis {
  align-items: end;
  margin-bottom: 4px;
}
.cal-axcell {
  position: relative;
  height: 14px;
  font-size: 10px;
  line-height: 1;
  text-align: center;
  color: var(--ion-color-medium);
  white-space: nowrap;
}
.cal-axcell span {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
}
.cal-axcell.cal-axnow {
  color: var(--ion-color-primary);
  font-weight: 700;
}
.cal-axcell.cal-axnow::before {
  content: "";
  position: absolute;
  left: 50%;
  top: -5px;
  transform: translateX(-50%);
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-top: 4px solid var(--ion-color-primary);
}

.cal-daygrid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cal-dayrow {
  align-items: center;
  border-radius: 5px;
}
.cal-dayrow.cal-today {
  background: rgba(var(--ion-color-primary-rgb), 0.06);
  box-shadow: 0 0 0 1px rgba(var(--ion-color-primary-rgb), 0.16) inset;
}
.cal-daylbl {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-inline: 4px;
  font-size: 11px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
}
.cal-daylbl .dow {
  color: var(--ion-text-color);
  font-weight: 500;
}
.cal-daylbl .dt {
  color: var(--ion-color-medium);
  font-size: 10px;
}
.cal-dayrow.cal-today .dow,
.cal-dayrow.cal-today .dt {
  color: var(--ion-color-primary);
}

.cal-cell {
  appearance: none;
  border: 0;
  padding: 0;
  aspect-ratio: 1 / 1;
  min-height: 16px;
  border-radius: 3px;
  cursor: pointer;
  background: var(--ion-color-light);
  transition: transform 0.08s ease;
}
/* Intensity ramp from the primary accent — theme + dark-mode aware. */
.cal-cell.lv1 { background: rgba(var(--ion-color-primary-rgb), 0.16); }
.cal-cell.lv2 { background: rgba(var(--ion-color-primary-rgb), 0.34); }
.cal-cell.lv3 { background: rgba(var(--ion-color-primary-rgb), 0.55); }
.cal-cell.lv4 { background: rgba(var(--ion-color-primary-rgb), 0.80); }
.cal-cell.lv5 { background: var(--ion-color-primary-shade); }
.cal-cell:hover {
  transform: scale(1.16);
}
.cal-cell:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 1px;
}
.cal-cell.cal-sel {
  box-shadow: inset 0 0 0 2px var(--ion-text-color);
}
/* "Now" cell: inset ring stays inside the scroll container (no clipping). */
.cal-cell.cal-now {
  box-shadow: inset 0 0 0 2px var(--ion-color-primary);
}
.cal-cell.cal-now.cal-sel {
  box-shadow: inset 0 0 0 2px var(--ion-text-color);
}

/* Stat tiles: three equal outlined ion-items in a row, each stacking a small
   ion-note label over the bold value. Collapses to a single column only on
   very narrow viewports, so it never lands on an uneven 2 + 1 wrap. */
.cal-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacer-xs);
  padding: var(--spacer-2xs) var(--spacer-sm) 0;
}
@media (max-width: 480px) {
  .cal-stats {
    grid-template-columns: 1fr;
  }
}
.cal-stat {
  min-width: 0;
  border: 1px solid var(--ion-color-step-150, #e3e5e9);
  border-radius: 8px;
  --background: transparent;
  --border-radius: 8px;
  --padding-start: var(--spacer-sm);
  --inner-padding-end: var(--spacer-sm);
}
.cal-stat ion-note {
  display: block;
  margin-bottom: 2px;
}
/* Value inherits the native ion-item font; only the layout is set here. */
.cal-stat .cal-stat-v {
  display: block;
}

/* Drill panel: native list with an item-divider header, outlined to read as
   one grouped surface. */
.cal-slot {
  margin: var(--spacer-xs) var(--spacer-sm) var(--spacer-sm);
}
.cal-slot-list {
  border: 1px solid var(--ion-color-step-150, #e3e5e9);
  border-radius: 8px;
  overflow: hidden;
}


/* Runs list — Ionic items tuned through their exposed CSS vars only;
   text uses native ion-label typography (no font overrides). */
.cal-cadence ion-item {
  --padding-start: var(--spacer-sm);
  --inner-padding-end: var(--spacer-sm);
  --min-height: 56px;
}
</style>
