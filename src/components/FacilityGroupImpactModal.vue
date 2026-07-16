<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Impacted facilities") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div class="impact-summary" v-if="!isLoading">
      <ion-chip outline color="success">
        <ion-icon :icon="checkmarkCircleOutline" />
        <ion-label>{{ translate("net facilities", { count: netFacilities.length }) }}</ion-label>
      </ion-chip>
      <ion-chip outline color="medium" v-if="includedGroups.length">
        <ion-label>{{ translate("from included groups", { count: includedFacilityCount }) }}</ion-label>
      </ion-chip>
      <ion-chip outline color="danger" v-if="removedFacilities.length">
        <ion-label>{{ translate("removed by exclusions", { count: removedFacilities.length }) }}</ion-label>
      </ion-chip>
    </div>

    <div class="empty-state" v-if="isLoading">
      <ion-item lines="none">
        <ion-spinner name="crescent" slot="start" />
        {{ translate("Resolving facilities") }}
      </ion-item>
    </div>

    <template v-else>
      <ion-list v-if="netFacilities.length">
        <ion-list-header>
          <ion-label>{{ translate("Facilities this rule will apply to") }}</ion-label>
        </ion-list-header>
        <ion-item v-for="facility in netFacilities" :key="facility.facilityId">
          <ion-icon :icon="storefrontOutline" slot="start" />
          <ion-label>
            {{ facility.facilityName || facility.facilityId }}
            <p>{{ facility.facilityId }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <div class="empty-state" v-else>
        <p>{{ translate("No facilities are impacted by the selected groups.") }}</p>
      </div>

      <ion-list v-if="removedFacilities.length" class="removed-list">
        <ion-list-header>
          <ion-label color="danger">{{ translate("Removed by excluded groups") }}</ion-label>
        </ion-list-header>
        <ion-item v-for="facility in removedFacilities" :key="facility.facilityId">
          <ion-icon :icon="closeCircleOutline" color="danger" slot="start" />
          <ion-label>
            {{ facility.facilityName || facility.facilityId }}
            <p>{{ facility.facilityId }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </template>
  </ion-content>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { checkmarkCircleOutline, closeCircleOutline, closeOutline, storefrontOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import { useAtpProductStore } from "@/store/atpProductStore";

const props = defineProps<{
  includedGroups: any[];
  excludedGroups: any[];
  areAllSelected?: boolean;
}>();

const productStore = useAtpProductStore();

const isLoading = ref(true);
const includedFacilities = ref<any[]>([]);
const excludedFacilities = ref<any[]>([]);
const includedFacilityCount = ref(0);

const excludedIds = computed(() => new Set(excludedFacilities.value.map((facility: any) => facility.facilityId)));

// Net = union of included groups' facilities minus any facility in an excluded group.
const netFacilities = computed(() => includedFacilities.value.filter((facility: any) => !excludedIds.value.has(facility.facilityId)));

// Facilities that were in included groups but pulled out by an exclusion.
const removedFacilities = computed(() => includedFacilities.value.filter((facility: any) => excludedIds.value.has(facility.facilityId)));

onMounted(async () => {
  isLoading.value = true;

  if(props.areAllSelected) {
    includedFacilities.value = commonUtil.dedupeFacilities(productStore.getFacilities)
  } else {
    const [included, excluded] = await Promise.all([
      resolveGroups(props.includedGroups),
      resolveGroups(props.excludedGroups)
    ]);
    includedFacilityCount.value = included.length;
    includedFacilities.value = commonUtil.dedupeFacilities(included);
    excludedFacilities.value = commonUtil.dedupeFacilities(excluded);
  }

  isLoading.value = false;
});

async function resolveGroups(groups: any[]) {
  if (!groups?.length) return [];
  const results = await Promise.all(
    groups
      .filter((group: any) => group?.facilityGroupId)
      .map((group: any) => productStore.fetchFacilitiesForGroup(group.facilityGroupId))
  );
  return results.flat();
}

function closeModal() {
  modalController.dismiss();
}
</script>

<style scoped>
.impact-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-2xs);
  padding: var(--spacer-sm) var(--spacer-base) 0;
}

.empty-state {
  padding: var(--spacer-base);
  text-align: center;
  color: var(--ion-color-medium);
}

.removed-list {
  margin-top: var(--spacer-base);
}
</style>
