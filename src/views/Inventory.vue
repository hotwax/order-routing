<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title data-testid="closed-page-title">
          {{ translate("Inventory") }}
        </ion-title>
        <ion-segment slot="end" :value="searchMode" @ion-change="updateSearchMode($event)">
          <ion-segment-button value="location">
            <ion-label>{{ translate("Location") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="channel">
            <ion-label>{{ translate("Channel") }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content data-testid="closed-content">
      <ion-card>
        <ion-card-content class="filter-card-content">
          <ion-searchbar :placeholder="translate('Search')" :value="searchQuery" :debounce="300" data-testid="inventory-search-bar" @ion-input="updateSearchQuery($event)" />
          <div class="filter-controls">
            <ion-item v-if="searchMode === 'location'" lines="none">
              <ion-select v-model="selectedFacility" :label="translate('Facility')" interface="popover">
                <ion-select-option v-for="facility in productStoreFacilities" :key="facility.facilityId + facility.productStoreId" :value="facility.facilityId">
                  {{ facility.facilityName }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else lines="none">
              <ion-select v-model="selectedChannelId" :label="translate('Channel')" :placeholder="translate('Select channel')" interface="popover">
                <ion-select-option
                  v-for="channel in inventoryChannels"
                  :key="channel.facilityGroupId"
                  :value="channel.facilityGroupId"
                >
                  {{ channelOptionLabel(channel) }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </div>
        </ion-card-content>
      </ion-card>

      <ion-item v-if="scopeError" lines="full" class="channel-config-state">
        <ion-label class="ion-text-wrap">
          <h2>{{ translate("Inventory scope could not be loaded") }}</h2>
          <p>{{ translate(scopeError) }}</p>
        </ion-label>
      </ion-item>

      <ion-item v-if="!scopeError" lines="none">
        <ion-checkbox v-if="selectMode" slot="start" :checked="allCurrentPageSelected" :indeterminate="someCurrentPageSelected && !allCurrentPageSelected" @ion-change="toggleCurrentPageSelection($event.detail.checked)" />
        <ion-label>{{ translate("products found", { count: total }) }}</ion-label>
        <div slot="end" class="pagination">
          <ion-button slot="icon-only" fill="clear" :disabled="pageIndex === 0 || isLoading" @click="goToPreviousPage">
            <ion-icon :icon="caretBackOutline" />
          </ion-button>
          <ion-note color="medium">
            {{ pageIndex + 1 }} / {{ pageCount }}
          </ion-note>
          <ion-button slot="icon-only" fill="clear" :disabled="pageIndex >= pageCount - 1 || isLoading" @click="goToNextPage">
            <ion-icon :icon="caretForwardOutline" />
          </ion-button>
          <ion-button v-if="products.length && !channelNeedsConfig" fill="clear" size="small" @click="toggleSelectMode">
            {{ selectMode ? translate("Done") : translate("Select") }}
          </ion-button>
        </div>
      </ion-item>

      <ion-item v-if="!scopeError && channelNeedsConfig" lines="full" class="channel-config-state">
        <ion-label>
          <h2>{{ translate("No configuration facility linked") }}</h2>
          <p>{{ translate("Select a configuration facility to view inventory for this channel.") }}</p>
        </ion-label>
        <ion-button slot="end" fill="clear" @click="openChannelConfigModal">
          {{ translate("Add Config") }}
        </ion-button>
      </ion-item>

      <template v-if="!scopeError && showLoadingState">
        <div v-for="row in loadingRows" :key="`inventory-skeleton-${row}`" class="list-item inventory-skeleton-row">
          <ion-item lines="none">
            <ion-thumbnail slot="start" class="inventory-skeleton-thumbnail">
              <ion-skeleton-text animated />
            </ion-thumbnail>
            <ion-label class="inventory-skeleton-copy">
              <ion-skeleton-text animated class="inventory-skeleton-line inventory-skeleton-line-primary" />
              <ion-skeleton-text animated class="inventory-skeleton-line inventory-skeleton-line-secondary" />
            </ion-label>
          </ion-item>
          <div v-for="column in 5" :key="`inventory-skeleton-${row}-${column}`">
            <ion-label>
              <ion-skeleton-text animated class="inventory-skeleton-line inventory-skeleton-line-metric" />
              <p><ion-skeleton-text animated class="inventory-skeleton-line inventory-skeleton-line-label" /></p>
            </ion-label>
          </div>
        </div>
      </template>
      <p v-else-if="!scopeError && showEmptyState" class="empty-state" data-testid="closed-empty-state">
        {{ translate("No products found") }}
      </p>
      <template v-else-if="!scopeError">
        <div v-for="product in products" :key="product.productId" class="list-item" :class="{ 'channel-mode': searchMode === 'channel' }" @click="onRowClick(product.productId)">
          <ion-item lines="none">
            <ion-checkbox v-if="selectMode" slot="start" :checked="isSelected(product.productId)" @click.stop="toggleProductSelection(product.productId)" />
            <ion-thumbnail slot="start" data-testid="assigned-detail-product-thumbnail">
              <DxpShopifyImg :src="productById(product.productId).mainImageUrl" data-testid="assigned-detail-product-img" />
            </ion-thumbnail>
            <ion-label>
              <span data-testid="assigned-detail-product-primary-id">{{ getPrimaryProductIdentifier(product) }}</span>
              <p data-testid="assigned-detail-product-secondary-id">
                {{ getSecondaryProductIdentifier(product) }}
              </p>
            </ion-label>
          </ion-item>
          <template v-if="channelNeedsConfig">
            <div>
              <ion-label>
                -
                <p>{{ translate("Online ATP") }}</p>
              </ion-label>
            </div>
            <div />
            <div />
            <div />
            <div />
          </template>
          <template v-else-if="product.inventoryConfig">
            <div>
              <ion-label>
                {{ searchMode === "channel" ? (product.onlineAtp ?? "-") : product.inventoryConfig.atp }}
                <p>{{ translate(searchMode === "channel" ? "Online ATP" : "ATP") }}</p>
              </ion-label>
            </div>
            <div v-if="searchMode === 'location'">
              <ion-label>
                {{ product.inventoryConfig.qoh }}
                <p>{{ translate("QOH") }}</p>
              </ion-label>
            </div>
            <div>
              <ion-label>
                {{ product.inventoryConfig.minimumStock ?? "-" }}
                <p>{{ translate(searchMode === "channel" ? "Threshold" : "Safety Stock") }}</p>
              </ion-label>
            </div>
            <div>
              <ion-label>
                {{ product.inventoryConfig.allowPickup || "-" }}
                <p>{{ translate("Allow Pickup") }}</p>
              </ion-label>
            </div>
            <div>
              <ion-label>
                {{ product.inventoryConfig.allowBrokering || "-" }}
                <p>{{ translate("Allow Brokering") }}</p>
              </ion-label>
            </div>
            <div>
              <!-- placeholder -->
            </div>
          </template>
          <template v-else>
            <div />
            <div />
            <div />
            <div />
            <ion-button fill="clear" size="small" @click.stop="openProductFacilityConfigModal([product])">
              {{ translate("Add Config") }}
            </ion-button>
          </template>
        </div>
      </template>
    </ion-content>
    <ion-footer v-if="selectMode && !scopeError">
      <ion-toolbar class="footer-actions">
        <ion-buttons slot="start">
          <ion-button disabled>
            {{ selectedProductIds.length }} {{ translate("selected") }}
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button v-if="searchMode === 'location'" :disabled="!selectedProductIds.length" @click="openBulkInventoryEditModal">
            {{ translate("Adjust inventory") }}
          </ion-button>
          <ion-button :disabled="!selectedProductIds.length" @click="openProductFacilityConfigModal()">
            {{ translate("Adjust config") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { DxpShopifyImg, emitter, translate } from "@common";
import { IonButton, IonButtons, IonCard, IonCardContent, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonNote, IonPage, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSkeletonText, IonThumbnail, IonTitle, IonToolbar, modalController, onIonViewDidEnter, onIonViewDidLeave } from "@ionic/vue";
import { caretBackOutline, caretForwardOutline } from "ionicons/icons";
import { computed, nextTick, ref, watch } from "vue";
import LinkThresholdFacilitiesToGroupModal from "@/components/LinkThresholdFacilitiesToGroupModal.vue";
import ProductFacilityConfigEditModal from "@/components/ProductFacilityConfigEditModal.vue";
import ProductInventoryEdit from "@/components/ProductInventoryEdit.vue";
import { fetchProductOnlineAtpMap, mergeOnlineAtpIntoRows } from "@/composables/useChannelInventory";
import { useProductFacility } from "@/composables/useProductFacility";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useChannelStore } from "@/store/channel";
import { productStore as productInfoStore } from "@/store/product";
import { productStore } from "@/store/productStore";
import { inventoryScopeErrorMessage, inventoryScopeQuery, parseInventoryScope, resolveInventoryChannelId } from "@/utils/inventoryScope";
import { getPrimaryProductIdentifier as getPrimaryIdentifier, getSecondaryProductIdentifier as getSecondaryIdentifier } from "@/utils/productIdentifier";
import router from "../router";

const PAGE_SIZE = 50;
const pageIndex = ref(0);
const total = ref(0);
const isLoading = ref(false);
let listRequestId = 0;
let isApplyingRouteScope = false;

// Use a single composable instance so the reactive `products` ref and fetchProductFacility() below
// share the same per-instance state (see useProductFacility for why the singleton was removed).
const productFacilityApi = useProductFacility();
const { productFacility: products } = productFacilityApi;

const searchQuery = ref("");
const searchMode = ref<"location" | "channel">("location");
const scopeError = ref("");
const selectedFacility = ref("");
const selectedChannelId = ref("");

// Select mode: rows browse by default and only become selectable after the user enters select mode.
// Selection is tracked by stable product id, not by mutating row objects (#448).
const selectMode = ref(false);
const selectedProductIds = ref<string[]>([]);

const productStoreFacilities = computed(() => productStore().productStoreFacilities)
const channelStore = useChannelStore();
const inventoryChannels = computed(() => channelStore.getInventoryChannels.filter((group: any) => group.facilityGroupTypeId === "CHANNEL_FAC_GROUP"));
const selectedChannel = computed(() => inventoryChannels.value.find((group: any) => group.facilityGroupId === selectedChannelId.value));
const selectedChannelConfigFacilityId = computed(() => selectedChannel.value?.selectedConfigFacility?.facilityId || "");
const activeFacilityId = computed(() => searchMode.value === "channel" ? selectedChannelConfigFacilityId.value : selectedFacility.value);
const channelNeedsConfig = computed(() => searchMode.value === "channel" &&
  !!selectedChannel.value &&
  selectedChannel.value.facilityMembershipLoadState === "loaded" &&
  !selectedChannelConfigFacilityId.value);
const requestFacilityId = computed(() => activeFacilityId.value || (channelNeedsConfig.value ? selectedFacility.value : ""));
const productById = computed(() => (productId: string) => productInfoStore().getProductById(productId))
const productIdentificationPref = computed(() => productStore().getProductIdentificationPref)
const pageCount = computed(() => Math.max(Math.ceil(total.value / PAGE_SIZE), 1));
const showLoadingState = computed(() => isLoading.value && !products.value?.length);
const showEmptyState = computed(() => !isLoading.value && !products.value?.length);
const loadingRows = [1, 2, 3, 4, 5, 6];

const currentPageProductIds = computed(() => products.value.map((product: any) => product.productId))
const allCurrentPageSelected = computed(() => currentPageProductIds.value.length > 0 && currentPageProductIds.value.every((id: string) => selectedProductIds.value.includes(id)))
const someCurrentPageSelected = computed(() => currentPageProductIds.value.some((id: string) => selectedProductIds.value.includes(id)))
const selectedProducts = computed(() => products.value.filter((product: any) => selectedProductIds.value.includes(product.productId)))

async function onProductStoreOrConfigChanged() {
  isApplyingRouteScope = true;
  const routeScope = parseInventoryScope(router.currentRoute.value.query);
  try {
    const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
    if(productStoreId) {
      productStore().setEcomStore({ productStoreId });
    }
    pageIndex.value = 0;
    await Promise.all([
      productStore().fetchProductStoreFacilities(),
      channelStore.fetchInventoryChannels()
    ]);
    const routeFacilityExists = routeScope.type === "location" &&
      !!routeScope.facilityId &&
      productStoreFacilities.value?.some((facility: any) => facility.facilityId === routeScope.facilityId);
    const fallbackFacilityId = (productStoreFacilities.value?.some((facility: any) => facility.facilityId === productStore().selectedInventoryFacilityId)
      ? productStore().selectedInventoryFacilityId
      : productStoreFacilities.value?.[0]?.facilityId) || "";

    if(searchMode.value === "channel" && routeScope.type === "channel") {
      selectedChannelId.value = routeScope.channelId;
      selectedFacility.value = fallbackFacilityId;
      scopeError.value = channelScopeError(selectedChannel.value);
      await nextTick();
    } else {
      if(routeScope.type === "location" && routeScope.facilityId && !routeFacilityExists) {
        selectedFacility.value = "";
        scopeError.value = "The selected facility is not available for this product store.";
      } else {
        selectedFacility.value = routeFacilityExists && routeScope.type === "location"
          ? routeScope.facilityId
          : fallbackFacilityId;
      }
      // Vue batches watcher callbacks. Keep the route guard active until the selectedFacility
      // watcher has observed this programmatic assignment, otherwise it can rewrite an invalid
      // URL to a default facility and silently discard the original scope error.
      await nextTick();
    }
  } finally {
    isApplyingRouteScope = false;
  }

  if(routeScope.type === "location" && !routeScope.facilityId && !scopeError.value && selectedFacility.value) {
    syncSearchModeQuery();
  }
  await fetchProductFacility();
}

onIonViewDidEnter(async () => {
  const routeScope = parseInventoryScope(router.currentRoute.value.query);
  if(routeScope.type === "invalid") {
    scopeError.value = inventoryScopeErrorMessage(routeScope);
    products.value = [];
    total.value = 0;
    searchMode.value = "location";
    await onProductStoreOrConfigChanged();
    emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
    emitter.on("productStoreOrConfigChanged", onProductStoreOrConfigChanged);

    return;
  }
  scopeError.value = "";
  searchMode.value = routeScope.type === "channel" ? "channel" : "location";
  await onProductStoreOrConfigChanged();
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
  emitter.on("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
})

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
})

watch(selectedFacility, (facilityId) => {
  productStore().setSelectedInventoryFacilityId(facilityId)
  if(searchMode.value !== "location") {return}
  if(!isApplyingRouteScope) {scopeError.value = ""}
  selectedProductIds.value = []
  pageIndex.value = 0
  if(isApplyingRouteScope) {return}
  syncSearchModeQuery()
  fetchProductFacility()
})

watch(selectedChannelId, () => {
  if(searchMode.value !== "channel") {return}
  scopeError.value = channelScopeError(selectedChannel.value)
  selectedProductIds.value = []
  pageIndex.value = 0
  if(isApplyingRouteScope) {return}
  syncSearchModeQuery()
  if(!scopeError.value) {fetchProductFacility()}
})

function channelScopeError(channel: any) {
  if(!channel) {return "The selected channel is not available for this product store.";}
  if(channel.facilityMembershipLoadState === "error") {return "The channel configuration could not be loaded.";}
  if(channel.facilityMembershipLoadState === "ambiguous") {return "The selected channel has more than one configuration facility.";}

  return "";
}

async function updateSearchMode(event: any) {
  const nextMode = event.detail.value as "location" | "channel" | undefined;
  if(!nextMode || nextMode === searchMode.value) {return;}

  searchMode.value = nextMode;
  if(nextMode === "channel") {
    isApplyingRouteScope = true;
    try {
      selectedChannelId.value = resolveInventoryChannelId(inventoryChannels.value, selectedChannelId.value);
      await nextTick();
    } finally {
      isApplyingRouteScope = false;
    }
  }
  scopeError.value = nextMode === "channel" && selectedChannelId.value
    ? channelScopeError(selectedChannel.value)
    : "";
  selectedProductIds.value = [];
  pageIndex.value = 0;
  syncSearchModeQuery();
  if(!scopeError.value) {fetchProductFacility();}
}

function syncSearchModeQuery() {
  const query = inventoryScopeQuery(searchMode.value === "channel"
    ? { type: "channel", channelId: selectedChannelId.value }
    : { type: "location", facilityId: selectedFacility.value });
  router.replace({ path: "/inventory", query });
}

function channelOptionLabel(channel: any) {
  const label = channel.facilityGroupName || channel.facilityGroupId;

  return channel.selectedConfigFacility?.facilityId
    ? label
    : `${label} — ${translate("No configuration facility")}`;
}

async function openChannelConfigModal() {
  if(!selectedChannel.value) {return;}

  await useAtpProductStore().fetchConfigFacilities();
  const groupId = selectedChannel.value.facilityGroupId;
  const modal = await modalController.create({
    component: LinkThresholdFacilitiesToGroupModal,
    componentProps: {
      group: selectedChannel.value,
      selectedConfigFacilityId: selectedChannel.value.selectedConfigFacility,
      title: translate("Add Config")
    }
  });

  modal.onDidDismiss().then(async () => {
    await channelStore.fetchGroupFacilities(groupId);
    scopeError.value = channelScopeError(selectedChannel.value);
    await fetchProductFacility();
  });

  await modal.present();
}

function enterSelectMode() {
  selectMode.value = true
}

function exitSelectMode() {
  selectMode.value = false
  selectedProductIds.value = []
}

function toggleSelectMode() {
  selectMode.value ? exitSelectMode() : enterSelectMode()
}

function isSelected(productId: string) {
  return selectedProductIds.value.includes(productId)
}

function toggleProductSelection(productId: string) {
  if(selectedProductIds.value.includes(productId)) {
    selectedProductIds.value = selectedProductIds.value.filter((id: string) => id !== productId)
  } else {
    selectedProductIds.value = [...selectedProductIds.value, productId]
  }
}

function toggleCurrentPageSelection(checked: boolean) {
  if(checked) {
    const missingIds = currentPageProductIds.value.filter((id: string) => !selectedProductIds.value.includes(id))
    if(!missingIds.length) {return;}
    selectedProductIds.value = [...selectedProductIds.value, ...missingIds]
  } else {
    if(!currentPageProductIds.value.some((id: string) => selectedProductIds.value.includes(id))) {return;}
    selectedProductIds.value = selectedProductIds.value.filter((id: string) => !currentPageProductIds.value.includes(id))
  }
}

function onRowClick(productId: string) {
  selectMode.value ? toggleProductSelection(productId) : viewInventoryDetail(productId)
}

async function fetchProductFacility() {
  const requestId = ++listRequestId;
  if(scopeError.value) {
    productFacilityApi.clearProductFacility();
    total.value = 0;
    isLoading.value = false;

    return;
  }
  if((searchMode.value === "location" && !selectedFacility.value) || (searchMode.value === "channel" && !selectedChannelId.value)) {
    productFacilityApi.clearProductFacility();
    total.value = 0;
    isLoading.value = false;

    return;
  }

  isLoading.value = true
  const params = {
    pageSize: PAGE_SIZE,
    pageIndex: pageIndex.value
  } as Record<string, string | number>

  if(searchQuery.value.trim()) {
    params.keyword = searchQuery.value.trim();
  }

  if(requestFacilityId.value) {
    params.facilityId = requestFacilityId.value;
  }

  const nextTotal = await productFacilityApi.fetchProductFacility(params);
  if(requestId !== listRequestId || nextTotal === undefined) {return;}
  total.value = nextTotal;

  // Hydrate product info (image URLs, names) for the returned product ids so row thumbnails render.
  // productFacilities/search does not return image data, so without this the product info store has
  // no entry and DxpShopifyImg gets an empty src (issue #438). fetchProducts() skips already-cached ids.
  const productIds = [...new Set((products.value || []).map((product: any) => product.productId).filter(Boolean))];
  // Fire-and-forget: don't block the loader on image hydration. productById is reactive, so thumbnails
  // render progressively once the product info store populates; fetchProducts() skips already-cached ids.
  if(productIds.length) {
    productInfoStore().fetchProducts(productIds);
  }

  // Online ATP comes from get#ProductOnlineAtp, not productFacilities/search, so channel rows
  // hydrate it in a separate batched call — non-blocking, like the image hydration above.
  if(searchMode.value === "channel" && !channelNeedsConfig.value && productIds.length) {
    hydrateChannelOnlineAtp(requestId, productIds);
  }

  if(requestId === listRequestId) {isLoading.value = false}
}

async function hydrateChannelOnlineAtp(requestId: number, productIds: string[]) {
  const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
  if(!productStoreId || !selectedChannelId.value) {return;}
  const onlineAtpByProduct = await fetchProductOnlineAtpMap({
    productStoreId,
    facilityGroupId: selectedChannelId.value,
    productIds
  });
  if(requestId !== listRequestId) {return;}
  products.value = mergeOnlineAtpIntoRows(products.value, onlineAtpByProduct);
}

async function updateSearchQuery(event: CustomEvent<{ value?: string | null }>) {
  searchQuery.value = event.detail.value || ""
  pageIndex.value = 0
  selectedProductIds.value = []
  await fetchProductFacility()
}

async function goToPreviousPage() {
  if(pageIndex.value === 0) {return}

  pageIndex.value -= 1
  selectedProductIds.value = []
  await fetchProductFacility()
}

async function goToNextPage() {
  if(pageIndex.value >= pageCount.value - 1) {return}

  pageIndex.value += 1
  selectedProductIds.value = []
  await fetchProductFacility()
}

function viewInventoryDetail(productId: string) {
  const query = inventoryScopeQuery(searchMode.value === "channel"
    ? { type: "channel", channelId: selectedChannelId.value }
    : { type: "location", facilityId: selectedFacility.value });
  router.push({ path: `/inventory/${productId}`, query })
}

function getDisplayProduct(product: any) {
  return { ...product, ...productById.value(product.productId) };
}

function getPrimaryProductIdentifier(product: any) {
  const displayProduct = getDisplayProduct(product);

  return getPrimaryIdentifier(productIdentificationPref.value, displayProduct);
}

function getSecondaryProductIdentifier(product: any) {
  const displayProduct = getDisplayProduct(product);

  return getSecondaryIdentifier(productIdentificationPref.value, displayProduct);
}

async function openBulkInventoryEditModal() {
  if(searchMode.value !== "location" || !selectedProducts.value.length) {return;}
  const bulkInventoryEditModal = await modalController.create({
    component: ProductInventoryEdit,
    componentProps: {
      selectedFacility: activeFacilityId.value,
      selectedProducts: selectedProducts.value
    }
  })

  bulkInventoryEditModal.onDidDismiss().then((data) => {
    if(data?.data?.updated) {
      exitSelectMode();
      fetchProductFacility();
    }
  })

  await bulkInventoryEditModal.present()
}

async function openProductFacilityConfigModal(selectedProductsArg?: any[]) {
  const productsForModal = selectedProductsArg || selectedProducts.value;
  if(!productsForModal.length) {return;}
  const productFacilityConfigEditModal = await modalController.create({
    component: ProductFacilityConfigEditModal,
    componentProps: {
      selectedFacility: activeFacilityId.value,
      selectedProducts: productsForModal,
      scopeType: searchMode.value
    }
  })

  productFacilityConfigEditModal.onDidDismiss().then((data) => {
    if(data?.data?.updated) {
      exitSelectMode();
      fetchProductFacility();
    }
  })

  await productFacilityConfigEditModal.present()
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.list-item {
  --columns-desktop: 8;
  border-bottom : 1px solid var(--ion-color-medium);
  align-items: center;
  padding-inline-end: var(--spacer-base, 16px);
}

.list-item.channel-mode {
  --columns-desktop: 7;
}

.channel-config-state {
  margin-inline: var(--spacer-base, 16px);
}

.list-item > ion-item {
  width: 100%;
  grid-column: span 2;
}

.inventory-skeleton-row {
  pointer-events: none;
}

.inventory-skeleton-thumbnail ion-skeleton-text {
  width: 48px;
  height: 48px;
  border-radius: 8px;
}

.inventory-skeleton-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inventory-skeleton-line {
  margin: 0;
}

.inventory-skeleton-line-primary {
  width: 60%;
  height: 18px;
}

.inventory-skeleton-line-secondary {
  width: 40%;
  height: 14px;
}

.inventory-skeleton-line-metric {
  width: 50%;
  height: 18px;
}

.inventory-skeleton-line-label {
  width: 70%;
  height: 12px;
}

.filter-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs);
}

.filter-card-content ion-searchbar {
  padding: 0;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
}

.filter-controls ion-item {
  flex: 1 1 220px;
  min-width: 0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination .select-toggle {
  margin-inline-start: auto;
}

ion-toolbar::part(content) {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
</style>
