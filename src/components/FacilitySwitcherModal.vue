<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Change location") }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="queryString" :placeholder="translate('Search by facility name or ID')" :debounce="200" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list v-if="filteredFacilities.length">
      <ion-radio-group :value="currentFacilityId">
        <ion-item
          v-for="facility in filteredFacilities"
          :key="facility.facilityId"
          v-lazy-inventory="facility.facilityId"
          lines="full"
          @click="selectFacility(facility)"
        >
          <ion-radio :value="facility.facilityId" label-placement="end" justify="start">
            <ion-label>
              {{ facility.facilityName || facility.facilityId }}
              <p>{{ facility.facilityId }}</p>
            </ion-label>
          </ion-radio>
          <div slot="end" class="facility-inv">
            <div class="stat">
              <span class="stat-value">{{ facility.qoh }}</span>
              <span class="stat-label">{{ translate("QOH") }}</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ facility.atp }}</span>
              <span class="stat-label">{{ translate("ATP") }}</span>
            </div>
          </div>
        </ion-item>
      </ion-radio-group>
    </ion-list>
    <EmptyState
      v-else
      variant="compact"
      :icon="searchOutline"
      :title="translate('No facilities match your search')"
      :message="translate('Try a different facility name or ID.')"
    />
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { closeOutline, searchOutline } from "ionicons/icons";
import { api, commonUtil, logger, translate } from "@common";
import { computed, onBeforeUnmount, ref, type ObjectDirective } from "vue";
import EmptyState from "@/components/EmptyState.vue";

const props = defineProps<{
  productId: string;
  currentFacilityId: string;
  facilities: any[];
}>();

const queryString = ref("");
const inventoryByFacility = ref<Record<string, { qoh: any; atp: any }>>({});
const pendingFacilityIds = new Set<string>();
const observedFacilityIds = new WeakMap<Element, string>();
let inventoryObserver: IntersectionObserver | undefined;

const facilitiesWithInventory = computed(() =>
  (props.facilities || []).map((facility: any) => {
    const inv = inventoryByFacility.value[facility.facilityId];
    return { ...facility, qoh: inv?.qoh ?? "-", atp: inv?.atp ?? "-" };
  })
);

const filteredFacilities = computed(() => {
  const q = queryString.value.trim().toLowerCase();
  if (!q) return facilitiesWithInventory.value;
  return facilitiesWithInventory.value.filter((facility: any) =>
    (facility.facilityName || "").toLowerCase().includes(q) || (facility.facilityId || "").toLowerCase().includes(q)
  );
});

function closeModal() {
  modalController.dismiss();
}

function selectFacility(facility: any) {
  modalController.dismiss({ facilityId: facility.facilityId });
}

async function fetchInventoryForFacility(facilityId: string) {
  if (!facilityId || inventoryByFacility.value[facilityId] || pendingFacilityIds.has(facilityId)) return;

  pendingFacilityIds.add(facilityId);
  try {
    const resp = await api({
      url: "oms/productFacilities/search",
      method: "GET",
      params: { productId: props.productId, facilityId, pageSize: 1 }
    }) as any;
    const record = resp && !commonUtil.hasError(resp) ? resp.data?.products?.[0] : undefined;
    inventoryByFacility.value = {
      ...inventoryByFacility.value,
      [facilityId]: {
        qoh: record?.inventoryConfig?.qoh ?? "-",
        atp: record?.inventoryConfig?.atp ?? "-"
      }
    };
  } catch (err) {
    logger.error("Failed to fetch inventory for facility", facilityId, err);
    inventoryByFacility.value = {
      ...inventoryByFacility.value,
      [facilityId]: { qoh: "-", atp: "-" }
    };
  } finally {
    pendingFacilityIds.delete(facilityId);
  }
}

function getInventoryObserver() {
  if (inventoryObserver) return inventoryObserver;
  if (typeof IntersectionObserver === "undefined") return undefined;

  inventoryObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const facilityId = observedFacilityIds.get(entry.target);
      if (!facilityId) return;
      fetchInventoryForFacility(facilityId);
      observer.unobserve(entry.target);
      observedFacilityIds.delete(entry.target);
    });
  });

  return inventoryObserver;
}

function observeFacilityRow(el: Element, facilityId: string) {
  if (!facilityId || inventoryByFacility.value[facilityId] || pendingFacilityIds.has(facilityId)) return;

  const observer = getInventoryObserver();
  if (!observer) {
    fetchInventoryForFacility(facilityId);
    return;
  }

  observedFacilityIds.set(el, facilityId);
  observer.observe(el);
}

function unobserveFacilityRow(el: Element) {
  inventoryObserver?.unobserve(el);
  observedFacilityIds.delete(el);
}

const vLazyInventory: ObjectDirective<HTMLElement, string> = {
  mounted(el, binding) {
    observeFacilityRow(el, binding.value);
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return;
    unobserveFacilityRow(el);
    observeFacilityRow(el, binding.value);
  },
  beforeUnmount(el) {
    unobserveFacilityRow(el);
  }
};

onBeforeUnmount(() => {
  inventoryObserver?.disconnect();
  inventoryObserver = undefined;
});
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: var(--spacer-base);
  color: var(--ion-color-medium);
}

.facility-inv {
  display: flex;
  gap: var(--spacer-lg);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 40px;
}
</style>
