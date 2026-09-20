<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Product calendar") }}</ion-title>
        <ion-button slot="end" fill="clear" :disabled="loading" @click="refresh">
          <ion-icon slot="icon-only" :icon="refreshOutline" />
        </ion-button>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <main v-if="!currentProductStore?.productStoreId" class="empty-page">
        <EmptyState :icon="calendarOutline" :title="translate('No product store selected')" :message="translate('Choose a product store to manage product calendar dates.')" />
      </main>
      <main v-else>
        <div class="page-heading">
          <div>
            <p class="overline">{{ currentProductStore.productStoreId }}</p>
            <h1>{{ translate("Product calendar") }}</h1>
            <p class="muted">{{ translate("ProductStore-scoped lifecycle dates used by ATP rules.") }}</p>
          </div>
          <div class="actions">
            <ion-button fill="outline" :disabled="loading || populating" @click="populate">
              {{ populating ? translate("Populating…") : translate("Populate from product defaults") }}
            </ion-button>
            <ion-button @click="showMapping = true">{{ translate("Add Shopify mapping") }}</ion-button>
          </div>
        </div>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Shopify metafield mappings") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Each mapping writes one Shopify metafield into a calendar date column for that shop’s ProductStore.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list v-if="visibleMappings.length">
            <ion-item v-for="mapping in visibleMappings" :key="`${mapping.shopId}:${mapping.mappedKey}`">
              <ion-label>
                <h2>{{ shopName(mapping.shopId) }}</h2>
                <p>{{ mapping.shopId }}</p>
              </ion-label>
              <ion-note slot="end">{{ mapping.mappedKey }} ← {{ mapping.mappedValue }}</ion-note>
            </ion-item>
          </ion-list>
          <ion-card-content v-else class="muted">{{ translate("No calendar metafield mappings configured for this ProductStore.") }}</ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Calendar dates") }}</ion-card-title>
            <ion-card-subtitle>{{ rows.length }} {{ translate("products") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-item lines="none"><ion-searchbar v-model="search" :placeholder="translate('Search by product name or ID')" /></ion-item>
          <ion-list v-if="filteredRows.length">
            <ion-item v-for="row in filteredRows" :key="`${row.productStoreId}:${row.productId}`">
              <ion-label>
                <h2>{{ row.productName || row.internalName || row.productId }}</h2>
                <p>{{ row.productId }}</p>
              </ion-label>
              <div class="date-grid">
                <span><b>{{ translate("Introduction") }}</b>{{ formatDate(row.introductionDate) }}</span>
                <span><b>{{ translate("Launch") }}</b>{{ formatDate(row.releaseDate) }}</span>
                <span><b>{{ translate("Support ends") }}</b>{{ formatDate(row.supportDiscontinuationDate) }}</span>
                <span><b>{{ translate("Sales ends") }}</b>{{ formatDate(row.salesDiscontinuationDate) }}</span>
              </div>
            </ion-item>
          </ion-list>
          <ion-card-content v-else class="muted">{{ loading ? translate("Loading…") : translate("No calendar rows match the current search.") }}</ion-card-content>
        </ion-card>

        <ion-modal :is-open="showMapping" @did-dismiss="showMapping = false">
          <ion-header><ion-toolbar><ion-title>{{ translate("Add Shopify calendar mapping") }}</ion-title><ion-button slot="end" fill="clear" @click="showMapping = false">{{ translate("Cancel") }}</ion-button></ion-toolbar></ion-header>
          <ion-content class="ion-padding">
            <ion-list>
              <ion-item><ion-select v-model="newMapping.shopId" :label="translate('Shop')" label-placement="stacked"><ion-select-option v-for="shop in shops" :key="shop.shopId" :value="shop.shopId">{{ shop.name || shop.shopId }}</ion-select-option></ion-select></ion-item>
              <ion-item><ion-select v-model="newMapping.mappedKey" :label="translate('Calendar date column')" label-placement="stacked"><ion-select-option v-for="field in calendarFields" :key="field" :value="field">{{ field }}</ion-select-option></ion-select></ion-item>
              <ion-item><ion-input v-model="newMapping.mappedValue" :label="translate('Metafield selector')" :placeholder="translate('namespace:key or definition ID')" label-placement="stacked" /></ion-item>
            </ion-list>
            <ion-button expand="block" :disabled="!newMapping.shopId || !newMapping.mappedKey || !newMapping.mappedValue || saving" @click="saveMapping">{{ saving ? translate("Saving…") : translate("Save mapping") }}</ion-button>
          </ion-content>
        </ion-modal>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonMenuButton, IonNote, IonPage, IonSearchbar, IonSelect, IonSelectOption, IonTitle, IonToolbar, IonModal } from "@ionic/vue";
import { calendarOutline, refreshOutline } from "ionicons/icons";
import { computed, onMounted, ref, watch } from "vue";
import { DateTime } from "luxon";
import { commonUtil, logger, translate } from "@common";
import EmptyState from "@/components/EmptyState.vue";
import { useAtpProductStore } from "@/store/atpProductStore";
import { PRODUCT_CALENDAR_DATE_FIELDS, useProductCalendarStore } from "@/store/productCalendarStore";

const productStore = useAtpProductStore();
const calendarStore = useProductCalendarStore();
const currentProductStore = computed(() => productStore.getCurrentProductStore);
const rows = computed(() => calendarStore.rows);
const mappings = computed(() => calendarStore.mappings);
const shops = computed(() => calendarStore.shops);
const visibleMappings = computed(() => {
  const shopIds = new Set(shops.value.map((shop: any) => shop.shopId));
  return mappings.value.filter((mapping: any) => shopIds.has(mapping.shopId));
});
const loading = computed(() => calendarStore.loading);
const search = ref("");
const populating = ref(false);
const saving = ref(false);
const showMapping = ref(false);
const calendarFields = PRODUCT_CALENDAR_DATE_FIELDS;
const newMapping = ref({ shopId: "", mappedKey: "releaseDate", mappedValue: "" });
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((row: any) => !q || `${row.productId || ""} ${row.productName || ""} ${row.internalName || ""}`.toLowerCase().includes(q));
});
const parseDate = (value: any) => {
  if (!value) return null;
  const iso = DateTime.fromISO(String(value));
  return iso.isValid ? iso : DateTime.fromSQL(String(value));
};
const formatDate = (value: any) => parseDate(value)?.toLocaleString(DateTime.DATETIME_MED) || "-";
const shopName = (shopId: string) => shops.value.find((shop: any) => shop.shopId === shopId)?.name || shopId;

async function refresh() {
  const id = currentProductStore.value?.productStoreId;
  if (!id) return;
  try { await Promise.all([calendarStore.fetchCalendar(id), calendarStore.fetchShops(id), calendarStore.fetchMappings()]); }
  catch (error) { logger.error("Failed to refresh product calendar", error); commonUtil.showToast(translate("Unable to load product calendar.")); }
}
async function populate() {
  const id = currentProductStore.value?.productStoreId;
  if (!id) return;
  populating.value = true;
  try { const result = await calendarStore.populate(id); commonUtil.showToast(translate(`Calendar populated: ${result?.processedCount || 0} products.`)); }
  catch (error) { logger.error("Failed to populate product calendar", error); commonUtil.showToast(translate("Unable to populate product calendar.")); }
  finally { populating.value = false; }
}
async function saveMapping() {
  const shop = shops.value.find((row: any) => row.shopId === newMapping.value.shopId);
  if (!shop) return;
  saving.value = true;
  try { await calendarStore.saveMapping(newMapping.value); showMapping.value = false; newMapping.value = { shopId: "", mappedKey: "releaseDate", mappedValue: "" }; commonUtil.showToast(translate("Shopify calendar mapping saved.")); }
  catch (error) { logger.error("Failed to save Shopify calendar mapping", error); commonUtil.showToast(translate("Unable to save calendar mapping.")); }
  finally { saving.value = false; }
}
watch(() => currentProductStore.value?.productStoreId, refresh);
onMounted(refresh);
</script>

<style scoped>
main { padding: var(--spacer-base); }
.page-heading { display: flex; justify-content: space-between; gap: var(--spacer-base); align-items: flex-start; margin-bottom: var(--spacer-base); }
.page-heading h1 { margin: 0; }
.actions { display: flex; gap: var(--spacer-xs); flex-wrap: wrap; }
.muted { color: var(--ion-color-medium); }
.date-grid { display: grid; grid-template-columns: repeat(4, minmax(115px, 1fr)); gap: var(--spacer-xs); min-width: 520px; font-size: .82rem; }
.date-grid span { display: flex; flex-direction: column; color: var(--ion-color-medium); }
.date-grid b { color: var(--ion-color-dark); font-weight: 600; }
.empty-page { height: 100%; display: grid; place-items: center; }
@media (max-width: 800px) { .page-heading { flex-direction: column; } .date-grid { min-width: 0; grid-template-columns: repeat(2, minmax(110px, 1fr)); } }
</style>
