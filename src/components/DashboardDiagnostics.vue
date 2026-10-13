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
          <ion-note>{{ translate("{count} orders from store rules", { count: formatNumber(storeOrdersByWeek[selected] ?? 0) }) }}</ion-note>
        </template>
        <Sparkline :points="storeShareByWeek.map((share) => share ?? 0)" color="secondary" :label="translate('Store share of brokered orders by week')" />
      </StatCard>
      <StatCard :title="translate('Store-shipped units')" :stat="formatNumber(shipped.weeklyUnits[selected] ?? 0)">
        <template #subtitle>
          <DeltaNote :values="shipped.weeklyUnits" :index="selected" />
        </template>
        <Sparkline :points="shipped.weeklyUnits" color="tertiary" :label="translate('Store-shipped units by week')" />
      </StatCard>
      <StatCard :title="translate('Store stock held as safety stock')" :stat="formatPercent(storeHoldTotals.safetyStockShare)">
        <template #subtitle>
          <ion-note>{{ translate("{held} of {available} units, right now", { held: formatNumber(storeHoldTotals.safetyStockHeld), available: formatNumber(storeHoldTotals.available) }) }}</ion-note>
        </template>
        <Sparkline :points="shareTrend.map((point) => point ?? 0)" color="warning" :label="translate('Safety-stock share by week')" />
      </StatCard>
    </section>

    <!-- Orders routed by rule -->
    <ion-card class="wide">
      <ion-card-header>
        <div class="card-head">
          <div>
            <ion-card-title>{{ translate("Orders routed by rule") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Distinct orders brokered by each rule, week of {week}", { week: weekLabels[selected] }) }}</ion-card-subtitle>
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
                :aria-label="translate('Highlight {rule} in the chart', { rule: rule.label })"
                @click.stop="toggleFocus(rule.ruleKey)"
              >
                <ion-icon slot="icon-only" :icon="focusedRule && focusedRule !== rule.ruleKey ? ellipseOutline : ellipse" :color="rule.tone" />
              </ion-button>
              <ion-label class="ion-text-wrap">
                {{ rule.label }}
                <p>{{ rule.facilityTypeId === "RETAIL_STORE" ? translate("Store fulfillment") : translate("Warehouse fulfillment") }}</p>
              </ion-label>
              <ion-label slot="end" class="ion-text-end">
                {{ formatNumber(rule.counts[selected] ?? 0) }}
                <p>{{ formatPercent(brokeredByWeek[selected] ? (rule.counts[selected] ?? 0) / brokeredByWeek[selected] : null) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </template>
        <ion-card-content v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {{ translate("Rule") }}
                </th>
                <th v-for="(week, index) in weekLabels" :key="week" scope="col" @click="selectWeek(index)">
                  <ion-text :color="index === selected ? 'primary' : undefined">
                    {{ week }}
                  </ion-text>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in rulesWithTone" :key="rule.ruleKey">
                <th scope="row">
                  <a v-if="rule.routingGroupId" href="#" @click.prevent="openRule(rule)">{{ rule.label }}</a>
                  <template v-else>
                    {{ rule.label }}
                  </template>
                </th>
                <td v-for="(count, index) in rule.counts" :key="index">
                  <ion-text :color="index === selected ? 'primary' : undefined">
                    {{ formatNumber(count) }}
                  </ion-text>
                </td>
              </tr>
              <tr>
                <th scope="row">
                  {{ translate("All rules") }}
                </th>
                <td v-for="(total, index) in brokeredByWeek" :key="index">
                  <ion-text :color="index === selected ? 'primary' : undefined">
                    <strong>{{ formatNumber(total) }}</strong>
                  </ion-text>
                </td>
              </tr>
            </tbody>
          </table>
        </ion-card-content>
      </SectionState>
    </ion-card>

    <!-- Safety stock over time -->
    <ion-card class="wide">
      <ion-card-header>
        <div class="card-head">
          <div>
            <ion-card-title>{{ translate("Safety stock over time") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Share of store inventory held as safety stock at the end of each week") }}</ion-card-subtitle>
          </div>
          <div class="head-chips">
            <ion-chip :outline="historyView !== 'combined'" :color="historyView === 'combined' ? 'primary' : undefined" @click="historyView = 'combined'">
              <ion-label>{{ translate("All stores") }}</ion-label>
            </ion-chip>
            <ion-chip :outline="historyView !== 'stores'" :color="historyView === 'stores' ? 'primary' : undefined" @click="historyView = 'stores'">
              <ion-label>{{ translate("By store") }}</ion-label>
            </ion-chip>
          </div>
        </div>
      </ion-card-header>
      <SectionState :status="status.inventory" :empty="!storeHolds.length" :empty-message="translate('No store inventory found')">
        <ion-card-content>
          <WeeklyLineChart
            :weeks="historyLabels"
            :series="historySeries"
            :selected-index="historySelected"
            :format-value="formatPercent"
            :label="translate('Safety-stock share by week')"
            @select="historySelected = $event"
          />
          <ion-note class="history-note">
            {{ shareHistory.length
              ? translate("{count} weekly snapshots plus today. A new snapshot is added after each week closes.", { count: shareHistory.length })
              : translate("Only today is shown: no weekly snapshots have been exported yet. Once the weekly snapshot export runs, each closed week is added here.") }}
          </ion-note>
        </ion-card-content>
        <ion-list v-if="historyView === 'stores'" lines="full">
          <ion-list-header>
            <ion-label>{{ translate("Stores, {point}", { point: historyLabels[historySelected] }) }}</ion-label>
          </ion-list-header>
          <ion-item v-for="store in historyStores" :key="store.facilityId" button :detail="false" @click="toggleHistoryFocus(store.facilityId)">
            <ion-icon slot="start" :icon="focusedStore && focusedStore !== store.facilityId ? ellipseOutline : ellipse" :color="store.tone" />
            <ion-label>{{ store.facilityName }}</ion-label>
            <ion-note slot="end">
              {{ formatPercent(store.shares[historySelected]) }}
            </ion-note>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>

    <!-- Safety stock by reason -->
    <ion-card class="wide">
      <ion-card-header>
        <ion-card-title>{{ translate("Safety stock by reason") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Units held at each store, by the rule that set them, right now") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.reasons" :empty="!reasonRows.length" :empty-message="translate('No units are held back at stores')">
        <ion-list lines="full">
          <ion-item
            v-for="reason in reasonLegend"
            :key="reason.key"
            :button="!!reason.ruleId"
            :detail="!!reason.ruleId"
            :router-link="reason.ruleId ? `/update-safety-stock/${reason.ruleId}` : undefined"
          >
            <ion-icon slot="start" :icon="ellipse" :color="reason.tone" />
            <ion-label class="ion-text-wrap">
              {{ reason.key }}
              <p>{{ reason.description }}</p>
            </ion-label>
            <ion-note slot="end">
              {{ formatNumber(reason.total) }}
            </ion-note>
          </ion-item>
        </ion-list>
        <StackedBarList :rows="reasonRows" :segments="reasonLegend" />
      </SectionState>
    </ion-card>

    <!-- Store-shipped units -->
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
            :label="translate('Store-shipped units by week')"
            @select="selectWeek"
          />
        </ion-card-content>
        <ion-list lines="full">
          <ion-list-header>
            <ion-label>{{ translate("Top shipping stores, week of {week}", { week: weekLabels[selected] }) }}</ion-label>
          </ion-list-header>
          <ion-item v-for="store in topShippingStores" :key="store.facilityId">
            <ion-label>{{ store.facilityName }}</ion-label>
            <div slot="end" class="trend">
              <Sparkline :points="store.units" color="tertiary" :height="24" :label="translate('{store} units by week', { store: store.facilityName })" />
            </div>
            <ion-note slot="end">
              {{ formatNumber(store.units[selected] ?? 0) }}
            </ion-note>
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
          <ion-item>
            <ion-label class="ion-text-wrap">
              {{ translate("Safety-stock hold") }}
              <p>{{ translate("Minimum stock kept at each location") }}</p>
            </ion-label>
            <ion-note slot="end">
              {{ formatNumber(allHoldTotals.safetyStockHeld) }}
            </ion-note>
          </ion-item>
          <ion-item>
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
            <ion-label><strong>{{ translate("Combined hold") }}</strong></ion-label>
            <ion-note slot="end">
              <strong>{{ formatNumber(allHoldTotals.combinedHeld) }}</strong>
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
          <ion-item v-for="hold in storeHolds" :key="hold.facilityId">
            <ion-label>
              {{ hold.facilityName }}
              <p>{{ translate("{held} of {available} units", { held: formatNumber(hold.safetyStockHeld), available: formatNumber(hold.available) }) }}</p>
              <ion-progress-bar :value="hold.safetyStockShare ?? 0" :color="(hold.safetyStockShare ?? 0) > (storeHoldTotals.safetyStockShare ?? 0) ? 'warning' : 'medium'" />
            </ion-label>
            <ion-note slot="end">
              {{ formatPercent(hold.safetyStockShare) }}
            </ion-note>
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
import { computed, ref, watch } from "vue";
import DeltaNote from "@/components/diagnostics/DeltaNote.vue";
import SectionState from "@/components/diagnostics/SectionState.vue";
import StackedBarList from "@/components/diagnostics/StackedBarList.vue";
import WeeklyBarChart from "@/components/diagnostics/WeeklyBarChart.vue";
import WeeklyLineChart from "@/components/diagnostics/WeeklyLineChart.vue";
import router from "@/router";
import { useRoutingDiagnosticsStore } from "@/store/routingDiagnosticsStore";
import { type RuleSeries, SHIPPING_REASON, UNATTRIBUTED_REASON, shareOf, totalHolds } from "@/utils/routingDiagnostics";

const WEEK_OPTIONS = [4, 6, 12];
const TONES = ["primary", "secondary", "tertiary", "success", "warning", "danger", "dark", "medium"];
const RULE_TONES = ["primary", "secondary", "tertiary", "success", "dark"];

const diagnostics = useRoutingDiagnosticsStore();

const ruleView = ref("chart");
const historyView = ref("combined");
const focusedRule = ref<string | null>(null);
const focusedStore = ref<string | null>(null);
const selected = ref(0);
const historySelected = ref(0);

const weekCount = computed(() => diagnostics.weekCount);
const status = computed(() => diagnostics.status);
const weekLabels = computed(() => diagnostics.weeks.map((week) => week.label));
const ruleSeries = computed(() => diagnostics.ruleSeries);
const shipped = computed(() => diagnostics.storeShipped);
const holds = computed(() => diagnostics.holds);
const threshold = computed(() => diagnostics.threshold);
const shareHistory = computed(() => diagnostics.shareHistory);

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

const brokeredByWeek = computed(() => weekLabels.value.map((_, index) => ruleSeries.value.reduce((sum, rule) => sum + (rule.counts[index] || 0), 0)));
const storeOrdersByWeek = computed(() => weekLabels.value.map((_, index) => ruleSeries.value
  .filter((rule) => rule.facilityTypeId === "RETAIL_STORE")
  .reduce((sum, rule) => sum + (rule.counts[index] || 0), 0)));
const storeShareByWeek = computed(() => brokeredByWeek.value.map((total, index) => (total ? storeOrdersByWeek.value[index] / total : null)));

const topShippingStores = computed(() => [...shipped.value.stores]
  .sort((a, b) => (b.units[selected.value] || 0) - (a.units[selected.value] || 0))
  .slice(0, 8));

const storeHolds = computed(() => holds.value.filter((hold) => hold.facilityTypeId === "RETAIL_STORE"));
const storeHoldTotals = computed(() => totalHolds(storeHolds.value));
const allHoldTotals = computed(() => totalHolds(holds.value));

// Exported weekly snapshots followed by today's live numbers.
const historyPoints = computed(() => [
  ...shareHistory.value.map((point) => point.byStore),
  Object.fromEntries(storeHolds.value.map((hold) => [hold.facilityId, { available: hold.available, held: hold.safetyStockHeld }]))
]);
const historyLabels = computed(() => [...shareHistory.value.map((point) => point.label), translate("Now")]);
const shareTrend = computed(() => historyPoints.value.map((byStore) => shareOf(byStore)));

watch(historyLabels, (labels) => { historySelected.value = Math.max(0, labels.length - 1); }, { immediate: true });

const historyStores = computed(() => storeHolds.value
  .map((hold, index) => ({
    facilityId: hold.facilityId,
    facilityName: hold.facilityName,
    tone: TONES[index % TONES.length],
    shares: historyPoints.value.map((byStore) => shareOf(byStore, [hold.facilityId]))
  }))
  .sort((a, b) => (b.shares[historySelected.value] ?? 0) - (a.shares[historySelected.value] ?? 0)));

const historySeries = computed(() => {
  if(historyView.value === "combined") {
    return [{ key: "all", values: shareTrend.value.map((share) => share ?? 0), tone: "warning", emphasis: true }];
  }

  return historyStores.value.map((store) => ({
    key: store.facilityId,
    values: store.shares.map((share) => share ?? 0),
    tone: store.tone,
    emphasis: focusedStore.value === store.facilityId,
    muted: !!focusedStore.value && focusedStore.value !== store.facilityId
  }));
});

const reasonLegend = computed(() => {
  const { reasons, totals } = diagnostics.safetyByReason;
  let ruleIndex = 0;

  return reasons.map((reason) => {
    if(reason === UNATTRIBUTED_REASON) {
      return { key: reason, tone: "medium", total: totals[reason] || 0, ruleId: "", description: translate("Minimum stock no current rule explains") };
    }
    if(reason === SHIPPING_REASON) {
      return { key: reason, tone: "danger", total: totals[reason] || 0, ruleId: "", description: translate("Extra units at locations not allowed to ship the product") };
    }

    return { key: reason, tone: RULE_TONES[ruleIndex++ % RULE_TONES.length], total: totals[reason] || 0, ruleId: diagnostics.safetyRuleIds[reason] || "", description: translate("Safety stock rule") };
  });
});

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

function toggleHistoryFocus(facilityId: string) {
  focusedStore.value = focusedStore.value === facilityId ? null : facilityId;
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
.wide,
.footnote {
  grid-column: 1 / -1;
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

.history-note {
  display: block;
  margin-top: var(--spacer-xs);
}

.table-scroll {
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  padding: var(--spacer-xs);
  text-align: end;
  white-space: nowrap;
}

th[scope="row"] {
  text-align: start;
  white-space: normal;
}

thead th {
  cursor: pointer;
}

.footnote {
  display: block;
  padding-inline: var(--spacer-xs);
}
</style>
