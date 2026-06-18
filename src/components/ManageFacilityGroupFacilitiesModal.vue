<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ group.facilityGroupName }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="queryString" @keyup.enter="fetchFacilities()" :debounce="300" @ionInput="fetchFacilities()" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div class="empty-state" v-if="isLoading">
      <ion-item lines="none">
        <ion-spinner name="crescent" slot="start" />
        {{ translate("Fetching facilities") }}
      </ion-item>
    </div>
    <ion-list v-else-if="facilities.length">
      <ion-item lines="none" v-for="facility in facilities" :key="facility.facilityId" @click="toggleFacility(facility)">
        <ion-checkbox :checked="isSelected(facility.facilityId)">
          <ion-label>
            {{ facility.facilityName }}
            <p>{{ facility.facilityId }}</p>
          </ion-label>
        </ion-checkbox>
      </ion-item>
    </ion-list>
    <EmptyState
      v-else
      variant="compact"
      :icon="searchOutline"
      :title="translate('No facilities match your search')"
      :message="translate('Adjust your search to find facilities to add.')"
    />

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!isDirty || isSaving" @click="save()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { closeOutline, saveOutline, searchOutline } from "ionicons/icons";
import { api, commonUtil, emitter, logger, translate } from "@common";
import { computed, onMounted, ref } from "vue";
import { useFacilityGroupStore } from "@/store/facilityGroupStore";
import { useAtpProductStore } from "@/store/atpProductStore";
import EmptyState from "@/components/EmptyState.vue";

const props = defineProps<{ group: any }>();

const facilityGroupStore = useFacilityGroupStore();
const productStore = useAtpProductStore();

const queryString = ref("");
const facilities = ref<any[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);

const initiallySelectedIds = ref<Set<string>>(new Set());
const selectedIds = ref<Set<string>>(new Set());

const isDirty = computed(() => {
  if (selectedIds.value.size !== initiallySelectedIds.value.size) return true;
  for (const id of selectedIds.value) {
    if (!initiallySelectedIds.value.has(id)) return true;
  }
  return false;
});

function closeModal() {
  modalController.dismiss();
}

function isSelected(id: string) {
  return selectedIds.value.has(id);
}

function toggleFacility(facility: any) {
  const id = facility.facilityId;
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  selectedIds.value = new Set(selectedIds.value);
}

async function fetchFacilities() {
  isLoading.value = true;
  try {
    const params: any = {
      productStoreId: productStore.currentProductStore?.productStoreId,
      pageSize: 200,
      parentFacilityTypeId: "VIRTUAL_FACILITY",
      parentFacilityTypeId_not: "Y",
      facilityTypeId: "VIRTUAL_FACILITY",
      facilityTypeId_not: "Y"
    };
    if (queryString.value) {
      params.facilityName = queryString.value;
      params.facilityName_op = "contains";
    }
    const resp = await api({
      url: `admin/productStores/${params.productStoreId}/facilities`,
      method: "GET",
      params
    }) as any;
    if (!commonUtil.hasError(resp)) {
      facilities.value = resp.data || [];
    } else {
      facilities.value = [];
    }
  } catch (err) {
    logger.error("Failed to fetch facilities", err);
    facilities.value = [];
  }
  isLoading.value = false;
}

async function save() {
  isSaving.value = true;
  emitter.emit("presentLoader");
  try {
    const toAdd = [...selectedIds.value].filter((id) => !initiallySelectedIds.value.has(id));
    const toRemove = [...initiallySelectedIds.value].filter((id) => !selectedIds.value.has(id));

    await Promise.allSettled(toAdd.map((id) => facilityGroupStore.addFacility(props.group.facilityGroupId, id)));
    await Promise.allSettled(toRemove.map((id) => facilityGroupStore.removeFacility(props.group.facilityGroupId, id)));

    commonUtil.showToast(translate("Facility memberships updated."));
    modalController.dismiss({ saved: true });
  } catch (err) {
    logger.error("Failed to save facility memberships", err);
    commonUtil.showToast(translate("Failed to save facility memberships."));
  } finally {
    emitter.emit("dismissLoader");
    isSaving.value = false;
  }
}

onMounted(async () => {
  const current = facilityGroupStore.getGroupFacilities(props.group.facilityGroupId) || [];
  initiallySelectedIds.value = new Set(current.map((f: any) => f.facilityId));
  selectedIds.value = new Set(initiallySelectedIds.value);
  await fetchFacilities();
});
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: var(--spacer-base);
  color: var(--ion-color-medium);
}
</style>
