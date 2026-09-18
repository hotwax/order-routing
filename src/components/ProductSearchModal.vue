<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ selectedStyle ? translate("Select variants") : translate("Search products") }}</ion-title>
      <ion-buttons v-if="selectedStyle" slot="end">
        <ion-button @click="backToStyles">
          {{ translate("Back") }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
    <ion-toolbar v-if="!selectedStyle">
      <ion-searchbar
        :placeholder="translate('Search styles')"
        :value="keyword"
        :debounce="300"
        data-testid="style-search-bar"
        @ion-input="updateKeyword($event)"
      />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <!-- Style picker -->
    <template v-if="!selectedStyle">
      <ion-list v-if="styles.length" lines="full">
        <ion-item
          v-for="style in styles"
          :key="style.productId"
          button
          :detail="true"
          :class="{ 'style-selected': selectedCountForStyle(style) > 0 }"
          @click="openStyle(style)"
        >
          <ion-thumbnail slot="start">
            <DxpShopifyImg :src="style.mainImageUrl" />
          </ion-thumbnail>
          <ion-label class="ion-text-wrap">
            {{ style.productName || style.productId }}
            <p>{{ style.sku || style.productId }}</p>
          </ion-label>
          <span v-if="selectedCountForStyle(style)" class="selection-badge">
            {{ selectedCountForStyle(style) }} {{ translate("selected") }}
          </span>
        </ion-item>
      </ion-list>
      <div v-else-if="isLoading" class="modal-state">
        <ion-spinner name="crescent" />
      </div>
      <p v-else class="modal-state" data-testid="style-empty-state">
        {{ keyword ? translate("No styles found") : translate("Search for a style to see its variants") }}
      </p>
    </template>

    <!-- Variant picker -->
    <template v-else>
      <ion-item lines="full">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="selectedStyle.mainImageUrl" />
        </ion-thumbnail>
        <ion-label class="ion-text-wrap">
          {{ selectedStyle.productName || selectedStyle.productId }}
          <p>{{ translate("{count} variants", { count: variants.length }) }}</p>
        </ion-label>
        <ion-button slot="end" fill="clear" size="small" @click="toggleAllVariants">
          {{ allVariantsSelected ? translate("Clear all") : translate("Select all") }}
        </ion-button>
      </ion-item>
      <ion-list v-if="variants.length" lines="full">
        <ion-item
          v-for="variant in variants"
          :key="variant.productId"
          button
          :detail="false"
          :class="{ 'variant-selected': isVariantSelected(variant.productId) }"
          @click="toggleVariant(variant.productId)"
        >
          <ion-checkbox
            slot="start"
            :checked="isVariantSelected(variant.productId)"
            :aria-label="variant.productName || variant.productId"
          />
          <ion-thumbnail slot="start">
            <DxpShopifyImg :src="variant.mainImageUrl" />
          </ion-thumbnail>
          <ion-label class="ion-text-wrap">
            {{ variant.productName || variant.productId }}
            <p>{{ variant.sku || variant.productId }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
      <div v-else-if="isLoading" class="modal-state">
        <ion-spinner name="crescent" />
      </div>
      <p v-else class="modal-state">
        {{ translate("No variants found") }}
      </p>
    </template>
  </ion-content>

  <div v-if="selectedProductIds.length" class="selection-summary" data-testid="selected-products-summary">
    <div class="selection-summary-heading">
      <div>
        <strong>{{ selectedProductIds.length }} {{ translate(selectedProductIds.length === 1 ? "product selected" : "products selected") }}</strong>
        <p>{{ translate("Your selection stays active while you browse styles and variants.") }}</p>
      </div>
      <ion-button fill="clear" size="small" data-testid="clear-selected-products" @click="clearSelectedProducts">
        {{ translate("Clear all") }}
      </ion-button>
    </div>
    <div v-if="selectedProducts.length" class="selection-summary-products">
      <div v-for="product in selectedProducts.slice(0, 3)" :key="product.productId" class="selection-summary-product">
        <ion-thumbnail>
          <DxpShopifyImg :src="product.mainImageUrl" />
        </ion-thumbnail>
        <span>{{ product.productName || product.sku || product.productId }}</span>
      </div>
      <span v-if="selectedProductIds.length > 3" class="selection-summary-more">
        +{{ selectedProductIds.length - 3 }} {{ translate("more") }}
      </span>
    </div>
  </div>

  <ion-footer>
    <ion-toolbar>
      <ion-buttons slot="end">
        <ion-button fill="clear" @click="clearFilter">
          {{ translate("Clear filter") }}
        </ion-button>
        <ion-button
          fill="solid"
          :disabled="!selectedProductIds.length"
          data-testid="apply-product-filter"
          @click="applyFilter"
        >
          {{ translate("Show {count} products", { count: selectedProductIds.length }) }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
</template>

<script setup lang="ts">
import { DxpShopifyImg, translate } from "@common";
import {
  IonButton, IonButtons, IonCheckbox, IonContent, IonFooter, IonHeader, IonIcon, IonItem, IonLabel,
  IonList, IonSearchbar, IonSpinner, IonThumbnail, IonTitle, IonToolbar, modalController
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { computed, onMounted, ref } from "vue";
import { type ProductSummary, useProductSearch } from "@/composables/useProductSearch";

const props = defineProps<{ selectedProductIds?: string[] }>();

const { fetchProductSummaries, fetchVariants, searchStyles } = useProductSearch();

const keyword = ref("");
const styles = ref<ProductSummary[]>([]);
const variants = ref<ProductSummary[]>([]);
const selectedStyle = ref<ProductSummary | null>(null);
const selectedProductIds = ref<string[]>([...(props.selectedProductIds || [])]);
const selectedProductSummaries = ref<Record<string, ProductSummary>>({});
const isLoading = ref(false);
// Guards against an earlier slow response overwriting a newer one, same pattern as the inventory list.
let requestId = 0;

const selectedProducts = computed(() => selectedProductIds.value
  .map((productId) => selectedProductSummaries.value[productId])
  .filter(Boolean));

onMounted(() => {
  loadStyles();
  loadSelectedProductSummaries();
});

async function loadSelectedProductSummaries() {
  if(!selectedProductIds.value.length) {return;}
  const summaries = await fetchProductSummaries(selectedProductIds.value);
  selectedProductSummaries.value = summaries || {};
}

function rememberProductSummaries(productsToRemember: ProductSummary[]) {
  productsToRemember.forEach((product) => {
    selectedProductSummaries.value[product.productId] = product;
  });
}

async function loadStyles() {
  const currentRequest = ++requestId;
  isLoading.value = true;
  const result = await searchStyles(keyword.value);
  if(currentRequest !== requestId) {return;}
  styles.value = result.styles;
  isLoading.value = false;
}

async function updateKeyword(event: CustomEvent<{ value?: string | null }>) {
  keyword.value = event.detail.value || "";
  await loadStyles();
}

async function openStyle(style: ProductSummary) {
  const currentRequest = ++requestId;
  selectedStyle.value = style;
  isLoading.value = true;
  variants.value = [];
  const result = await fetchVariants(style.productId);
  if(currentRequest !== requestId) {return;}
  variants.value = result.variants;
  rememberProductSummaries(result.variants);
  isLoading.value = false;
}

function backToStyles() {
  requestId += 1;
  selectedStyle.value = null;
  variants.value = [];
  isLoading.value = false;
}

function isVariantSelected(productId: string) {
  return selectedProductIds.value.includes(productId);
}

function toggleVariant(productId: string) {
  selectedProductIds.value = isVariantSelected(productId)
    ? selectedProductIds.value.filter((id: string) => id !== productId)
    : [...selectedProductIds.value, productId];
}

function selectedCountForStyle(style: ProductSummary) {
  return selectedProducts.value.filter((product) => product.groupId === style.productId).length;
}

const allVariantsSelected = computed(() => variants.value.length > 0 &&
  variants.value.every((variant: ProductSummary) => isVariantSelected(variant.productId)));

function toggleAllVariants() {
  const variantIds = variants.value.map((variant: ProductSummary) => variant.productId);
  rememberProductSummaries(variants.value);
  selectedProductIds.value = allVariantsSelected.value
    ? selectedProductIds.value.filter((id: string) => !variantIds.includes(id))
    : [...new Set([...selectedProductIds.value, ...variantIds])];
}

function clearSelectedProducts() {
  selectedProductIds.value = [];
  selectedProductSummaries.value = {};
}

function applyFilter() {
  modalController.dismiss({ productIds: selectedProductIds.value });
}

function clearFilter() {
  modalController.dismiss({ productIds: [] });
}

function closeModal() {
  modalController.dismiss();
}
</script>

<style scoped>
.modal-state {
  display: flex;
  justify-content: center;
  padding: var(--spacer-lg);
}

.selection-summary {
  border-top: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-light, #f4f5f8);
  padding: var(--spacer-sm, 12px) var(--spacer-base, 16px);
}

.selection-summary-heading,
.selection-summary-products {
  display: flex;
  align-items: center;
  gap: var(--spacer-sm, 12px);
}

.selection-summary-heading {
  justify-content: space-between;
}

.selection-summary-heading strong {
  display: block;
}

.selection-summary-heading p {
  margin: 4px 0 0;
  color: var(--ion-color-medium-shade);
  font-size: 12px;
}

.selection-summary-products {
  margin-top: var(--spacer-sm, 12px);
  overflow: hidden;
}

.selection-summary-product {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.selection-summary-product span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.selection-summary-product ion-thumbnail {
  --size: 32px;
  flex: 0 0 auto;
}

.selection-summary-more,
.selection-badge {
  color: var(--ion-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

.style-selected {
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
}

.variant-selected {
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
}
</style>
