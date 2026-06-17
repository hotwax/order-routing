<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ title || translate("Link existing group") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div v-if="isLoading" class="loader">
      <ion-spinner name="crescent" />
      <p>{{ translate("Loading groups") }}</p>
    </div>

    <EmptyState
      v-else-if="!allCandidates.length"
      variant="compact"
      :icon="albumsOutline"
      :title="translate('Nothing to link')"
      :message="translate('Every matching group is already linked to this product store.')"
    />

    <ion-list v-else>
      <ion-item
        v-for="group in filteredCandidates"
        :key="group.facilityGroupId"
      >
        <ion-checkbox
          :checked="selected.has(group.facilityGroupId)"
          label-placement="end"
          @ionChange="toggle(group.facilityGroupId)"
        >
          <ion-label class="ion-text-wrap">
            {{ group.facilityGroupName || group.facilityGroupId }}
            <p>{{ group.facilityGroupId }}</p>
            <p v-if="getProductStoreNames(group.facilityGroupId)">
              {{ translate("Product stores") }}: {{ getProductStoreNames(group.facilityGroupId) }}
            </p>
          </ion-label>
        </ion-checkbox>
        <ion-note slot="end">
          {{ facilityCount(group.facilityGroupId) }}
          {{ translate(facilityCount(group.facilityGroupId) === 1 ? "facility" : "facilities") }}
        </ion-note>
      </ion-item>
    </ion-list>
  </ion-content>

  <ion-fab v-if="!isLoading && allCandidates.length" vertical="bottom" horizontal="end" slot="fixed">
    <ion-fab-button :disabled="!selected.size || isLinking" @click="linkSelected()">
      <ion-icon :icon="linkOutline" />
    </ion-fab-button>
  </ion-fab>
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
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { albumsOutline, closeOutline, linkOutline } from "ionicons/icons";
import { commonUtil, logger, translate } from "@common";
import { computed, onMounted, ref } from "vue";
import { useFacilityGroupStore } from "@/store/facilityGroupStore";
import EmptyState from "@/components/EmptyState.vue";

const props = defineProps<{
  /** Only groups of this type are offered. Omit to offer groups of any type. */
  facilityGroupTypeId?: string;
  /** Group ids already linked to the store, excluded from the picker. */
  linkedGroupIds?: string[];
  title?: string;
}>();

const facilityGroupStore = useFacilityGroupStore();

const isLoading = ref(true);
const isLinking = ref(false);
const query = ref("");
const selected = ref<Set<string>>(new Set());

const allCandidates = computed(() => {
  const linked = new Set(props.linkedGroupIds || []);
  return facilityGroupStore.getGroups.filter(
    (g: any) =>
      (!props.facilityGroupTypeId || g.facilityGroupTypeId === props.facilityGroupTypeId) &&
      !linked.has(g.facilityGroupId)
  );
});

const filteredCandidates = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return allCandidates.value;
  return allCandidates.value.filter((g: any) =>
    (g.facilityGroupName || "").toLowerCase().includes(q) ||
    (g.facilityGroupId || "").toLowerCase().includes(q)
  );
});

function facilityCount(groupId: string) {
  return (facilityGroupStore.getGroupFacilities(groupId) || []).length;
}

function toggle(groupId: string) {
  const next = new Set(selected.value);
  next.has(groupId) ? next.delete(groupId) : next.add(groupId);
  selected.value = next;
}

function closeModal(payload?: any) {
  modalController.dismiss(payload);
}

async function linkSelected() {
  const ids = [...selected.value];
  if (!ids.length) return;
  isLinking.value = true;
  const responses = await Promise.allSettled(
    ids.map((id) => facilityGroupStore.associateWithProductStore(id))
  );
  isLinking.value = false;

  const failed = responses.filter((r) => r.status === "rejected").length;
  if (failed) {
    logger.error(`Failed to link ${failed} group(s)`);
    commonUtil.showToast(translate("Failed to link group."));
  }
  const linkedCount = ids.length - failed;
  if (linkedCount) {
    commonUtil.showToast(translate(linkedCount === 1 ? "Group linked." : "Groups linked."));
    closeModal({ linked: true });
  }
}

function getProductStoreNames(groupId: string): string {
  const stores = facilityGroupStore.getGroupProductStores(groupId);
  return stores.join(", ");
}

onMounted(async () => {
  try {
    await Promise.allSettled([
      facilityGroupStore.fetchGroups(),
      facilityGroupStore.fetchGroupProductStoreAssociations()
    ]);
  } catch (err) {
    logger.error("Failed to load groups or associations for linking", err);
  }
  isLoading.value = false;
});
</script>

<style scoped>
.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-xs);
  padding: var(--spacer-2xl) var(--spacer-base);
  color: var(--ion-color-medium);
}
</style>
