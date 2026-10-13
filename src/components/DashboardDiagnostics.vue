<template>
  <main class="diagnostics">
    <!-- Week range for every weekly measure on the page -->
    <section class="range">
      <ion-chip
        v-for="count in WEEK_OPTIONS"
        :key="count"
        :outline="count !== weekCount"
        :color="count === weekCount ? 'primary' : undefined"
        @click="changeWeeks(count)"
      >
        <ion-label>{{ translate("{count} weeks", { count }) }}</ion-label>
      </ion-chip>
    </section>

    <!-- Headline numbers for the selected week, each with its weekly trend -->
    <section class="kpis">
      <StatCard :title="translate('Orders brokered')" :stat="formatNumber(brokeredByWeek[selected] ?? 0)">
        <template #subtitle>
          <DeltaNote :values="brokeredByWeek" :index="selected" />
        </template>
        <Sparkline :points="brokeredByWeek" :label="translate('Orders brokered by week')" />
      </StatCard>
      <StatCard :title="translate('Routed to stores')" :stat="formatPercent(storeShareByWeek[selected])">
        <template #subtitle>
          <ion-note>{{ translate("{count} orders allocated to stores", { count: formatNumber(storeOrdersByWeek[selected] ?? 0) }) }}</ion-note>
        </template>
        <Sparkline :points="storeShareByWeek.map((share) => share ?? 0)" color="secondary" :label="translate('Store share of brokered orders by week')" />
      </StatCard>
      <StatCard :title="translate('Store-shipped units')" :stat="formatNumber(shipped.weeklyUnits[selected] ?? 0)">
        <template #subtitle>
          <DeltaNote :values="shipped.weeklyUnits" :index="selected" />
        </template>
      </StatCard>
      <StatCard :title="translate('Store stock held as safety stock')" :stat="formatPercent(storeHoldTotals.safetyStockShare)">
        <template #subtitle>
          <ion-note>{{ translate("{held} of {available} units, right now", { held: formatNumber(storeHoldTotals.safetyStockHeld), available: formatNumber(storeHoldTotals.available) }) }}</ion-note>
        </template>
      </StatCard>
    </section>

    <!-- Orders routed by rule, with store-shipped units beside it -->
    <section class="routing-row">
      <ion-card>
        <ion-card-header>
          <div class="card-head">
            <div>
              <ion-card-title>{{ translate("Orders routed by rule") }}</ion-card-title>
              <ion-card-subtitle>{{ translate("Orders each rule allocated in the week of {week}. A split order counts under every rule it used.", { week: weekLabels[selected] }) }}</ion-card-subtitle>
            </div>
            <div class="head-chips">
              <ion-chip :outline="ruleView !== 'chart'" :color="ruleView === 'chart' ? 'primary' : undefined" @click="ruleView = 'chart'">
                <ion-icon :icon="analyticsOutline" />
                <ion-label>{{ translate("Chart") }}</ion-label>
              </ion-chip>
              <ion-chip :outline="ruleView !== 'table'" :color="ruleView === 'table' ? 'primary' : undefined" @click="ruleView = 'table'">
                <ion-icon :icon="gridOutline" />
                <ion-label>{{ translate("Table") }}</ion-label>
              </ion-chip>
            </div>
          </div>
        </ion-card-header>
        <SectionState :status="status.routing" :empty="!ruleSeries.length" :empty-message="translate('No brokered orders in these weeks')">
          <template v-if="ruleView === 'chart'">
            <ion-card-content>
              <WeeklyLineChart
                :weeks="weekLabels"
                :series="chartSeries"
                :selected-index="selected"
                :label="translate('Orders routed by rule each week')"
                @select="selectWeek"
              />
            </ion-card-content>
            <ion-list lines="full">
              <ion-item v-for="rule in rulesWithTone" :key="rule.ruleKey" :button="!!rule.routingGroupId" :detail="!!rule.routingGroupId" @click="openRule(rule)">
                <ion-button
                  slot="start"
                  fill="clear"
                  :aria-label="translate('Highlight {rule} in the chart', { rule: rule.label || translate('Unrecorded rule') })"
                  @click.stop="toggleFocus(rule.ruleKey)"
                >
                  <ion-icon slot="icon-only" :icon="focusedRule && focusedRule !== rule.ruleKey ? ellipseOutline : ellipse" :color="rule.tone" />
                </ion-button>
                <ion-label class="ion-text-wrap">
                  {{ ruleParts(rule).name }}
                  <p>{{ ruleParts(rule).routing }}</p>
                  <p>{{ fulfillmentLabel(rule.facilityTypeIds) }}</p>
                </ion-label>
                <ion-label slot="end" class="ion-text-end">
                  {{ formatNumber(rule.counts[selected] ?? 0) }}
                  <p>{{ formatPercent(brokeredByWeek[selected] ? (rule.counts[selected] ?? 0) / brokeredByWeek[selected] : null) }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </template>
          <!-- One Ionic list row per rule, with a column per week; scrolls sideways when narrow. -->
          <div v-else class="table-scroll">
            <ion-list lines="full" class="week-table" role="table" :style="{ '--week-count': weekLabels.length }">
              <ion-item role="row">
                <div class="week-row">
                  <ion-note role="columnheader">
                    {{ translate("Rule") }}
                  </ion-note>
                  <ion-note
                    v-for="(week, index) in weekLabels"
                    :key="week"
                    role="columnheader"
                    class="ion-text-end week-cell"
                    :color="index === selected ? 'primary' : undefined"
                    @click="selectWeek(index)"
                  >
                    {{ week }}
                  </ion-note>
                </div>
              </ion-item>
              <ion-item v-for="rule in rulesWithTone" :key="rule.ruleKey" role="row" :button="!!rule.routingGroupId" :detail="false" @click="openRule(rule)">
                <div class="week-row">
                  <ion-label role="rowheader" class="ion-text-wrap">
                    {{ ruleParts(rule).name }}
                    <p>{{ ruleParts(rule).routing }}</p>
                  </ion-label>
                  <ion-text
                    v-for="(count, index) in rule.counts"
                    :key="index"
                    role="cell"
                    class="ion-text-end"
                    :color="index === selected ? 'primary' : undefined"
                  >
                    {{ formatNumber(count) }}
                  </ion-text>
                </div>
              </ion-item>
              <ion-item lines="none" role="row">
                <div class="week-row">
                  <ion-label role="rowheader" class="ion-text-wrap">
                    {{ translate("Orders brokered") }}
                    <p>{{ translate("Distinct orders, all rules") }}</p>
                  </ion-label>
                  <ion-text
                    v-for="(total, index) in brokeredByWeek"
                    :key="index"
                    role="cell"
                    class="ion-text-end"
                    :color="index === selected ? 'primary' : undefined"
                  >
                    {{ formatNumber(total) }}
                  </ion-text>
                </div>
              </ion-item>
            </ion-list>
          </div>
        </SectionState>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ translate("Store-shipped units") }}</ion-card-title>
          <ion-card-subtitle>{{ translate("Units shipped from retail stores, pickup excluded") }}</ion-card-subtitle>
        </ion-card-header>
        <SectionState :status="status.shipping" :empty="!shipped.weeklyUnits.some(Boolean)" :empty-message="translate('No store shipments in these weeks')">
          <ion-card-content>
            <WeeklyBarChart
              :weeks="weekLabels"
              :values="shipped.weeklyUnits"
              :selected-index="selected"
              tone="tertiary"
              :max-labels="3"
              :label="translate('Store-shipped units by week')"
              @select="selectWeek"
            />
          </ion-card-content>
          <ion-list lines="full">
            <ion-list-header>
              <ion-label>{{ translate("Top shipping stores, week of {week}", { week: weekLabels[selected] }) }}</ion-label>
            </ion-list-header>
            <ion-item v-for="store in visible(shippingStores, 'shipping')" :key="store.facilityId">
              <ion-label>{{ store.facilityName }}</ion-label>
              <div slot="end" class="trend">
                <Sparkline :points="store.units" color="tertiary" :height="24" :label="translate('{store} units by week', { store: store.facilityName })" />
              </div>
              <ion-note slot="end">
                {{ formatNumber(store.units[selected] ?? 0) }}
              </ion-note>
            </ion-item>
            <ion-item v-if="shippingStores.length > TOP_COUNT" button :detail="false" lines="none" @click="toggleExpanded('shipping')">
              <ion-label color="primary">
                {{ expanded.shipping ? translate("Show top {count}", { count: TOP_COUNT }) : translate("Show all {count} stores", { count: shippingStores.length }) }}
              </ion-label>
            </ion-item>
          </ion-list>
        </SectionState>
      </ion-card>
    </section>

    <!-- Safety stock by reason -->
    <ion-card class="wide">
      <ion-card-header>
        <ion-card-title>{{ translate("Safety stock by reason") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Units held at each store, by the rule that set them, right now") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.reasons" :empty="!reasonRows.length" :empty-message="translate('No units are held back at stores')">
        <ion-card-content>
          <SafetyReasonChips :reasons="reasonLegend" />
        </ion-card-content>
        <StackedBarList :rows="visible(reasonRows, 'reasons')" :segments="reasonLegend" />
        <ion-list v-if="reasonRows.length > TOP_COUNT" lines="none">
          <ion-item button :detail="false" @click="toggleExpanded('reasons')">
            <ion-label color="primary">
              {{ expanded.reasons ? translate("Show top {count}", { count: TOP_COUNT }) : translate("Show all {count} stores", { count: reasonRows.length }) }}
            </ion-label>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>

    <!-- Inventory held back -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Inventory held back") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Units routing cannot use right now, all locations") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.inventory" :empty="!holds.length" :empty-message="translate('No inventory found for these locations')">
        <ion-card-content>
          <ion-progress-bar :value="allHoldTotals.available ? allHoldTotals.eligible / allHoldTotals.available : 0" color="success" />
          <ion-note>{{ translate("{share} of available units are eligible for routing", { share: formatPercent(allHoldTotals.available ? allHoldTotals.eligible / allHoldTotals.available : null) }) }}</ion-note>
        </ion-card-content>
        <ion-list lines="full">
          <ion-item>
            <ion-label>{{ translate("Available before controls") }}</ion-label>
            <ion-note slot="end">
              {{ formatNumber(allHoldTotals.available) }}
            </ion-note>
          </ion-item>
          <ion-item button router-link="/safety-stock" :detail="true">
            <ion-label class="ion-text-wrap">
              {{ translate("Safety-stock hold") }}
              <p>{{ translate("Minimum stock kept at each location") }}</p>
            </ion-label>
            <ion-note slot="end">
              {{ formatNumber(allHoldTotals.safetyStockHeld) }}
            </ion-note>
          </ion-item>
          <ion-item button router-link="/shipping" :detail="true">
            <ion-label class="ion-text-wrap">
              {{ translate("Shipping exclusion") }}
              <p>{{ translate("Products a location is not allowed to ship") }}</p>
            </ion-label>
            <ion-note slot="end">
              {{ formatNumber(allHoldTotals.shippingExcluded) }}
            </ion-note>
          </ion-item>
          <ion-item>
            <ion-label class="ion-text-wrap">
              {{ translate("Overlap") }}
              <p>{{ translate("Held by both controls, counted once") }}</p>
            </ion-label>
            <ion-note slot="end">
              {{ formatNumber(allHoldTotals.overlap) }}
            </ion-note>
          </ion-item>
          <ion-item button router-link="/threshold" :detail="true">
            <ion-label class="ion-text-wrap">
              {{ translate("Threshold") }}
              <p v-if="!threshold.activeRules">
                {{ translate("0 units held back: no threshold rules are set up") }}
              </p>
              <p v-else>
                {{ translate("{count} active rules keep up to {units} units of each product out of online availability; routing is not affected", { count: threshold.activeRules, units: formatNumber(threshold.maxThreshold) }) }}
              </p>
            </ion-label>
            <ion-note slot="end">
              {{ threshold.activeRules ? "-" : "0" }}
            </ion-note>
          </ion-item>
          <ion-item lines="none">
            <ion-label>{{ translate("Combined hold") }}</ion-label>
            <ion-note slot="end">
              {{ formatNumber(allHoldTotals.combinedHeld) }}
            </ion-note>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>

    <!-- Safety-stock share by store -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Safety-stock share by store") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Safety-stock hold divided by units available before it") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.inventory" :empty="!storeHolds.length" :empty-message="translate('No store inventory found')">
        <ion-list lines="full">
          <ion-item v-for="hold in visible(storeHolds, 'share')" :key="hold.facilityId">
            <ion-label>
              {{ hold.facilityName }}
              <p>{{ translate("{held} of {available} units", { held: formatNumber(hold.safetyStockHeld), available: formatNumber(hold.available) }) }}</p>
              <ion-progress-bar :value="hold.safetyStockShare ?? 0" :color="(hold.safetyStockShare ?? 0) > (storeHoldTotals.safetyStockShare ?? 0) ? 'warning' : 'medium'" />
            </ion-label>
            <ion-note slot="end">
              {{ formatPercent(hold.safetyStockShare) }}
            </ion-note>
          </ion-item>
          <ion-item v-if="storeHolds.length > TOP_COUNT" button :detail="false" lines="none" @click="toggleExpanded('share')">
            <ion-label color="primary">
              {{ expanded.share ? translate("Show top {count}", { count: TOP_COUNT }) : translate("Show all {count} stores", { count: storeHolds.length }) }}
            </ion-label>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>

    <ion-note class="footnote">
      {{ translate("Weeks run Monday to Sunday in UTC. Point-of-sale orders and pickup are excluded. Inventory is a live snapshot, so its numbers do not change with the selected week.") }}
    </ion-note>
  </main>
</template>

<script setup lang="ts">
import { Sparkline, StatCard, translate } from "@common";
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonProgressBar, IonText } from "@ionic/vue";
import { analyticsOutline, ellipse, ellipseOutline, gridOutline } from "ionicons/icons";
import { computed, reactive, ref, watch } from "vue";
import DeltaNote from "@/components/diagnostics/DeltaNote.vue";
import SafetyReasonChips from "@/components/diagnostics/SafetyReasonChips.vue";
import SectionState from "@/components/diagnostics/SectionState.vue";
import StackedBarList from "@/components/diagnostics/StackedBarList.vue";
import WeeklyBarChart from "@/components/diagnostics/WeeklyBarChart.vue";
import WeeklyLineChart from "@/components/diagnostics/WeeklyLineChart.vue";
import { useSafetyStockSummary } from "@/composables/useSafetyStockSummary";
import router from "@/router";
import { useRoutingDiagnosticsStore } from "@/store/routingDiagnosticsStore";
import { type RuleSeries, totalHolds } from "@/utils/routingDiagnostics";

const WEEK_OPTIONS = [4, 6, 12];
const TONES = ["primary", "secondary", "tertiary", "success", "warning", "danger", "dark", "medium"];

const diagnostics = useRoutingDiagnosticsStore();

const ruleView = ref("chart");
const focusedRule = ref<string | null>(null);
const selected = ref(0);
// Store lists show the top few until the user asks for every store.
const TOP_COUNT = 5;
const expanded = reactive({ shipping: false, reasons: false, share: false });

const weekCount = computed(() => diagnostics.weekCount);
const status = computed(() => diagnostics.status);
const weekLabels = computed(() => diagnostics.weeks.map((week) => week.label));
const ruleSeries = computed(() => diagnostics.ruleSeries);
const shipped = computed(() => diagnostics.storeShipped);
const holds = computed(() => diagnostics.holds);
const threshold = computed(() => diagnostics.threshold);

// Default to the latest complete week whenever the week range changes.
watch(weekLabels, (labels) => { selected.value = Math.max(0, labels.length - 1); }, { immediate: true });

const rulesWithTone = computed(() => ruleSeries.value.map((rule, index) => ({ ...rule, tone: TONES[index % TONES.length] })));

const chartSeries = computed(() => rulesWithTone.value.map((rule) => ({
  key: rule.ruleKey,
  values: rule.counts,
  tone: rule.tone,
  emphasis: focusedRule.value === rule.ruleKey,
  muted: !!focusedRule.value && focusedRule.value !== rule.ruleKey
})));

const brokeredByWeek = computed(() => weekLabels.value.map((_, index) => diagnostics.brokeredOrders[index] || 0));
const storeOrdersByWeek = computed(() => weekLabels.value.map((_, index) => diagnostics.storeOrders[index] || 0));
const storeShareByWeek = computed(() => brokeredByWeek.value.map((total, index) => (total ? storeOrdersByWeek.value[index] / total : null)));

const shippingStores = computed(() => [...shipped.value.stores]
  .sort((a, b) => (b.units[selected.value] || 0) - (a.units[selected.value] || 0)));

const allHoldTotals = computed(() => totalHolds(holds.value));
const { storeHolds, storeHoldTotals, reasonLegend } = useSafetyStockSummary();

const reasonRows = computed(() => diagnostics.safetyByReason.stores.map((store) => ({
  key: store.facilityId,
  label: store.facilityName,
  values: store.units,
  total: store.total
})));

function changeWeeks(count: number) {
  if(count !== diagnostics.weekCount) {diagnostics.load(count);}
}

function selectWeek(index: number) {
  selected.value = index;
}

function toggleFocus(ruleKey: string) {
  focusedRule.value = focusedRule.value === ruleKey ? null : ruleKey;
}

function visible<T>(list: T[], key: keyof typeof expanded) {
  return expanded[key] ? list : list.slice(0, TOP_COUNT);
}

function toggleExpanded(key: keyof typeof expanded) {
  expanded[key] = !expanded[key];
}

// A rule label is "<routing> : <rule>" (with the group first when two rules share a name):
// show the rule name on its own line and its routing below it.
function ruleParts(rule: RuleSeries) {
  const parts = (rule.label || "").split(" : ");
  const name = parts.pop() || translate("Unrecorded rule");

  return { name, routing: parts.join(" : ") };
}

function fulfillmentLabel(facilityTypeIds: string[]) {
  const stores = facilityTypeIds.includes("RETAIL_STORE");
  const warehouses = facilityTypeIds.includes("WAREHOUSE");
  if(stores && warehouses) {return translate("Store and warehouse fulfillment");}

  return stores ? translate("Store fulfillment") : translate("Warehouse fulfillment");
}

function openRule(rule: RuleSeries) {
  if(!rule.routingGroupId) {return;}
  router.push({ path: `/order-routing/${rule.routingGroupId}`, query: { orderRoutingId: rule.orderRoutingId, routingRuleId: rule.routingRuleId } });
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if(value === null || value === undefined) {return "-";}

  return `${(value * 100).toFixed(1)}%`;
}
</script>

<style scoped>
.diagnostics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--spacer-sm);
  padding: var(--spacer-base);
  align-items: start;
}

.range,
.kpis,
.routing-row,
.wide,
.footnote {
  grid-column: 1 / -1;
}

/* Rule breakdown with store-shipped units to its right; stacked when the page is narrow. */
.routing-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--spacer-sm);
  align-items: start;
}

@media (max-width: 991px) {
  .routing-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.range {
  display: flex;
  flex-wrap: wrap;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacer-sm);
}

ion-card {
  margin: 0;
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--spacer-sm);
}

.card-head > div:first-child {
  flex: 1 1 240px;
}

.head-chips {
  display: flex;
  flex-wrap: wrap;
}

.trend {
  width: 80px;
}

.table-scroll {
  overflow-x: auto;
}

/* Wide enough for every week column; the card scrolls sideways when it is narrower. */
.week-table {
  min-width: max-content;
}

.week-row {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) repeat(var(--week-count), minmax(56px, auto));
  gap: var(--spacer-sm);
  align-items: center;
  width: 100%;
}

.week-cell {
  cursor: pointer;
}

.footnote {
  grid-column: 1 / -1;
}

/* Rule breakdown with store-shipped units to its right; stacked when the page is narrow. */
.routing-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--spacer-sm);
  align-items: start;
}

@media (max-width: 991px) {
  .routing-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.range {
  display: flex;
  flex-wrap: wrap;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacer-sm);
}

ion-card {
  margin: 0;
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--spacer-sm);
}

.card-head > div:first-child {
  flex: 1 1 240px;
}

.head-chips {
  display: flex;
  flex-wrap: wrap;
}

.trend {
  width: 80px;
}

.table-scroll {
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
}

td {
  padding: var(--spacer-xs);
  text-align: end;
  white-space: nowrap;
}

.row-label {
  text-align: start;
  white-space: normal;
}

thead td {
  cursor: pointer;
}

.footnote {
  display: block;
  padding-inline: var(--spacer-xs);
}
</style>
