<template>
  <ion-modal :is-open="isOpen" class="variation-diff-modal" @didDismiss="emit('dismiss')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button :aria-label="translate('Close')" @click="closeModal()">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ modalTitle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="!diff.total" class="empty-diff">
        <ion-icon :icon="checkmarkCircleOutline" color="success" />
        <h2>{{ translate("Matches the baseline") }}</h2>
        <p>{{ translate("This variation does not currently change any routing settings.") }}</p>
      </div>

      <ion-list v-else>
        <ion-list-header>
          <ion-label>
            {{ translate("Changes from baseline") }}
            <p>
              {{ diff.total }} {{ translate(diff.total === 1 ? "difference" : "differences") }}
              <template v-if="dirty"> — {{ translate("includes unsaved edits") }}</template>
            </p>
          </ion-label>
        </ion-list-header>
        <template v-for="section in diff.sections" :key="section.id">
          <ion-item-divider color="light">
            <ion-label>{{ section.title }}</ion-label>
            <ion-button size="small" fill="clear" @click="emit('restore-section', section.target)">
              <ion-icon slot="start" :icon="refreshOutline" />
              {{ translate("Reset to baseline") }}
            </ion-button>
          </ion-item-divider>
          <ion-item v-for="row in section.rows" :key="`${section.id}:${row.key}`">
            <ion-label class="ion-text-wrap">
              {{ row.label }}
              <p v-if="row.before && row.after">{{ row.before }} → {{ row.after }}</p>
              <p v-else-if="row.before">{{ row.before }}</p>
              <p v-else-if="row.after">{{ row.after }}</p>
            </ion-label>
            <ion-badge slot="end" :color="kindColor(row.kind)">{{ translate(kindLabel(row.kind)) }}</ion-badge>
          </ion-item>
        </template>
      </ion-list>
    </ion-content>

    <ion-footer v-if="diff.total">
      <ion-toolbar>
        <ion-button slot="end" fill="outline" color="danger" @click="emit('restore-all')">
          <ion-icon slot="start" :icon="refreshOutline" />
          {{ translate("Reset variation to baseline") }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { checkmarkCircleOutline, closeOutline, refreshOutline } from "ionicons/icons";
import { translate } from "@common";
import type { VariationConfigDiff, VariationDiffKind, VariationDiffTarget } from "@/utils/variationConfigDiff";
import { computed } from "vue";

const props = defineProps<{
  isOpen: boolean;
  diff: VariationConfigDiff;
  dirty: boolean;
}>();

const modalTitle = computed(() => {
  const routingNames = [...new Set(props.diff.sections.map((section) => section.routingName).filter(Boolean))];
  if (routingNames.length === 1) return routingNames[0];
  if (routingNames.length > 1) return `${routingNames.length} ${translate("routings")}`;
  return translate("Variation changes");
});

const emit = defineEmits<{
  dismiss: [];
  "restore-section": [target: VariationDiffTarget];
  "restore-all": [];
}>();

function kindLabel(kind: VariationDiffKind) {
  return ({ added: "Added", removed: "Removed", changed: "Changed", reordered: "Reordered" })[kind];
}

function kindColor(kind: VariationDiffKind) {
  return ({ added: "success", removed: "danger", changed: "warning", reordered: "tertiary" })[kind];
}

function closeModal() {
  return modalController.dismiss();
}
</script>

<style scoped>
.empty-diff {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacer-xs);
  padding: var(--spacer-2xl) var(--spacer-base);
}

.empty-diff ion-icon {
  font-size: 2.5rem;
}

.empty-diff h2,
.empty-diff p {
  margin: 0;
}

ion-footer ion-button {
  margin-inline-end: var(--spacer-sm);
}
</style>
