<template>
  <section class="pickup-analytics" v-if="loading || topProducts.length || topFacilities.length">
    <ion-card v-if="loading || topProducts.length">
      <ion-card-header>
        <div class="card-head">
          <ion-card-title>{{ translate("Top pickup products") }}</ion-card-title>
          <ion-note>{{ translate("Last 30 days") }}</ion-note>
        </div>
      </ion-card-header>
      <ion-card-content v-if="loading && !topProducts.length">
        <ion-skeleton-text animated style="width: 100%; height: 180px; border-radius: 8px" />
      </ion-card-content>
      <ion-card-content v-else>
        <div class="stat-list">
          <div class="stat-row has-thumb" v-for="(product, i) in topProducts" :key="product.productId">
            <span class="stat-rank">{{ i + 1 }}</span>
            <ion-thumbnail class="stat-thumb">
              <DxpShopifyImg :src="product.imageUrl" />
            </ion-thumbnail>
            <div class="stat-info">
              <ion-label class="stat-name">{{ product.productName }}</ion-label>
              <ion-note class="stat-id">{{ product.productId }}</ion-note>
            </div>
            <svg class="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" v-if="product.daily.length > 1">
              <polyline :points="sparkline(product.daily)" fill="none" stroke="var(--ion-color-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
            <span v-else class="sparkline" />
            <ion-note class="stat-count">{{ product.orderCount }}</ion-note>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <ion-card v-if="loading || topFacilities.length">
      <ion-card-header>
        <div class="card-head">
          <ion-card-title>{{ translate("Top pickup facilities") }}</ion-card-title>
          <ion-note>{{ translate("Last 30 days") }}</ion-note>
        </div>
      </ion-card-header>
      <ion-card-content v-if="loading && !topFacilities.length">
        <ion-skeleton-text animated style="width: 100%; height: 180px; border-radius: 8px" />
      </ion-card-content>
      <ion-card-content v-else>
        <div class="stat-list">
          <div class="stat-row" v-for="(facility, i) in topFacilities" :key="facility.facilityId">
            <span class="stat-rank">{{ i + 1 }}</span>
            <div class="stat-info">
              <ion-label class="stat-name">{{ facility.facilityName }}</ion-label>
              <ion-note class="stat-id">{{ facility.facilityId }}</ion-note>
            </div>
            <svg class="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" v-if="facility.daily.length > 1">
              <polyline :points="sparkline(facility.daily)" fill="none" stroke="var(--ion-color-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
            <span v-else class="sparkline" />
            <ion-note class="stat-count">{{ facility.orderCount }}</ion-note>
          </div>
        </div>
      </ion-card-content>
    </ion-card>
  </section>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonLabel, IonNote, IonSkeletonText, IonThumbnail } from "@ionic/vue";
import { computed } from "vue";
import { DxpShopifyImg, translate } from "@common";
import { usePickupAnalyticsStore } from "@/store/pickupAnalyticsStore";
import type { SparklineEntry } from "@/store/pickupAnalyticsStore";

const store = usePickupAnalyticsStore();

const loading = computed(() => store.loading);
const topProducts = computed(() => store.topProducts);
const topFacilities = computed(() => store.topFacilities);

function sparkline(daily: SparklineEntry[]): string {
  if (!daily.length) return "";
  const max = Math.max(...daily.map(d => d.count), 1);
  const step = 100 / Math.max(daily.length - 1, 1);
  return daily.map((d, i) => {
    const x = i * step;
    const y = 28 - (d.count / max) * 24 - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
</script>

<style scoped>
.pickup-analytics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--spacer-sm);
  padding: var(--spacer-base) var(--spacer-base) 0;
}

.card-head {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
}

.card-head ion-note {
  margin-inline-start: auto;
}

.stat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: grid;
  grid-template-columns: 20px 1fr 100px 48px;
  align-items: center;
  gap: 8px;
}

.stat-row.has-thumb {
  grid-template-columns: 20px 36px 1fr 100px 48px;
}

.stat-thumb {
  --size: 36px;
  --border-radius: 6px;
}

.stat-rank {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-align: center;
}

.stat-info {
  overflow: hidden;
}

.stat-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-id {
  display: block;
  font-size: 11px;
}

.sparkline {
  width: 100px;
  height: 28px;
}

.stat-count {
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
