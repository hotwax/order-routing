<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button fill="clear" data-testid="multi-facility-cancel" @click="close">
          {{ translate("Cancel") }}
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Select facilities") }}</ion-title>
      <ion-buttons slot="end">
        <ion-button data-testid="multi-facility-apply" :disabled="!selectedFacilityIds.length" @click="apply">
          {{ translate("Apply") }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="searchTerm" :placeholder="translate('Search facilities')" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item v-for="facility in filteredFacilities" :key="facility.facilityId" button @click="toggleFacility(facility.facilityId)">
        <ion-checkbox slot="start" :checked="selectedFacilityIds.includes(facility.facilityId)" />
        <ion-label>
          {{ facility.facilityName || facility.facilityId }}
          <p>{{ facility.facilityId }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
    <p v-if="!filteredFacilities.length" class="empty-state">
      {{ translate("No facilities found") }}
    </p>
  </ion-content>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonItem, IonLabel, IonList, IonSearchbar, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { computed, ref } from "vue";
import { translate } from "@common";

const props = defineProps<{
  currentFacilityIds: string[];
  facilities: any[];
}>();

const searchTerm = ref("");
const selectedFacilityIds = ref([...props.currentFacilityIds]);
const filteredFacilities = computed(() => {
  const search = searchTerm.value.trim().toLowerCase();
  if(!search) {return props.facilities || [];}

  return (props.facilities || []).filter((facility: any) =>
    `${facility.facilityName || ""} ${facility.facilityId || ""}`.toLowerCase().includes(search));
});

function toggleFacility(facilityId: string) {
  selectedFacilityIds.value = selectedFacilityIds.value.includes(facilityId)
    ? selectedFacilityIds.value.filter((id) => id !== facilityId)
    : [...selectedFacilityIds.value, facilityId];
}

function close() {
  modalController.dismiss();
}

function apply() {
  if(selectedFacilityIds.value.length) {
    modalController.dismiss({ facilityIds: selectedFacilityIds.value });
  }
}
</script>

<style scoped>
.empty-state {
  padding: var(--spacer-base, 16px);
  text-align: center;
}
</style>
