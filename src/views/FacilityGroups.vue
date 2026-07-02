<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Facility groups") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <main>
        <ion-searchbar v-model="query" :placeholder="translate('Search facility groups')" />

        <div class="empty-block" v-if="!filteredGroups.length">
          <EmptyState
            v-if="query.trim()"
            variant="compact"
            :icon="searchOutline"
            :title="translate('No groups match your search')"
            :message="translate('Try a different search term.')"
          />
          <EmptyState
            v-else
            :icon="businessOutline"
            :title="translate('No facility groups yet')"
            :message="translate('Facility groups organize facilities so you can reference them in sourcing and routing rules.')"
          >
            <template #actions>
              <ion-button @click="openCreateModal()">
                {{ translate("Create your first group") }}
                <ion-icon slot="end" :icon="addOutline" />
              </ion-button>
            </template>
          </EmptyState>
        </div>

        <div v-else class="group-grid">
          <ion-card v-for="group in filteredGroups" :key="group.facilityGroupId">
            <ion-card-header>
              <ion-card-subtitle class="overline">{{ group.facilityGroupId }}</ion-card-subtitle>
              <ion-card-title>{{ group.facilityGroupName || group.facilityGroupId }}</ion-card-title>
              <ion-card-subtitle v-if="group.description">{{ group.description }}</ion-card-subtitle>
            </ion-card-header>

            <ion-item :lines="getFacilityCount(group.facilityGroupId) ? 'none' : 'full'">
              <ion-chip outline>
                {{ getTypeLabel(group.facilityGroupTypeId) }}
              </ion-chip>
              <ion-chip outline slot="end" color="medium">
                <ion-icon :icon="businessOutline" />
                <ion-label>
                  {{ getFacilityCount(group.facilityGroupId) }}
                  {{ translate(getFacilityCount(group.facilityGroupId) === 1 ? "facility" : "facilities") }}
                </ion-label>
              </ion-chip>
            </ion-item>

            <ion-item lines="full" v-if="getFacilityCount(group.facilityGroupId)">
              <ion-label class="ion-text-wrap">
                <p>
                  <span
                    v-for="(f, i) in getFacilitiesPreview(group.facilityGroupId)"
                    :key="f.facilityId"
                  >{{ i > 0 ? ", " : "" }}{{ f.facilityName || f.facilityId }}</span>
                  <span v-if="getFacilityCount(group.facilityGroupId) > 3">
                    {{ ' ' + translate("and") + ' ' + (getFacilityCount(group.facilityGroupId) - 3) + ' ' + translate("more") }}
                  </span>
                </p>
              </ion-label>
            </ion-item>

            <div class="actions">
              <ion-button fill="clear" size="small" @click="openManageFacilities(group)">
                <ion-icon slot="start" :icon="businessOutline" />
                {{ translate("Manage facilities") }}
              </ion-button>
              <ion-button fill="clear" size="small" @click="openEditModal(group)">
                <ion-icon slot="start" :icon="createOutline" />
                {{ translate("Edit") }}
              </ion-button>
              <ion-button class="archive-action" fill="clear" size="small" color="danger" @click="confirmArchive(group)">
                <ion-icon slot="start" :icon="archiveOutline" />
                {{ translate("Archive") }}
              </ion-button>
            </div>
          </ion-card>
        </div>
      </main>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="ion-margin">
        <ion-fab-button @click="openCreateModal()">
          <ion-icon :icon="addOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { addOutline, archiveOutline, businessOutline, createOutline, searchOutline } from "ionicons/icons";
import { commonUtil, logger, translate } from "@common";
import { computed, onMounted, ref } from "vue";
import { useFacilityGroupStore } from "@/store/facilityGroupStore";
import { useAtpProductStore } from "@/store/atpProductStore";
import EmptyState from "@/components/EmptyState.vue";
import CreateUpdateFacilityGroupModal from "@/components/CreateUpdateFacilityGroupModal.vue";
import ManageFacilityGroupFacilitiesModal from "@/components/ManageFacilityGroupFacilitiesModal.vue";

const facilityGroupStore = useFacilityGroupStore();
const productStore = useAtpProductStore();

const DEFAULT_GROUP_TYPE = "BROKERING_GROUP";

const query = ref("");

const groups = computed(() => facilityGroupStore.getGroups);
const groupTypes = computed(() => facilityGroupStore.getGroupTypes);

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return groups.value;
  return groups.value.filter((g: any) =>
    (g.facilityGroupName || "").toLowerCase().includes(q) ||
    (g.facilityGroupId || "").toLowerCase().includes(q) ||
    (g.description || "").toLowerCase().includes(q)
  );
});

function getTypeLabel(typeId: string) {
  if (!typeId) return translate("Unspecified");
  const t = groupTypes.value.find((gt: any) => gt.facilityGroupTypeId === typeId);
  return t?.description || typeId;
}

function getFacilityCount(groupId: string) {
  return (facilityGroupStore.getGroupFacilities(groupId) || []).length;
}

function getFacilitiesPreview(groupId: string) {
  return (facilityGroupStore.getGroupFacilities(groupId) || []).slice(0, 3);
}

async function load() {
  try {
    await facilityGroupStore.fetchGroups({ productStoreId: productStore.getCurrentProductStore?.productStoreId });
  } catch (err) {
    logger.error("Failed to load facility groups", err);
  }
}

async function openCreateModal() {
  const modal = await modalController.create({
    component: CreateUpdateFacilityGroupModal,
    componentProps: { defaultTypeId: DEFAULT_GROUP_TYPE }
  });
  modal.onDidDismiss().then((res: any) => {
    if (res?.data?.saved) load();
  });
  await modal.present();
}

async function openEditModal(group: any) {
  const modal = await modalController.create({
    component: CreateUpdateFacilityGroupModal,
    componentProps: { group }
  });
  await modal.present();
}

async function openManageFacilities(group: any) {
  const modal = await modalController.create({
    component: ManageFacilityGroupFacilitiesModal,
    componentProps: { group }
  });
  modal.onDidDismiss().then((res: any) => {
    if (res?.data?.saved) load();
  });
  await modal.present();
}

async function confirmArchive(group: any) {
  const alert = await alertController.create({
    header: translate("Archive facility group?"),
    message: translate("This will hide the group from rule selectors. The group's data is preserved server-side."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Archive"),
        role: "destructive",
        handler: async () => {
          try {
            await facilityGroupStore.archiveGroup(group);
            commonUtil.showToast(translate("Facility group archived."));
          } catch (err) {
            logger.error("Failed to archive facility group", err);
            commonUtil.showToast(translate("Failed to archive facility group."));
          }
        }
      }
    ]
  });
  await alert.present();
}

onMounted(load);
</script>

<style scoped>
main {
  padding: var(--spacer-base);
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--spacer-base);
}

.group-grid > ion-card {
  height: min-content;
}

.actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  padding: var(--spacer-2xs) var(--spacer-xs);
}

.actions .archive-action {
  margin-inline-start: auto;
}

.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-base);
  padding: var(--spacer-base) var(--spacer-base) var(--spacer-2xl);
}
</style>
