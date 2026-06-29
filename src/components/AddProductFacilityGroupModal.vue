<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ type === "included" ? translate("Include facility groups") : translate("Exclude facility groups") }}</ion-title>
      <ion-buttons slot="end">
        <!-- Clear button should be disabled till no group is selected -->
        <ion-button fill="clear" color="danger" :disabled="!selectedGroups.length" @click="selectedGroups = []">{{ translate("Clear All") }}</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-searchbar :placeholder="translate('Search facility groups')" v-model="queryString" />

    <div class="selected-chips" v-if="selectedGroups.length">
      <ion-chip v-for="group in selectedGroups" outline :key="group.facilityGroupId">
        <ion-label>{{ group.facilityGroupName || group.facilityGroupId }}</ion-label>
        <ion-icon :icon="closeOutline" @click.stop="removeSelectedGroup(group.facilityGroupId)" />
      </ion-chip>
    </div>

    <!-- Live net facilities for the current (unsaved) selection: included groups' facilities minus excluded. -->
    <ion-item lines="none" class="net-summary">
      <ion-spinner v-if="isCounting" name="dots" slot="start" />
      <ion-label color="medium">{{ translate("{count} net facilities selected", { count: netFacilityCount }) }}</ion-label>
    </ion-item>

    <ion-list v-if="filteredFacilityGroups.length">
      <ion-item v-for="group in filteredFacilityGroups" :key="group.facilityGroupId" :button="!isAlreadyApplied(group.facilityGroupId)" @click="!isAlreadyApplied(group.facilityGroupId) ? updateSelectedGroups(group) : null">
        <ion-label v-if="isAlreadyApplied(group.facilityGroupId)">{{ group.facilityGroupName || group.facilityGroupId }}</ion-label>
        <ion-checkbox v-else :checked="isAlreadySelected(group.facilityGroupId)">
          {{ group.facilityGroupName || group.facilityGroupId }}
        </ion-checkbox>
        <ion-note slot="end">{{ facilityCountLabel(group.facilityGroupId) }}</ion-note>
        <ion-note v-if="isAlreadyApplied(group.facilityGroupId)" slot="end" color="danger">{{ type === 'included' ? translate("excluded") : translate("included") }}</ion-note>
      </ion-item>
    </ion-list>

    <EmptyState
      v-else-if="!facilityGroups.length"
      variant="compact"
      :icon="albumsOutline"
      :title="translate('No facility groups available')"
      :message="translate('Create a facility group before you can include or exclude it here.')"
    />
    <div v-else class="empty-state">
      <p>{{ translate("No result found for", { label: queryString }) }}</p>
    </div>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button @click="saveFacilityGroups()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
import { albumsOutline, closeOutline, saveOutline } from 'ionicons/icons';
import { useAtpProductStore } from "@/store/atpProductStore";
import EmptyState from '@/components/EmptyState.vue';
import { translate } from '@common';

const selectedGroups = ref([]) as any;
const queryString = ref('');
// Cache of facilityGroupId -> facilities[] so filtering/scrolling never refetches a group.
const facilitiesByGroupId = ref<Record<string, any[]>>({});
const isCounting = ref(false);

const props = defineProps(["selectedFacilityGroups", "type"]);
const productStore = useAtpProductStore();

const facilityGroups = computed(() => productStore.getFacilityGroups)

const filteredFacilityGroups = computed(() => {
  const q = queryString.value.trim().toLowerCase()
  if (!q) return facilityGroups.value
  return facilityGroups.value.filter((group: any) =>
    (group.facilityGroupName || '').toLowerCase().includes(q) || (group.facilityGroupId || '').toLowerCase().includes(q)
  )
})

// Net = dedupe(facilities of included groups) minus facilities in any excluded group. The side being
// edited uses the unsaved modal selection; the opposite side uses the already-applied groups.
const netFacilityCount = computed(() => {
  const includedGroups = props.type === 'included' ? selectedGroups.value : props.selectedFacilityGroups.included
  const excludedGroups = props.type === 'excluded' ? selectedGroups.value : props.selectedFacilityGroups.excluded
  const facilityIdsFor = (groups: any[]) => {
    const ids = new Set<string>()
    ;(groups || []).forEach((group: any) => {
      (facilitiesByGroupId.value[group.facilityGroupId] || []).forEach((facility: any) => {
        if (facility?.facilityId) ids.add(facility.facilityId)
      })
    })
    return ids
  }
  const included = facilityIdsFor(includedGroups)
  const excluded = facilityIdsFor(excludedGroups)
  let net = 0
  included.forEach((id) => { if (!excluded.has(id)) net++ })
  return net
})

onMounted(async () => {
  selectedGroups.value = JSON.parse(JSON.stringify(props.selectedFacilityGroups[props.type]))
  await loadFacilityCounts()
})

async function loadFacilityCounts() {
  const groups = facilityGroups.value || []
  if (!groups.length) return
  isCounting.value = true
  await Promise.all(groups.map(async (group: any) => {
    if (facilitiesByGroupId.value[group.facilityGroupId]) return
    const facilities = await productStore.fetchFacilitiesForGroup(group.facilityGroupId)
    facilitiesByGroupId.value = { ...facilitiesByGroupId.value, [group.facilityGroupId]: facilities || [] }
  }))
  isCounting.value = false
}

function facilityCountLabel(groupId: string) {
  const facilities = facilitiesByGroupId.value[groupId]
  if (!facilities) return '…'
  return String(facilities.length)
}

function closeModal() {
  modalController.dismiss({ dismissed: true, selectedGroups: selectedGroups.value });
}

function isAlreadySelected(id: any) {
  return selectedGroups.value.some((group: any) => group.facilityGroupId === id)
}

function updateSelectedGroups(selectedGroup: any) {
  const currentGroup = selectedGroups.value.find((group: any) => group.facilityGroupId === selectedGroup.facilityGroupId)

  if(currentGroup?.facilityGroupId) {
    selectedGroups.value = selectedGroups.value.filter((group: any) => group.facilityGroupId !== selectedGroup.facilityGroupId)
  } else {
    selectedGroups.value.push(selectedGroup)
  }
}

function removeSelectedGroup(groupId: string) {
  selectedGroups.value = selectedGroups.value.filter((group: any) => group.facilityGroupId !== groupId)
}

function isAlreadyApplied(value: string) {
  const type = props.type === 'included' ? 'excluded' : 'included'
  return props.selectedFacilityGroups[type].some((group: any) => group.facilityGroupId === value)
}

function saveFacilityGroups() {
  modalController.dismiss({ dismissed: true, selectedGroups: selectedGroups.value })
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

  .net-summary {
    --min-height: 36px;
    font-size: 0.9rem;
  }
</style>
