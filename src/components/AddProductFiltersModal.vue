<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ type === "included" ? translate("Include", { label }) : translate("Exclude", { label }) }}</ion-title>
      <ion-buttons slot="end">
        <ion-button fill="clear" color="danger" :disabled="!selectedValues.length" @click="selectedValues = []">{{ translate("Clear All") }}</ion-button>
      </ion-buttons>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar :placeholder="translate('Search', { label })" v-model="queryString" @keyup.enter="search" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div class="selected-chips" v-if="selectedValues.length">
      <ion-chip v-for="filter in selectedValues" outline :key="filter">
        <ion-label>{{ countById[filter] != null ? `${filter}: ${countById[filter]}` : filter }}</ion-label>
        <ion-icon :icon="closeOutline" @click.stop="removeSelectedValue(filter)" />
      </ion-chip>
    </div>

    <!-- Live net matched-product total for the current (unsaved) modal selection. -->
    <ion-item lines="none" class="match-summary">
      <ion-spinner v-if="isCountLoading" name="dots" slot="start" />
      <ion-label color="medium">{{ translate("{count} matching products", { count: matchedCount }) }}</ion-label>
    </ion-item>

    <div class="empty-state" v-if="isLoading">
      <ion-item lines="none">
        <ion-spinner name="crescent" slot="start" />
        {{ translate("Fetching filters") }}
      </ion-item>
    </div>
    <ion-list v-else-if="filteredOptions.length">
      <ion-item v-for="option in filteredOptions" :key="option.id" :button="!isAlreadyApplied(option.id)" @click="!isAlreadyApplied(option.id) ? updateSelectedValues(option.id) : null">
        <ion-label>{{ option.label }}</ion-label>
        <ion-note v-if="countById[option.id] != null" slot="end">{{ countById[option.id] }}</ion-note>
        <ion-note v-if="isAlreadyApplied(option.id)" slot="end" color="danger">{{ type === 'included' ? translate("excluded") : translate("included") }}</ion-note>
        <ion-checkbox v-if="!isAlreadyApplied(option.id)" slot="end" :checked="selectedValues.includes(option.id)" />
      </ion-item>
    </ion-list>
    <div class="empty-state" v-else-if="!queryString">
      <p>{{ translate("Search for to find results", { label }) }}</p>
    </div>
    <div class="empty-state" v-else>
      <p>{{ translate("No result found for", { label: queryString }) }}</p>
    </div>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button @click="saveFilters()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { closeOutline, saveOutline } from 'ionicons/icons';
import { useAtpProductStore } from "@/store/atpProductStore";
import { translate } from '@common';

const facetOptions = ref([]) as any;
const queryString = ref('');
const selectedValues = ref([]) as any;
const filteredOptions = ref([]) as any;
const countById = ref<Record<string, number>>({});

const isLoading = ref(false);
const matchedCount = ref(0);
const isCountLoading = ref(false);
let countTimer: any = null;
let searchTimer: any = null;
let currentRequestId = 0;
let currentSearchRequestId = 0;
let isInitialLoad = true;
let facetCountsRequested = false;

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 100;

const props = defineProps(["label", "facetToSelect", "searchfield", "type"]);
const productStore = useAtpProductStore();

const appliedFilters = computed(() => productStore.getAppliedFilters);
const appliedFiltersOperator = computed(() => productStore.getAppliedFiltersOperator);

onMounted(() => {
  selectedValues.value = JSON.parse(JSON.stringify((appliedFilters.value as any)[props.type][props.searchfield]))
  void refreshMatchedCount();
})

onUnmounted(() => {
  if (countTimer) clearTimeout(countTimer);
  if (searchTimer) clearTimeout(searchTimer);
})

// Keep the modal cheap to open. Facet options are queried server-side only after the user types,
// and a short debounce avoids issuing a request for every keystroke.
watch(queryString, (value) => {
  if (searchTimer) clearTimeout(searchTimer);

  if (!value.trim()) {
    currentSearchRequestId += 1;
    facetOptions.value = [];
    filteredOptions.value = [];
    isLoading.value = false;
    return;
  }

  currentSearchRequestId += 1;
  isLoading.value = true;
  searchTimer = setTimeout(search, SEARCH_DEBOUNCE_MS);
})

// Recompute the live total (debounced) whenever the modal-local selection changes.
watch(selectedValues, () => {
  // Skip the initial set in onMounted (refreshMatchedCount is already called there) to avoid a duplicate request.
  if (isInitialLoad) {
    isInitialLoad = false;
    return;
  }
  isCountLoading.value = true;
  if (countTimer) clearTimeout(countTimer);
  countTimer = setTimeout(refreshMatchedCount, 350);
}, { deep: true })

async function refreshMatchedCount() {
  const requestId = ++currentRequestId;
  // Build a prospective applied-filters object: the saved filters with this side/field replaced by the
  // current unsaved modal selection, so the total reflects exactly what Save would produce.
  const prospectiveFilters = JSON.parse(JSON.stringify(appliedFilters.value))
  prospectiveFilters[props.type][props.searchfield] = selectedValues.value
  isCountLoading.value = true;
  try {
    const { total } = await productStore.previewProducts({
      filters: prospectiveFilters,
      operator: appliedFiltersOperator.value,
      countOnly: true
    })
    // Ignore a stale response that resolved after a newer request was issued.
    if (requestId !== currentRequestId) return;
    matchedCount.value = total;
  } catch (error) {
    console.error(error);
  } finally {
    if (requestId === currentRequestId) {
      isCountLoading.value = false;
    }
  }
}

function closeModal() {
  modalController.dismiss({ dismissed: true });
}

async function search() {
  if (searchTimer) clearTimeout(searchTimer);
  const searchTerm = queryString.value.trim();
  if (!searchTerm) return;

  const requestId = ++currentSearchRequestId;
  isLoading.value = true;
  try {
    const options = await productStore.fetchProductFilters({
      facetToSelect: props.facetToSelect,
      searchfield: props.searchfield,
      queryString: searchTerm,
      limit: SEARCH_RESULT_LIMIT,
      maxResults: SEARCH_RESULT_LIMIT
    })
    if (requestId !== currentSearchRequestId) return;
    facetOptions.value = options || [];
    filteredOptions.value = [...facetOptions.value];
    loadFacetCounts();
  } finally {
    if (requestId === currentSearchRequestId) {
      isLoading.value = false;
    }
  }
}

function loadFacetCounts() {
  if (facetCountsRequested) return;
  facetCountsRequested = true;
  productStore.fetchProductFacetCounts(props.searchfield)
    .then((counts: Record<string, number>) => { countById.value = counts })
}

function updateSelectedValues(value: string) {
  selectedValues.value.includes(value) ? selectedValues.value.splice(selectedValues.value.indexOf(value), 1) : selectedValues.value.push(value);
}

function removeSelectedValue(value: string) {
  selectedValues.value = selectedValues.value.filter((filter: string) => filter !== value)
}

function isAlreadyApplied(value: string) {
  const type = props.type === 'included' ? 'excluded' : 'included'
  return (appliedFilters.value as any)[type][props.searchfield].includes(value)
}

async function saveFilters() {
  const selectedFilters = JSON.parse(JSON.stringify(appliedFilters.value))
  selectedFilters[props.type][props.searchfield] = selectedValues.value

  await productStore.updateAppliedFilters(selectedFilters)
  modalController.dismiss()
}
</script>

<style scoped>
  ion-content {
    --padding-bottom: 80px;
  }

  .selected-chips {
    display: flex;
    flex-wrap: wrap;
    padding: 0 var(--spacer-sm, 8px);
  }

  .match-summary {
    --min-height: 36px;
    font-size: 0.9rem;
  }
</style>
