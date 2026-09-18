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
          <div class="filter-controls">
            <ion-item v-if="searchMode === 'location'" lines="none" button detail data-testid="inventory-facility-switcher" @click="openFacilitySwitcher">
              <ion-label>
                {{ translate(multipleFacilitiesSelected ? "Facilities" : "Facility") }}
                <p>{{ selectedFacilityName || translate("Select facility") }}</p>
              </ion-label>
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
            <ion-item lines="none">
              <ion-select :value="sortField" :label="translate('Sort by')" interface="popover" data-testid="inventory-sort-select" @ion-change="updateSortField($event)">
                <ion-select-option v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ translate(option.label) }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item lines="none">
              <ion-select v-model="configFilters.allowBrokering" :label="translate('Allow Brokering')" interface="popover" @ion-change="applyConfigFilters">
                <ion-select-option value="">
                  {{ translate("Any") }}
                </ion-select-option>
                <ion-select-option value="Y">
                  {{ translate("Yes") }}
                </ion-select-option>
                <ion-select-option value="N">
                  {{ translate("No") }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item lines="none">
              <ion-select v-model="configFilters.allowPickup" :label="translate('Allow Pickup')" interface="popover" @ion-change="applyConfigFilters">
                <ion-select-option value="">
                  {{ translate("Any") }}
                </ion-select-option>
                <ion-select-option value="Y">
                  {{ translate("Yes") }}
                </ion-select-option>
                <ion-select-option value="N">
                  {{ translate("No") }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </div>
          <!-- Product search is a modal now: pick a style, then its variants. The list itself is a
               ProductFacility query, so a free-text box here would search the wrong thing. -->
          <div class="filter-controls">
            <ion-button fill="outline" size="default" data-testid="open-product-search" @click="openProductSearchModal">
              <ion-icon slot="start" :icon="searchOutline" />
              {{ translate("Search products") }}
            </ion-button>
          </div>
          <div v-if="productIdFilter.length" class="product-filter-summary" data-testid="product-filter-summary">
            <div class="product-filter-summary-header">
              <div>
                <span class="product-filter-summary-eyebrow">{{ translate("Product filter") }}</span>
                <strong>{{ translate("{count} products selected", { count: productIdFilter.length }) }}</strong>
                <p>{{ translate("These products are pinned to this inventory search.") }}</p>
              </div>
              <div class="product-filter-summary-actions">
                <ion-button fill="clear" size="small" data-testid="edit-product-filter" @click="openProductSearchModal">
                  {{ translate("Edit") }}
                </ion-button>
                <ion-button fill="clear" size="small" data-testid="clear-product-filter" @click="clearProductFilter">
                  <ion-icon slot="icon-only" :icon="closeCircleOutline" />
                </ion-button>
              </div>
            </div>
            <div v-if="selectedProductFilterProducts.length" class="product-filter-summary-products">
              <div v-for="product in selectedProductFilterProducts.slice(0, 3)" :key="product.productId" class="product-filter-summary-product">
                <ion-thumbnail>
                  <DxpShopifyImg :src="product.mainImageUrl" />
                </ion-thumbnail>
                <div>
                  <strong>{{ getPrimaryProductIdentifier(product) }}</strong>
                  <p>{{ getSecondaryProductIdentifier(product) }}</p>
                  <small>{{ product.productName || product.parentProductName || product.productId }}</small>
                </div>
              </div>
              <span v-if="productIdFilter.length > 3" class="product-filter-summary-more">
                +{{ productIdFilter.length - 3 }} {{ translate("more selected") }}
              </span>
            </div>
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
        <!-- The count and page position describe the scope being left, so they skeleton out alongside
             the rows while a new facility or channel loads. -->
        <ion-label v-if="showLoadingState">
          <ion-skeleton-text animated class="inventory-skeleton-line inventory-skeleton-line-secondary" />
        </ion-label>
        <ion-label v-else>
          {{ translate("products found", { count: total }) }}
        </ion-label>
        <div slot="end" class="pagination">
          <ion-button slot="icon-only" fill="clear" data-testid="inventory-prev-page" :disabled="pageIndex === 0 || isLoading" @click="goToPreviousPage">
            <ion-icon :icon="caretBackOutline" />
          </ion-button>
          <ion-note color="medium">
            <ion-skeleton-text v-if="showLoadingState" animated class="inventory-skeleton-line inventory-skeleton-page-position" />
            <template v-else>
              {{ pageIndex + 1 }} / {{ pageCount }}
            </template>
          </ion-note>
          <ion-button slot="icon-only" fill="clear" data-testid="inventory-next-page" :disabled="pageIndex >= pageCount - 1 || isLoading" @click="goToNextPage">
            <ion-icon :icon="caretForwardOutline" />
          </ion-button>
          <ion-button v-if="products.length && !channelNeedsConfig && !showLoadingState && !multipleFacilitiesSelected" fill="clear" size="small" @click="toggleSelectMode">
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
        <div v-for="product in products" :key="productRowKey(product)" class="list-item" :class="{ 'channel-mode': searchMode === 'channel' }" @click="onRowClick(product)">
          <ion-item lines="none">
            <ion-checkbox v-if="selectMode" slot="start" :checked="isSelected(product.productId)" @click.stop="toggleProductSelection(product.productId)" />
            <ion-thumbnail slot="start" data-testid="assigned-detail-product-thumbnail">
              <DxpShopifyImg :src="getDisplayProduct(product).mainImageUrl" data-testid="assigned-detail-product-img" />
            </ion-thumbnail>
            <ion-label>
              <span data-testid="assigned-detail-product-primary-id">{{ getPrimaryProductIdentifier(product) }}</span>
              <p data-testid="assigned-detail-product-secondary-id">
                {{ getSecondaryProductIdentifier(product) }}
              </p>
              <p v-if="multipleFacilitiesSelected" data-testid="inventory-row-facility">
                {{ facilityName(product.facilityId) || product.facilityId }}
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
          <template v-else>
            <!-- Fields come straight off the ProductFacility row now. Location scope reads ATP/QOH
                 from the view's InventoryItem join; channel scope has no join, showing online ATP. -->
            <div>
              <ion-label>
                {{ searchMode === "channel" ? (product.onlineAtp ?? "-") : (product.availableToPromise ?? "-") }}
                <p>{{ translate(searchMode === "channel" ? "Online ATP" : "ATP") }}</p>
              </ion-label>
            </div>
            <div v-if="searchMode === 'location'">
              <ion-label>
                {{ product.quantityOnHand ?? "-" }}
                <p>{{ translate("QOH") }}</p>
              </ion-label>
            </div>
            <div>
              <ion-label>
                {{ product.minimumStock ?? "-" }}
                <p>{{ translate(searchMode === "channel" ? "Threshold" : "Safety Stock") }}</p>
              </ion-label>
            </div>
            <div>
              <ion-label>
                {{ product.allowPickup || "-" }}
                <p>{{ translate("Allow Pickup") }}</p>
              </ion-label>
            </div>
            <div>
              <ion-label>
                {{ product.allowBrokering || "-" }}
                <p>{{ translate("Allow Brokering") }}</p>
              </ion-label>
            </div>
            <div>
              <!-- placeholder -->
            </div>
          </template>
        </div>

        <!-- Every listed row is a ProductFacility row, so "not configured here" can no longer appear
             mid-list. It can still happen for a product picked in the search modal that this facility
             does not stock, so those are surfaced separately rather than silently omitted. -->
        <template v-if="unstockedFilteredProducts.length">
          <ion-item lines="full" class="channel-config-state">
            <ion-label class="ion-text-wrap">
              <h2>{{ translate("Not stocked at this facility") }}</h2>
              <p>{{ translate("These selected products have no configuration here yet.") }}</p>
            </ion-label>
          </ion-item>
          <div v-for="product in unstockedFilteredProducts" :key="`unstocked-${product.productId}`" class="list-item" :class="{ 'channel-mode': searchMode === 'channel' }">
            <ion-item lines="none">
              <ion-thumbnail slot="start">
                <DxpShopifyImg :src="product.mainImageUrl" />
              </ion-thumbnail>
              <ion-label>
                <span>{{ product.productName || product.productId }}</span>
                <p>{{ product.sku || product.productId }}</p>
              </ion-label>
            </ion-item>
            <div />
            <div />
            <div />
            <div />
            <ion-button fill="clear" size="small" @click.stop="openProductFacilityConfigModal([product])">
              {{ translate("Add Config") }}
            </ion-button>
          </div>
        </template>
      </template>
    </ion-content>
    <ion-footer v-if="selectMode && !scopeError && !multipleFacilitiesSelected">
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
import { IonButton, IonButtons, IonCard, IonCardContent, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel, IonNote, IonPage, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSkeletonText, IonThumbnail, IonTitle, IonToolbar, modalController, onIonViewDidEnter, onIonViewDidLeave } from "@ionic/vue";
import { caretBackOutline, caretForwardOutline, closeCircleOutline, searchOutline } from "ionicons/icons";
import { computed, nextTick, ref, watch } from "vue";
import LinkThresholdFacilitiesToGroupModal from "@/components/LinkThresholdFacilitiesToGroupModal.vue";
import ProductFacilityConfigEditModal from "@/components/ProductFacilityConfigEditModal.vue";
import ProductInventoryEdit from "@/components/ProductInventoryEdit.vue";
import MultiFacilitySwitcherModal from "@/components/MultiFacilitySwitcherModal.vue";
import ProductSearchModal from "@/components/ProductSearchModal.vue";
import { fetchProductOnlineAtpMap, mergeOnlineAtpIntoRows } from "@/composables/useChannelInventory";
import { useProductFacility } from "@/composables/useProductFacility";
import { useProductSearch } from "@/composables/useProductSearch";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useChannelStore } from "@/store/channel";
import { productStore as productInfoStore } from "@/store/product";
import { productStore } from "@/store/productStore";
import { inventoryListQuery, inventoryScopeErrorMessage, inventoryScopeQuery, parseInventoryListQuery, parseInventoryListScope, resolveInventoryChannelId } from "@/utils/inventoryScope";
import { getPrimaryProductIdentifier as getPrimaryIdentifier, getSecondaryProductIdentifier as getSecondaryIdentifier } from "@/utils/productIdentifier";
import router from "../router";

const PAGE_SIZE = 50;
const pageIndex = ref(0);
const total = ref(0);
const isLoading = ref(false);
// Set while the inventory scope itself is changing (facility, channel, or scope mode) rather than
// during a same-scope refetch like paging or search. ATP/QOH/safety stock are per-facility, so the
// rows already on screen belong to the facility the user just left. Without this the list keeps
// showing them until the new response lands and they read as the newly selected facility's numbers.
const isScopeSwitching = ref(false);
let listRequestId = 0;
let isApplyingRouteScope = false;

// Use a single composable instance so the reactive `products` ref and fetchProductFacility() below
// share the same per-instance state (see useProductFacility for why the singleton was removed).
const productFacilityApi = useProductFacility();
const { fetchProductSummaries } = useProductSearch();
const { productFacility: products } = productFacilityApi;

const searchMode = ref<"location" | "channel">("location");
// Product ids chosen in ProductSearchModal. Empty means "everything this facility stocks".
const productIdFilter = ref<string[]>([]);
// Solr detail for the current page, keyed by productId. Rows still render without it (see getDisplayProduct).
const productSummaries = ref<Record<string, any>>({});
const selectedProductFilterSummaries = ref<Record<string, any>>({});
// Any alias on the view is sortable; "-" prefix is Moqui's descending marker.
// Operators open this page to find stock problems, so lead with the largest ATP rather than an
// arbitrary id order.
const LOCATION_DEFAULT_SORT = "-availableToPromise";
// Channel scope queries the plain entity, which has no InventoryItem aliases, so it cannot sort on ATP.
const CHANNEL_DEFAULT_SORT = "-minimumStock";
const sortField = ref(LOCATION_DEFAULT_SORT);
const configFilters = ref({ allowBrokering: "", allowPickup: "", minimumStockFrom: "", atpFrom: "" });
// Every entry must be a real alias on ProductFacilityInventoryItemView: EntityFind silently drops an
// unknown orderByField, which would look like "sorting is broken" with no error anywhere.
const LOCATION_SORT_OPTIONS = [
  { value: "productName", label: "Product name (A–Z)" },
  { value: "-productName", label: "Product name (Z–A)" },
  { value: "-availableToPromise", label: "ATP (high to low)" },
  { value: "availableToPromise", label: "ATP (low to high)" },
  { value: "-quantityOnHand", label: "QOH (high to low)" },
  { value: "-computedInventoryCount", label: "Computed count (high to low)" },
  { value: "computedInventoryCount", label: "Computed count (low to high)" },
  { value: "-minimumStock", label: "Safety stock (high to low)" },
  { value: "-lastInventoryCount", label: "Last inventory count (high to low)" }
];
// Channel scope queries the plain entity, so the InventoryItem-derived aliases are not available.
const CHANNEL_SORT_OPTIONS = [
  { value: "-minimumStock", label: "Threshold (high to low)" },
  { value: "minimumStock", label: "Threshold (low to high)" },
  { value: "-lastInventoryCount", label: "Last inventory count (high to low)" }
];
const scopeError = ref("");
const selectedFacilityIds = ref<string[]>([]);
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
const selectedFacilityName = computed(() =>
  selectedFacilityIds.value.length > 1
    ? `${selectedFacilityIds.value.length} ${translate("facilities selected")}`
    : (productStoreFacilities.value || []).find((facility: any) => facility.facilityId === selectedFacilityIds.value[0])?.facilityName || "");
const multipleFacilitiesSelected = computed(() => searchMode.value === "location" && selectedFacilityIds.value.length > 1);
const activeFacilityId = computed(() => searchMode.value === "channel" ? selectedChannelConfigFacilityId.value : selectedFacilityIds.value[0] || "");
const channelNeedsConfig = computed(() => searchMode.value === "channel" &&
  !!selectedChannel.value &&
  selectedChannel.value.facilityMembershipLoadState === "loaded" &&
  !selectedChannelConfigFacilityId.value);
const requestFacilityId = computed(() => activeFacilityId.value || (channelNeedsConfig.value ? selectedFacilityIds.value[0] || "" : ""));
const productById = computed(() => (productId: string) => productInfoStore().getProductById(productId))
const productIdentificationPref = computed(() => productStore().getProductIdentificationPref)
const pageCount = computed(() => Math.max(Math.ceil(total.value / PAGE_SIZE), 1));
const sortOptions = computed(() => searchMode.value === "channel" ? CHANNEL_SORT_OPTIONS : LOCATION_SORT_OPTIONS);
const selectedProductFilterProducts = computed(() => productIdFilter.value
  .map((productId: string) => ({ productId, ...(selectedProductFilterSummaries.value[productId] || {}) })));
// Products the user picked in the search modal that this facility has no ProductFacility row for.
// Only meaningful while a product filter is active: without one the list is simply everything stocked.
const unstockedFilteredProducts = computed(() => {
  if(!productIdFilter.value.length) {return []}
  const stocked = new Set((products.value || []).map((product: any) => product.productId));

  return productIdFilter.value
    .filter((productId: string) => !stocked.has(productId))
    .map((productId: string) => ({ productId, ...(productSummaries.value[productId] || {}) }));
});
const showLoadingState = computed(() => isLoading.value && (isScopeSwitching.value || !products.value?.length));
const showEmptyState = computed(() => !isLoading.value && !products.value?.length);
const loadingRows = [1, 2, 3, 4, 5, 6];

const currentPageProductIds = computed(() => products.value.map((product: any) => product.productId))
const allCurrentPageSelected = computed(() => currentPageProductIds.value.length > 0 && currentPageProductIds.value.every((id: string) => selectedProductIds.value.includes(id)))
const someCurrentPageSelected = computed(() => currentPageProductIds.value.some((id: string) => selectedProductIds.value.includes(id)))
const selectedProducts = computed(() => products.value.filter((product: any) => selectedProductIds.value.includes(product.productId)))

async function onProductStoreOrConfigChanged({ preservePage = false } = {}) {
  isApplyingRouteScope = true;
  const routeScope = parseInventoryListScope(router.currentRoute.value.query);
  try {
    const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
    if(productStoreId) {
      productStore().setEcomStore({ productStoreId });
    }
    if(!preservePage) {pageIndex.value = 0;}
    await Promise.all([
      productStore().fetchProductStoreFacilities(),
      channelStore.fetchInventoryChannels()
    ]);
    const routeFacilityExists = routeScope.type === "location" &&
      routeScope.facilityIds.length > 0 &&
      routeScope.facilityIds.every((facilityId: string) =>
        productStoreFacilities.value?.some((facility: any) => facility.facilityId === facilityId));
    const fallbackFacilityId = (productStoreFacilities.value?.some((facility: any) => facility.facilityId === productStore().selectedInventoryFacilityId)
      ? productStore().selectedInventoryFacilityId
      : productStoreFacilities.value?.[0]?.facilityId) || "";

    if(searchMode.value === "channel" && routeScope.type === "channel") {
      selectedChannelId.value = routeScope.channelId;
      selectedFacilityIds.value = fallbackFacilityId ? [fallbackFacilityId] : [];
      scopeError.value = channelScopeError(selectedChannel.value);
      await nextTick();
    } else if(routeScope.type === "invalid") {
      selectedFacilityIds.value = [];
      scopeError.value = inventoryScopeErrorMessage(routeScope);
    } else {
      if(routeScope.type === "location" && routeScope.facilityIds.length && !routeFacilityExists) {
        selectedFacilityIds.value = [];
        scopeError.value = routeScope.facilityIds.length > 1
          ? "The selected facilities are not available for this product store."
          : "The selected facility is not available for this product store.";
      } else {
        selectedFacilityIds.value = routeFacilityExists && routeScope.type === "location"
          ? routeScope.facilityIds
          : (fallbackFacilityId ? [fallbackFacilityId] : []);
      }
      // Vue batches watcher callbacks. Keep the route guard active until the selectedFacilityIds
      // watcher has observed this programmatic assignment, otherwise it can rewrite an invalid
      // URL to a default facility and silently discard the original scope error.
      await nextTick();
    }
  } finally {
    isApplyingRouteScope = false;
  }

  if(routeScope.type === "location" && !routeScope.facilityIds.length && !scopeError.value && selectedFacilityIds.value.length) {
    syncInventoryQuery();
  }
  await fetchProductFacility({ scopeChanged: true });
}

const onProductStoreOrConfigChangedEvent = () => onProductStoreOrConfigChanged();

onIonViewDidEnter(async () => {
  const routeListQuery = parseInventoryListQuery(router.currentRoute.value.query);
  const routeScope = parseInventoryListScope(router.currentRoute.value.query);
  if(routeScope.type === "invalid") {
    scopeError.value = inventoryScopeErrorMessage(routeScope);
    products.value = [];
    total.value = 0;
    searchMode.value = "location";
    sortField.value = routeListQuery.sortField || LOCATION_DEFAULT_SORT;
    productIdFilter.value = routeListQuery.productIds;
    configFilters.value = {
      allowBrokering: routeListQuery.allowBrokering,
      allowPickup: routeListQuery.allowPickup,
      minimumStockFrom: routeListQuery.minimumStockFrom,
      atpFrom: routeListQuery.availableToPromiseFrom
    };
    pageIndex.value = routeListQuery.pageIndex;
    await onProductStoreOrConfigChanged({ preservePage: true });
    emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChangedEvent);
    emitter.on("productStoreOrConfigChanged", onProductStoreOrConfigChangedEvent);

    return;
  }
  scopeError.value = "";
  searchMode.value = routeScope.type === "channel" ? "channel" : "location";
  sortField.value = routeListQuery.sortField || (searchMode.value === "channel" ? CHANNEL_DEFAULT_SORT : LOCATION_DEFAULT_SORT);
  productIdFilter.value = routeListQuery.productIds;
  configFilters.value = {
    allowBrokering: routeListQuery.allowBrokering,
    allowPickup: routeListQuery.allowPickup,
    minimumStockFrom: routeListQuery.minimumStockFrom,
    atpFrom: routeListQuery.availableToPromiseFrom
  };
  pageIndex.value = routeListQuery.pageIndex;
  await onProductStoreOrConfigChanged({ preservePage: true });
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChangedEvent);
  emitter.on("productStoreOrConfigChanged", onProductStoreOrConfigChangedEvent);
})

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChangedEvent);
})

watch(selectedFacilityIds, (facilityIds) => {
  productStore().setSelectedInventoryFacilityId(facilityIds[0] || "")
  if(searchMode.value !== "location") {return}
  selectedProductIds.value = []
  if(facilityIds.length > 1) {exitSelectMode()}
  if(isApplyingRouteScope) {return}
  scopeError.value = ""
  pageIndex.value = 0
  syncInventoryQuery()
  fetchProductFacility({ scopeChanged: true })
})

watch(selectedChannelId, () => {
  if(searchMode.value !== "channel") {return}
  scopeError.value = channelScopeError(selectedChannel.value)
  selectedProductIds.value = []
  if(isApplyingRouteScope) {return}
  pageIndex.value = 0
  syncInventoryQuery()
  if(!scopeError.value) {fetchProductFacility({ scopeChanged: true })}
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
  // The plain entity has no InventoryItem aliases, so an ATP/QOH sort carried into channel scope would
  // be silently dropped by EntityFind and look like sorting had stopped working.
  if(!sortOptions.value.some((option: any) => option.value === sortField.value)) {sortField.value = "productId"}
  if(nextMode === "channel") {configFilters.value.atpFrom = ""}
  selectedProductIds.value = [];
  pageIndex.value = 0;
  syncInventoryQuery();
  if(!scopeError.value) {fetchProductFacility({ scopeChanged: true });}
}

function syncInventoryQuery() {
  const query = inventoryListQuery(searchMode.value === "channel"
    ? { type: "channel", channelId: selectedChannelId.value }
    : { type: "location", facilityIds: selectedFacilityIds.value }, {
      productIds: productIdFilter.value,
      sortField: sortField.value,
      allowBrokering: configFilters.value.allowBrokering,
      allowPickup: configFilters.value.allowPickup,
      minimumStockFrom: configFilters.value.minimumStockFrom,
      availableToPromiseFrom: configFilters.value.atpFrom,
      pageIndex: pageIndex.value
    });
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
    // Linking a config facility changes which facility backs this channel, so the rows are re-scoped.
    await fetchProductFacility({ scopeChanged: true });
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

function onRowClick(product: any) {
  selectMode.value ? toggleProductSelection(product.productId) : viewInventoryDetail(product.productId, product.facilityId)
}

// Pass scopeChanged when the facility, channel, or scope mode changed, so the list falls back to the
// skeleton instead of leaving the previous scope's rows on screen. Same-scope refetches (paging,
// search, post-edit refresh) omit it and keep their rows visible while the new page loads.
async function fetchProductFacility({ scopeChanged = false } = {}) {
  const requestId = ++listRequestId;
  // Assigned before the first await so the skeleton replaces the stale rows on this tick.
  if(scopeChanged) {isScopeSwitching.value = true}
  if(scopeError.value) {
    productFacilityApi.clearProductFacility();
    total.value = 0;
    isLoading.value = false;
    isScopeSwitching.value = false;

    return;
  }
  if((searchMode.value === "location" && !selectedFacilityIds.value.length) || (searchMode.value === "channel" && !selectedChannelId.value)) {
    productFacilityApi.clearProductFacility();
    total.value = 0;
    isLoading.value = false;
    isScopeSwitching.value = false;

    return;
  }

  isLoading.value = true
  const params = {
    pageSize: PAGE_SIZE,
    pageIndex: pageIndex.value,
    orderByField: sortField.value
  } as Record<string, string | number>

  if(searchMode.value === "location" && selectedFacilityIds.value.length) {
    params.facilityId = selectedFacilityIds.value.join(",");
    if(selectedFacilityIds.value.length > 1) {params.facilityId_op = "in";}
  } else if(requestFacilityId.value) {
    params.facilityId = requestFacilityId.value;
  }

  // Product search is no longer a keyword against the list: users pick a style and its variants in
  // ProductSearchModal, and those ids narrow the entity query.
  if(productIdFilter.value.length) {
    params.productId = productIdFilter.value.join(",");
    params.productId_op = "in";
  }

  Object.assign(params, activeConfigFilterParams());

  // Channel scope reads config only — its inventory number is online ATP, fetched separately below —
  // so it queries the plain ProductFacility entity and never pays for the InventoryItem join.
  const result = await productFacilityApi.fetchProductFacilityRows(params, { withInventory: searchMode.value === "location" });
  if(requestId !== listRequestId || result === undefined) {return;}
  total.value = result.total;
  const lastPageIndex = Math.max(Math.ceil(result.total / PAGE_SIZE) - 1, 0);
  if(pageIndex.value > lastPageIndex) {
    pageIndex.value = lastPageIndex;
    syncInventoryQuery();
  }

  // The entity rows carry productId but no product detail, so names, SKUs and images come from Solr.
  // Awaited (unlike the old fire-and-forget hydration) because entity-first rows have nothing else to
  // show: without it every row would read as a bare product id.
  const productIds = [...new Set((products.value || []).map((product: any) => product.productId).filter(Boolean))];
  if(productIds.length) {
    const summaries = await fetchProductSummaries(productIds);
    if(requestId !== listRequestId) {return;}
    productSummaries.value = summaries;
    const filterSummaries: Record<string, any> = {};
    productIdFilter.value.forEach((productId: string) => {
      if(summaries[productId]) {filterSummaries[productId] = summaries[productId];}
    });
    const missingFilterProductIds = productIdFilter.value.filter((productId: string) => !filterSummaries[productId]);
    if(missingFilterProductIds.length) {
      Object.assign(filterSummaries, await fetchProductSummaries(missingFilterProductIds));
    }
    selectedProductFilterSummaries.value = filterSummaries;
  } else {
    productSummaries.value = {};
    selectedProductFilterSummaries.value = {};
  }

  // Online ATP comes from get#ProductOnlineAtp, so channel rows hydrate it in a separate batched call.
  if(searchMode.value === "channel" && !channelNeedsConfig.value && productIds.length) {
    hydrateChannelOnlineAtp(requestId, productIds);
  }

  if(requestId === listRequestId) {
    isLoading.value = false;
    isScopeSwitching.value = false;
  }
}

/** Config filters map straight onto entity fields; ranges use Moqui's _from/_thru find-form suffixes. */
function activeConfigFilterParams() {
  const params = {} as Record<string, string | number>;
  if(configFilters.value.allowBrokering) {params.allowBrokering = configFilters.value.allowBrokering}
  if(configFilters.value.allowPickup) {params.allowPickup = configFilters.value.allowPickup}
  if(configFilters.value.minimumStockFrom !== "") {params.minimumStock_from = configFilters.value.minimumStockFrom}
  if(searchMode.value === "location" && configFilters.value.atpFrom !== "") {params.availableToPromise_from = configFilters.value.atpFrom}

  return params;
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

// The list supports a multi-facility filter; InventoryDetail keeps its own single-facility switcher.
// No productId here: this is the list, so the modal only needs the store's facility list.
async function openFacilitySwitcher() {
  const modal = await modalController.create({
    component: MultiFacilitySwitcherModal,
    componentProps: {
      currentFacilityIds: selectedFacilityIds.value,
      facilities: productStoreFacilities.value
    }
  });
  await modal.present();
  const { data } = await modal.onDidDismiss();
  if(Array.isArray(data?.facilityIds) && data.facilityIds.length) {
    const nextFacilityIds = [...new Set<string>(data.facilityIds.map((facilityId: any) => String(facilityId)))];
    if(nextFacilityIds.join(",") !== selectedFacilityIds.value.join(",")) {
      selectedFacilityIds.value = nextFacilityIds;
    }
  }
}

async function openProductSearchModal() {
  const modal = await modalController.create({
    component: ProductSearchModal,
    componentProps: { selectedProductIds: productIdFilter.value }
  });
  modal.onDidDismiss().then(async (result: any) => {
    // Dismissing without applying returns no data; only an explicit apply/clear changes the filter.
    if(!result?.data) {return;}
    productIdFilter.value = result.data.productIds || [];
    pageIndex.value = 0;
    selectedProductIds.value = [];
    syncInventoryQuery();
    // The visible rows change to a different product set, so show the skeleton rather than the old rows.
    await fetchProductFacility({ scopeChanged: true });
  });

  return modal.present();
}

async function clearProductFilter() {
  if(!productIdFilter.value.length) {return;}
  productIdFilter.value = [];
  pageIndex.value = 0;
  selectedProductIds.value = [];
  syncInventoryQuery();
  await fetchProductFacility({ scopeChanged: true });
}

async function updateSortField(event: CustomEvent) {
  const nextSort = event.detail.value as string | undefined;
  if(!nextSort || nextSort === sortField.value) {return;}
  sortField.value = nextSort;
  pageIndex.value = 0;
  selectedProductIds.value = [];
  syncInventoryQuery();
  await fetchProductFacility({ scopeChanged: true });
}

async function applyConfigFilters() {
  pageIndex.value = 0;
  selectedProductIds.value = [];
  syncInventoryQuery();
  await fetchProductFacility({ scopeChanged: true });
}

async function goToPreviousPage() {
  if(pageIndex.value === 0) {return}

  pageIndex.value -= 1
  selectedProductIds.value = []
  syncInventoryQuery();
  await fetchProductFacility()
}

async function goToNextPage() {
  if(pageIndex.value >= pageCount.value - 1) {return}

  pageIndex.value += 1
  selectedProductIds.value = []
  syncInventoryQuery();
  await fetchProductFacility()
}

function viewInventoryDetail(productId: string, facilityId?: string) {
  const query = inventoryScopeQuery(searchMode.value === "channel"
    ? { type: "channel", channelId: selectedChannelId.value }
    : { type: "location", facilityId: facilityId || selectedFacilityIds.value[0] || "" });
  router.push({ path: `/inventory/${productId}`, query })
}

function facilityName(facilityId: string) {
  return (productStoreFacilities.value || []).find((facility: any) => facility.facilityId === facilityId)?.facilityName || "";
}

function productRowKey(product: any) {
  return `${product.productId}-${product.facilityId || "no-facility"}`;
}

// Entity row first, then whatever Solr knows about the product. A row with no Solr document still
// renders — it is a real ProductFacility row for this facility, so hiding it would recreate the
// mismatch between the list and what the facility actually stocks.
function getDisplayProduct(product: any) {
  return { ...product, ...productById.value(product.productId), ...(productSummaries.value[product.productId] || {}) };
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
  if(searchMode.value !== "location" || selectedFacilityIds.value.length !== 1 || !selectedProducts.value.length) {return;}
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
  if(!productsForModal.length || (searchMode.value === "location" && selectedFacilityIds.value.length !== 1)) {return;}
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

/* Sized in px, like the thumbnail placeholder above: this sits in the flex pagination row where a
   percentage width has no basis, and it holds the width the "1 / N" note gave up. */
.inventory-skeleton-page-position {
  width: 48px;
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

/* The row is a flex container without align-items, so it defaults to stretch and pulls the chip up
   to the height of its tallest sibling. At that height Ionic's 16px chip radius stops reading as a
   pill and turns into a rounded rectangle, so let the chip keep its own 32px. */
.filter-controls ion-chip {
  align-self: center;
}

.product-filter-summary {
  border: 1px solid var(--ion-color-medium-tint);
  border-radius: 12px;
  background: var(--ion-color-light, #f4f5f8);
  padding: var(--spacer-sm, 12px);
}

.product-filter-summary-header,
.product-filter-summary-products {
  display: flex;
  align-items: center;
  gap: var(--spacer-sm, 12px);
}

.product-filter-summary-header {
  justify-content: space-between;
}

.product-filter-summary-eyebrow {
  display: block;
  color: var(--ion-color-medium-shade);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.product-filter-summary-header strong {
  display: block;
  margin-top: 2px;
}

.product-filter-summary-header p {
  margin: 3px 0 0;
  color: var(--ion-color-medium-shade);
  font-size: 12px;
}

.product-filter-summary-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.product-filter-summary-products {
  margin-top: var(--spacer-sm, 12px);
  overflow: hidden;
}

.product-filter-summary-product {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.product-filter-summary-product ion-thumbnail {
  --size: 40px;
  flex: 0 0 auto;
}

.product-filter-summary-product > div {
  min-width: 0;
}

.product-filter-summary-product strong,
.product-filter-summary-product p,
.product-filter-summary-product small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-filter-summary-product p,
.product-filter-summary-product small {
  margin: 2px 0 0;
  color: var(--ion-color-medium-shade);
  font-size: 11px;
}

.product-filter-summary-more {
  color: var(--ion-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

/* Keep the action controls from stretching the summary card to the full filter row height. */
.product-filter-summary ion-button {
  margin: 0;
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
