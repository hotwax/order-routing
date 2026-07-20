<template>
  <section class="pickup-analytics">
    <div class="analytics-section">
      <div class="section-head">
        <h2>{{ translate("Top pickup products") }}</h2>
        <ion-note>{{ translate("Last 30 days") }}</ion-note>
      </div>
      <div class="chip-scroll" v-if="loading && !topProducts.length">
        <ion-skeleton-text v-for="n in 5" :key="n" animated class="chip-skeleton" />
      </div>
      <div class="chip-scroll" v-else-if="topProducts.length">
        <div class="stat-chip" v-for="product in topProducts" :key="product.productId">
          <ion-thumbnail class="chip-thumb">
            <DxpShopifyImg :src="product.imageUrl" />
          </ion-thumbnail>
          <div class="chip-body">
            <ion-label class="chip-name">{{ getPrimaryProductIdentifier(productIdentificationPref, product) }}</ion-label>
            <div class="chip-meta">
              <ion-note class="chip-id">{{ getSecondaryProductIdentifier(productIdentificationPref, product) }}</ion-note>
              <ion-badge class="chip-count" color="primary">{{ product.orderCount }}</ion-badge>
            </div>
          </div>
          <svg class="chip-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none" v-if="product.daily.length > 1">
            <polyline :points="sparkline(product.daily)" fill="none" stroke="var(--ion-color-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <p class="empty-state" v-else>
        {{ translate("No pickup products ordered") }}
      </p>
    </div>

    <div class="analytics-section">
      <div class="section-head">
        <h2>{{ translate("Top pickup facilities") }}</h2>
        <ion-note>{{ translate("Last 30 days") }}</ion-note>
      </div>
      <div class="chip-scroll" v-if="loading && !topFacilities.length">
        <ion-skeleton-text v-for="n in 5" :key="n" animated class="chip-skeleton" />
      </div>
      <div class="chip-scroll" v-else-if="topFacilities.length">
        <div class="stat-chip" v-for="facility in topFacilities" :key="facility.facilityId">
          <div class="chip-body">
            <ion-label class="chip-name">{{ facility.facilityName }}</ion-label>
            <div class="chip-meta">
              <ion-note class="chip-id">{{ facility.facilityId }}</ion-note>
              <ion-badge class="chip-count" color="primary">{{ facility.orderCount }}</ion-badge>
            </div>
          </div>
          <svg class="chip-sparkline" viewBox="0 0 60 20" preserveAspectRatio="none" v-if="facility.daily.length > 1">
            <polyline :points="sparkline(facility.daily)" fill="none" stroke="var(--ion-color-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <p class="empty-state" v-else>
        {{ translate("No facilities fulfilled pickup orders") }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { IonBadge, IonLabel, IonNote, IonSkeletonText, IonThumbnail } from "@ionic/vue";
import { computed } from "vue";
import { DxpShopifyImg, translate } from "@common";
import { usePickupAnalyticsStore } from "@/store/pickupAnalyticsStore";
import type { SparklineEntry } from "@/store/pickupAnalyticsStore";
import { productStore } from "@/store/productStore";
import { getPrimaryProductIdentifier, getSecondaryProductIdentifier } from "@/utils/productIdentifier";

const store = usePickupAnalyticsStore();
const prodStore = productStore();

const loading = computed(() => store.loading);
const topProducts = computed(() => store.topProducts);
const topFacilities = computed(() => store.topFacilities);
const productIdentificationPref = computed(() => (prodStore as any).getProductIdentificationPref || { primaryId: "", secondaryId: "" });

function sparkline(daily: SparklineEntry[]): string {
  if (!daily.length) return "";
  const max = Math.max(...daily.map(d => d.count), 1);
  const step = 60 / Math.max(daily.length - 1, 1);
  return daily.map((d, i) => {
    const x = i * step;
    const y = 18 - (d.count / max) * 16 - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

</script>

<style scoped>
.pickup-analytics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacer-sm);
  padding: var(--spacer-base) 0 0;
}

.analytics-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs);
  max-width: 100%;
}

.analytics-section>* {
  padding-inline: var(--spacer-base);
}

.section-head {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
}

.section-head ion-note {
  margin-inline-start: auto;
}

.chip-scroll {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 380px) {
  .chip-scroll {
    grid-template-columns: 1fr;
  }
}

.chip-skeleton {
  height: 72px;
  border-radius: 12px;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--ion-border-color, var(--ion-color-light-shade));
  background: var(--ion-item-background, var(--ion-background-color));
}

.chip-thumb {
  --size: 36px;
  --border-radius: 6px;
  flex-shrink: 0;
}

.chip-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chip-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chip-id {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.chip-count {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  flex-shrink: 0;
}

.chip-sparkline {
  width: 48px;
  height: 20px;
  flex-shrink: 0;
}
</style>
