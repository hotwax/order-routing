<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate(isEdit ? "Edit facility group" : "Create facility group") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input
          v-model="form.facilityGroupName"
          labelPlacement="floating"
          @ionBlur="!isEdit && !form.facilityGroupId && deriveId()"
        >
          <div slot="label">{{ translate("Name") }} <ion-text color="danger">*</ion-text></div>
        </ion-input>
      </ion-item>
      <ion-item :disabled="isEdit">
        <ion-input
          v-model="form.facilityGroupId"
          labelPlacement="floating"
          :label="translate('ID')"
          :error-text="idError"
          :maxlength="20"
        />
      </ion-item>
      <ion-item :disabled="isEdit">
        <ion-select
          v-model="form.facilityGroupTypeId"
          :label="translate('Type')"
          interface="popover"
          :placeholder="translate('Select a type')"
        >
          <ion-select-option
            v-for="t in groupTypes"
            :key="t.facilityGroupTypeId"
            :value="t.facilityGroupTypeId"
          >
            {{ t.description || t.facilityGroupTypeId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-textarea
          v-model="form.description"
          :label="translate('Description')"
          labelPlacement="floating"
          :maxlength="255"
          :auto-grow="true"
        />
      </ion-item>
    </ion-list>
  </ion-content>

  <ion-fab vertical="bottom" horizontal="end" slot="fixed">
    <ion-fab-button :disabled="!canSave" @click="save()">
      <ion-icon :icon="isEdit ? saveOutline : checkmarkDone" />
    </ion-fab-button>
  </ion-fab>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { checkmarkDone, closeOutline, saveOutline } from "ionicons/icons";
import { commonUtil, logger, translate } from "@common";
import { computed, onMounted, ref } from "vue";
import { useFacilityGroupStore } from "@/store/facilityGroupStore";

const props = defineProps<{
  group?: any;
  /** Pre-selects the group type when creating (e.g. "PICKUP" from the store pickup view). */
  defaultTypeId?: string;
}>();

const facilityGroupStore = useFacilityGroupStore();

const isEdit = computed(() => !!props.group?.facilityGroupId);
const groupTypes = computed(() => facilityGroupStore.getGroupTypes);

const form = ref({
  facilityGroupId: props.group?.facilityGroupId || "",
  facilityGroupName: props.group?.facilityGroupName || "",
  facilityGroupTypeId: props.group?.facilityGroupTypeId || props.defaultTypeId || "",
  description: props.group?.description || ""
});

const idError = computed(() =>
  form.value.facilityGroupId && form.value.facilityGroupId.length > 20
    ? translate("Internal ID cannot be more than 20 characters.")
    : ""
);

const canSave = computed(() => {
  if (!form.value.facilityGroupName?.trim()) return false;
  if (!isEdit.value && (!form.value.facilityGroupId?.trim() || idError.value)) return false;
  return true;
});

function deriveId() {
  if (!form.value.facilityGroupName) return;
  const id = form.value.facilityGroupName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20);
  form.value.facilityGroupId = id;
}

function closeModal(payload?: any) {
  modalController.dismiss(payload);
}

async function save() {
  try {
    if (isEdit.value) {
      await facilityGroupStore.updateGroup({
        facilityGroupId: form.value.facilityGroupId,
        facilityGroupName: form.value.facilityGroupName,
        description: form.value.description
      });
      commonUtil.showToast(translate("Facility group updated."));
    } else {
      await facilityGroupStore.createGroup({
        facilityGroupId: form.value.facilityGroupId,
        facilityGroupName: form.value.facilityGroupName,
        facilityGroupTypeId: form.value.facilityGroupTypeId || "BROKERING_GROUP",
        description: form.value.description
      });
      commonUtil.showToast(translate("Facility group created."));
    }
    closeModal({ saved: true });
  } catch (err) {
    logger.error("Failed to save facility group", err);
    commonUtil.showToast(translate("Failed to save facility group."));
  }
}

onMounted(() => {
  facilityGroupStore.fetchGroupTypes();
});
</script>
