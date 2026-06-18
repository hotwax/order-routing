<template>
  <ion-card class="preview-card">
    <ion-card-header>
      <div class="preview-head">
        <div>
          <ion-card-title>{{ translate("Matched products") }}</ion-card-title>
          <ion-card-subtitle>{{ translate("Products this rule will apply to") }}</ion-card-subtitle>
        </div>
        <ion-note v-if="!isLoading">{{ translate("products found", { count: total }) }}</ion-note>
      </div>
    </ion-card-header>

    <div class="preview-toolbar">
      <ion-searchbar :placeholder="translate('Search')" :value="searchQuery" :debounce="400" @ionInput="updateSearchQuery($event)" />
      <div class="pagination" v-if="total > pageSize">
        <ion-button fill="clear" size="small" :disabled="pageIndex === 0 || isLoading" @click="goToPreviousPage">
          <ion-icon slot="icon-only" :icon="caretBackOutline" />
        </ion-button>
        <ion-note color="medium">{{ pageIndex + 1 }} / {{ pageCount }}</ion-note>
        <ion-button fill="clear" size="small" :disabled="pageIndex >= pageCount - 1 || isLoading" @click="goToNextPage">
          <ion-icon slot="icon-only" :icon="caretForwardOutline" />
        </ion-button>
      </div>
    </div>

    <ion-card-content class="preview-body">
      <div class="empty-state" v-if="isLoading">
        <ion-spinner name="crescent" />
      </div>
      <template v-else-if="products.length">
        <div class="list-item" v-for="product in products" :key="product.productId">
          <ion-item lines="none">
            <ion-thumbnail slot="start">
              <DxpShopifyImg :src="product.mainImageUrl" />
            </ion-thumbnail>
            <ion-label>
              <h2>{{ product.parentProductName || product.productName || product.productId }}</h2>
              <p>{{ product.productId }}</p>
            </ion-label>
          </ion-item>
        </div>
      </template>
      <div class="empty-state" v-else>
        <ion-icon :icon="cubeOutline" />
        <p>{{ translate("No products match these filters yet.") }}</p>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonThumbnail
} from "@ionic/vue";
import { caretBackOutline, caretForwardOutline, cubeOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate } from '@common';
import { useAtpProductStore } from "@/store/atpProductStore";

const productStore = useAtpProductStore();

const pageSize = 25;
const products = ref<any[]>([]);
const total = ref(0);
const pageIndex = ref(0);
const isLoading = ref(false);
const searchQuery = ref("");

const appliedFilters = computed(() => productStore.getAppliedFilters);
const appliedFiltersOperator = computed(() => productStore.getAppliedFiltersOperator);
const pageCount = computed(() => Math.max(Math.ceil(total.value / pageSize), 1));

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => loadPreview());

// Refresh whenever the rule's product filters change. Debounced so rapid edits collapse into one query.
watch([appliedFilters, appliedFiltersOperator], () => {
  pageIndex.value = 0;
  scheduleReload();
}, { deep: true });

function scheduleReload() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadPreview(), 350);
}

async function loadPreview() {
  isLoading.value = true;
  const result = await productStore.previewProducts({
    viewSize: pageSize,
    viewIndex: pageIndex.value,
    keyword: searchQuery.value.trim() || undefined
  });
  products.value = result.products;
  total.value = result.total;
  isLoading.value = false;
}

function updateSearchQuery(event: CustomEvent<{ value?: string | null }>) {
  searchQuery.value = event.detail.value || "";
  pageIndex.value = 0;
  loadPreview();
}

function goToPreviousPage() {
  if (pageIndex.value === 0) return;
  pageIndex.value -= 1;
  loadPreview();
}

function goToNextPage() {
  if (pageIndex.value >= pageCount.value - 1) return;
  pageIndex.value += 1;
  loadPreview();
}
</script>

<style scoped>
.preview-card {
  margin: 0;
}

.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacer-xs);
}

.preview-head ion-note {
  flex-shrink: 0;
  white-space: nowrap;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
  padding-inline: var(--spacer-sm);
}

.preview-toolbar ion-searchbar {
  flex: 1;
  padding: 0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.preview-body {
  max-height: 60vh;
  overflow-y: auto;
}

.list-item {
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item ion-thumbnail {
  --size: 40px;
  --border-radius: 6px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacer-xs);
  padding: var(--spacer-2xl) var(--spacer-base);
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 32px;
}
</style>
