<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Change channel") }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="queryString" :placeholder="translate('Search by channel name or ID')" :debounce="200" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list v-if="filteredChannels.length">
      <ion-radio-group :value="currentChannelId">
        <ion-item
          v-for="channel in filteredChannels"
          :key="channel.facilityGroupId"
          lines="full"
          @click="selectChannel(channel)"
        >
          <ion-radio :value="channel.facilityGroupId" label-placement="end" justify="start">
            <ion-label>
              {{ channel.facilityGroupName || channel.facilityGroupId }}
              <p>{{ channel.facilityGroupId }}</p>
            </ion-label>
          </ion-radio>
          <ion-note v-if="!channel.selectedConfigFacility" slot="end" color="medium">
            {{ translate("No configuration facility") }}
          </ion-note>
        </ion-item>
      </ion-radio-group>
    </ion-list>
    <EmptyState
      v-else
      variant="compact"
      :icon="searchOutline"
      :title="translate('No channels match your search')"
      :message="translate('Try a different channel name or ID.')"
    />
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@common";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { closeOutline, searchOutline } from "ionicons/icons";
import { computed, ref } from "vue";
import EmptyState from "@/components/EmptyState.vue";

const props = defineProps<{
  currentChannelId: string;
  channels: any[];
}>();

const queryString = ref("");

const filteredChannels = computed(() => {
  const query = queryString.value.trim().toLowerCase();
  if(!query) {return props.channels || [];}

  return (props.channels || []).filter((channel: any) =>
    (channel.facilityGroupName || "").toLowerCase().includes(query) ||
      (channel.facilityGroupId || "").toLowerCase().includes(query));
});

function closeModal() {
  modalController.dismiss();
}

function selectChannel(channel: any) {
  modalController.dismiss({ channelId: channel.facilityGroupId });
}
</script>
