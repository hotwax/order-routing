<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ row.routingName }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <!-- One-sided rows (routing added/removed by the variation): single-column view with a note. -->
    <ion-note v-if="!row.parent" color="medium">{{ translate("Not present in the parent run — showing variation only.") }}</ion-note>
    <ion-note v-else-if="!row.variation" color="medium">{{ translate("Not run in this variation — showing parent only.") }}</ion-note>

    <!-- Summary: same numbers as the list row. -->
    <ion-card>
      <ion-card-header><ion-card-title>{{ translate("Summary") }}</ion-card-title></ion-card-header>
      <ion-card-content>
        <div class="cmp">
          <span class="metric"><span class="lbl">{{ translate("Eligible") }}</span><span>{{ pair("eligibleEntryCount") }}</span></span>
          <span class="metric"><span class="lbl">{{ translate("Brokered") }}</span><span>{{ pair("brokeredItemCount") }}</span></span>
          <span class="metric"><span class="lbl">{{ translate("Queued") }}</span><span>{{ pair("queuedItemCount") }}</span></span>
        </div>
        <p v-if="zeroEligible" class="sig-warn">{{ translate("0 eligible — filter matched nothing") }}</p>
      </ion-card-content>
    </ion-card>

    <template v-if="hasTraces && !zeroEligible">
      <!-- Outcome breakdown by finalReason. -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Outcomes") }}</ion-card-title></ion-card-header>
        <ion-card-content>
          <div class="cmp">
            <span v-for="reason in outcomeReasons" :key="reason" class="metric">
              <span class="lbl">{{ reasonLabel(reason) }}</span>
              <span>{{ outcomePair(reason) }}</span>
            </span>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Facilities brokered: parent vs variation item counts. -->
      <ion-card v-if="facilityRows.length">
        <ion-card-header><ion-card-title>{{ translate("Facilities brokered") }}</ion-card-title></ion-card-header>
        <ion-list>
          <ion-item v-for="f in facilityRows" :key="f.facilityId" lines="none">
            <ion-label>
              <h3>{{ facilityName(f.facilityId) }}</h3>
              <p v-if="bothSides">{{ f.parentQty }} → {{ f.variationQty }} ({{ f.delta >= 0 ? "+" : "" }}{{ f.delta }})</p>
              <p v-else>{{ row.variation ? f.variationQty : f.parentQty }} {{ translate("items") }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </ion-card>

      <!-- Queued orders, with newly-queued badge vs parent. -->
      <ion-card v-if="queuedItems.length">
        <ion-card-header><ion-card-title>{{ translate("Queued orders") }}</ion-card-title></ion-card-header>
        <ion-list>
          <ion-item v-for="q in queuedItems" :key="q.orderId + '|' + (q.shipGroupSeqId || '') + '|' + (q.orderItemSeqId || '')" lines="none">
            <ion-label>{{ q.orderId }}<span v-if="q.orderItemSeqId"> · {{ q.orderItemSeqId }}</span></ion-label>
            <ion-badge v-if="q.newlyQueued" slot="end" color="warning">{{ translate("newly queued") }}</ion-badge>
          </ion-item>
        </ion-list>
      </ion-card>

      <!-- Per-order outcomes: searchable, capped at 50 with load-more, rows expand to the rule narrative. -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Per-order outcomes") }}</ion-card-title></ion-card-header>
        <ion-searchbar v-model="query" :placeholder="translate('Search by order ID')" :debounce="300" />
        <ion-list>
          <ion-item v-for="t in visibleTraces" :key="traceKey(t)" button @click="toggle(traceKey(t))">
            <ion-label>
              <h3>{{ t.orderId }}<span v-if="t.orderItemSeqId"> · {{ t.orderItemSeqId }}</span></h3>
              <p>{{ reasonLabel(t.finalReason || "UNKNOWN") }}</p>
              <!-- Rule narrative lines are intentionally untranslated: diagnostic content that embeds
                   backend error messages; only UI chrome (labels above) goes through translate(). -->
              <template v-if="expanded.has(traceKey(t))">
                <p v-for="(line, i) in describeRuleAttempts(t)" :key="i">{{ line }}</p>
                <p v-for="(a, j) in t.finalAssignments ?? []" :key="j">
                  → {{ a.facilityId ? facilityName(a.facilityId) : translate("backordered") }} · {{ translate("qty") }} {{ a.routedQty }}
                </p>
              </template>
            </ion-label>
          </ion-item>
        </ion-list>
        <ion-button v-if="filteredTraces.length > visibleCount" fill="clear" @click="visibleCount += 50">
          {{ translate("Load more") }} ({{ filteredTraces.length - visibleCount }})
        </ion-button>
      </ion-card>
    </template>
    <p v-else-if="!zeroEligible" class="sig-info">{{ translate("Per-order detail not available for this run.") }}</p>

    <!-- Cost is group-level only until the backend enrichment lands (see trace-enrichment backend request spec). -->
    <p class="sig-info">{{ translate("Shipping cost is available at group level on the outcomes dashboard; per-routing cost is pending backend support.") }}</p>
  </ion-content>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { translate } from "@common";
import { IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSearchbar, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import type { CompareRow, OrderTrace, RoutingRunResult } from "@/types/variation";
import { compareFacilities, describeRuleAttempts, outcomeCounts, queuedDiff } from "@/utils/simulationResults";
// facilityNames is optional: the sim reference-data store that supplies names lives on the
// pinia3-atp-integration branch. Until that lands, callers omit it and raw facility ids show.
const props = defineProps<{ row: CompareRow; facilityNames?: Record<string, string> }>();
const row = props.row; // static capture is intentional: modalController sets props once per instance

const bothSides = computed(() => !!(row.parent && row.variation));
// The side whose detail we show: variation when present (it's the focus), else parent.
const detail = computed<RoutingRunResult | null>(() => row.variation ?? row.parent);
const detailTraces = computed<OrderTrace[]>(() => detail.value?.orderTraces ?? []);
const hasTraces = computed(() => detailTraces.value.length > 0);
const zeroEligible = computed(() => !!row.variation && row.variation.eligibleEntryCount === 0);

const n = (v: number | undefined) => (v == null ? "—" : String(v));
function pair(field: "eligibleEntryCount" | "brokeredItemCount" | "queuedItemCount"): string {
  if (!bothSides.value) return n(detail.value?.[field]);
  return `${n(row.parent?.[field])} → ${n(row.variation?.[field])}`;
}

const parentOutcomes = computed(() => outcomeCounts(row.parent?.orderTraces));
const variationOutcomes = computed(() => outcomeCounts(row.variation?.orderTraces));
function outcomePair(reason: string): string {
  if (!bothSides.value) return String((row.variation ? variationOutcomes.value : parentOutcomes.value)[reason] ?? 0);
  return `${parentOutcomes.value[reason] ?? 0} → ${variationOutcomes.value[reason] ?? 0}`;
}

const REASON_LABELS: Record<string, string> = {
  FULLY_BROKERED: "Fully brokered",
  PARTIALLY_BROKERED: "Partially brokered",
  QUEUED: "Queued",
  UNFILLABLE: "Unfillable",
  ERROR: "Error",
  UNKNOWN: "Unknown",
};
const REASON_ORDER = Object.keys(REASON_LABELS);
const outcomeReasons = computed(() => {
  const reasons = new Set([...Object.keys(parentOutcomes.value), ...Object.keys(variationOutcomes.value)]);
  return [...reasons].sort((a, b) => {
    const ia = REASON_ORDER.indexOf(a);
    const ib = REASON_ORDER.indexOf(b);
    return (ia === -1 ? REASON_ORDER.length : ia) - (ib === -1 ? REASON_ORDER.length : ib) || a.localeCompare(b, "en");
  });
});
const reasonLabel = (reason: string) => (Object.hasOwn(REASON_LABELS, reason) ? translate(REASON_LABELS[reason]) : reason);

const facilityRows = computed(() => compareFacilities(row.parent?.orderTraces, row.variation?.orderTraces));
// One-sided parent rows still list their queued items; no parent baseline -> no "newly queued" badges.
const queuedItems = computed(() => queuedDiff(row.variation ? row.parent?.orderTraces : undefined, detailTraces.value));

const query = ref("");
const visibleCount = ref(50);
watch(query, () => { visibleCount.value = 50; });
const filteredTraces = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return detailTraces.value;
  return detailTraces.value.filter((t) => t.orderId.toLowerCase().includes(q));
});
const visibleTraces = computed(() => filteredTraces.value.slice(0, visibleCount.value));

const expanded = ref(new Set<string>());
const traceKey = (t: OrderTrace) => `${t.orderId}|${t.orderItemSeqId ?? ""}|${t.shipGroupSeqId ?? ""}`;
function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  expanded.value = next;
}

function facilityName(facilityId: string): string {
  return props.facilityNames?.[facilityId] || facilityId;
}
function closeModal() {
  modalController.dismiss();
}
</script>

<style scoped>
.cmp { display: flex; gap: var(--spacer-base); flex-wrap: wrap; }
.metric { display: flex; flex-direction: column; }
.lbl { font-size: 0.75rem; color: var(--ion-color-medium); }
.sig-warn { color: var(--ion-color-warning); }
.sig-info { color: var(--ion-color-medium); }
</style>
