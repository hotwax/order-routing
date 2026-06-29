<template>
  <div class="matched-product-filters">
    <!-- Add-filter actions, kept compact so they read as part of the search experience -->
    <div class="filter-actions">
      <div class="filter-line">
        <ion-label class="filter-line-label">{{ translate("Tags") }}</ion-label>
        <ion-button size="small" fill="outline" @click="openFilterModal('included', 'tags')">
          <ion-icon slot="start" :icon="addOutline" />
          {{ translate("Include") }}
        </ion-button>
        <ion-button size="small" fill="outline" @click="openFilterModal('excluded', 'tags')">
          <ion-icon slot="start" :icon="removeOutline" />
          {{ translate("Exclude") }}
        </ion-button>
      </div>
      <div class="filter-line">
        <ion-label class="filter-line-label">{{ translate("Features") }}</ion-label>
        <ion-button size="small" fill="outline" @click="openFilterModal('included', 'productFeatures')">
          <ion-icon slot="start" :icon="addOutline" />
          {{ translate("Include") }}
        </ion-button>
        <ion-button size="small" fill="outline" @click="openFilterModal('excluded', 'productFeatures')">
          <ion-icon slot="start" :icon="removeOutline" />
          {{ translate("Exclude") }}
        </ion-button>
      </div>
    </div>

    <!-- Active filter summary: one group per non-empty condition/field combination -->
    <div class="active-filters" v-if="activeGroups.length">
      <div class="active-group" v-for="group in activeGroups" :key="group.key">
        <div class="active-group-head">
          <ion-note>{{ translate(group.label) }}</ion-note>
          <!-- Operator only matters once a group has more than one value -->
          <ion-select
            v-if="group.values.length > 1"
            class="operator-select"
            interface="popover"
            :value="group.operator"
            @ionChange="updateFiltersOperator(group.condition, group.field, $event.detail.value)"
          >
            <ion-select-option value="and">{{ translate("AND") }}</ion-select-option>
            <ion-select-option value="or">{{ translate("OR") }}</ion-select-option>
          </ion-select>
        </div>
        <div class="chips">
          <ion-chip outline v-for="value in group.values" :key="value" @click="removeFilters(group.condition, group.field, value)">
            {{ value }}
            <ion-icon :icon="closeCircle" />
          </ion-chip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonChip, IonIcon, IonLabel, IonNote, IonSelect, IonSelectOption, modalController } from '@ionic/vue';
import { addOutline, closeCircle, removeOutline } from 'ionicons/icons';
import { translate } from '@common';
import AddProductFiltersModal from '@/components/AddProductFiltersModal.vue';
import { computed } from 'vue';
import { useAtpProductStore } from '@/store/atpProductStore';

const productStore = useAtpProductStore();

const appliedFilters = computed(() => productStore.getAppliedFilters);
const appliedFiltersOperator = computed(() => productStore.getAppliedFiltersOperator);

// Props the existing AddProductFiltersModal expects: a facet field to list options
// (tagsFacet/productFeaturesFacet) and the queryable searchfield (tags/productFeatures).
const FIELD_META: Record<string, { label: string; facetToSelect: string; searchfield: string }> = {
  tags: { label: 'tags', facetToSelect: 'tagsFacet', searchfield: 'tags' },
  productFeatures: { label: 'product features', facetToSelect: 'productFeaturesFacet', searchfield: 'productFeatures' }
};

// Mirrors the prior ProductFilters defaults: include = OR, exclude = AND.
const DEFAULT_OPERATOR: Record<string, string> = { included: 'or', excluded: 'and' };

const GROUP_DEFS = [
  { condition: 'included', field: 'tags', label: 'Included tags' },
  { condition: 'excluded', field: 'tags', label: 'Excluded tags' },
  { condition: 'included', field: 'productFeatures', label: 'Included features' },
  { condition: 'excluded', field: 'productFeatures', label: 'Excluded features' }
] as const;

const activeGroups = computed(() =>
  GROUP_DEFS
    .map((def) => {
      const values = appliedFilters.value[def.condition][def.field] || [];
      const operator = appliedFiltersOperator.value[def.condition][def.field] || DEFAULT_OPERATOR[def.condition];
      return { ...def, key: `${def.condition}-${def.field}`, values, operator };
    })
    .filter((group) => group.values.length)
);

async function openFilterModal(condition: string, field: string) {
  const meta = FIELD_META[field];
  const modal = await modalController.create({
    component: AddProductFiltersModal,
    componentProps: {
      label: meta.label,
      facetToSelect: meta.facetToSelect,
      searchfield: meta.searchfield,
      type: condition
    }
  });
  modal.present();
}

async function removeFilters(condition: 'included' | 'excluded', field: 'tags' | 'productFeatures', value: string) {
  const selectedFilters = {
    ...appliedFilters.value,
    [condition]: {
      ...appliedFilters.value[condition],
      [field]: appliedFilters.value[condition][field].filter((filter: string) => filter !== value)
    }
  };
  await productStore.updateAppliedFilters(selectedFilters);
}

async function updateFiltersOperator(condition: 'included' | 'excluded', field: 'tags' | 'productFeatures', value: string) {
  const operator = {
    ...appliedFiltersOperator.value,
    [condition]: {
      ...appliedFiltersOperator.value[condition],
      [field]: value
    }
  };
  await productStore.updateAppliedFiltersOperator(operator);
}
</script>

<style scoped>
.matched-product-filters {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs);
  padding-inline: var(--spacer-sm);
}

.filter-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.filter-line-label {
  font-weight: 600;
  min-width: 72px;
}

.filter-line ion-button {
  margin: 0;
}

.active-filters {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs);
  padding-top: var(--spacer-xs);
  border-top: 1px solid var(--ion-color-light-shade);
}

.active-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacer-xs);
}

.operator-select {
  min-height: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.chips ion-chip {
  margin: 0;
}
</style>
