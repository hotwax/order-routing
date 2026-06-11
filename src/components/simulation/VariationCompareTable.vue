<template>
  <ion-list>
    <ion-list-header><ion-label>{{ translate("Per-routing results") }}</ion-label></ion-list-header>
    <ion-item v-for="row in rows" :key="row.routingName + (row.variationRoutingId || row.parentRoutingId)">
      <ion-label>
        <h3>{{ row.routingName }}</h3>
        <div class="cmp">
          <span class="metric">
            <span class="lbl">{{ translate("Eligible") }}</span>
            <span class="val">{{ n(row.parent?.eligibleEntryCount) }} → <strong>{{ n(row.variation?.eligibleEntryCount) }}</strong></span>
          </span>
          <span class="metric">
            <span class="lbl">{{ translate("Brokered") }}</span>
            <span class="val">{{ n(row.parent?.brokeredItemCount) }} → {{ n(row.variation?.brokeredItemCount) }}</span>
          </span>
          <span class="metric">
            <span class="lbl">{{ translate("Queued") }}</span>
            <span class="val">{{ n(row.parent?.queuedItemCount) }} → {{ n(row.variation?.queuedItemCount) }}</span>
          </span>
        </div>
        <p v-if="signal(row)" :class="signalClass(row)">{{ signal(row) }}</p>
      </ion-label>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { translate } from "@common";
import { IonItem, IonLabel, IonList, IonListHeader } from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import type { CompareRow } from "@/types/variation";

const store = variationStore();
const rows = computed<CompareRow[]>(() => store.compareRows);
const n = (v: number | undefined) => (v == null ? "—" : String(v));

// Distinguish "filtered out" (0 eligible) from "no inventory" (N eligible, 0 brokered).
function signal(row: CompareRow): string {
  const v = row.variation;
  if (!v) return translate("Not run in this variation");
  if (v.eligibleEntryCount === 0) return translate("0 eligible — filter matched nothing");
  if (v.brokeredItemCount === 0) return translate("Eligible but nothing brokered — no available inventory");
  return "";
}
function signalClass(row: CompareRow) {
  return row.variation && row.variation.eligibleEntryCount === 0 ? "sig-warn" : "sig-info";
}
</script>

<style scoped>
.cmp { display: flex; gap: var(--spacer-base); flex-wrap: wrap; }
.metric { display: flex; flex-direction: column; }
.lbl { font-size: 0.75rem; color: var(--ion-color-medium); }
.sig-warn { color: var(--ion-color-warning); }
.sig-info { color: var(--ion-color-medium); }
</style>
