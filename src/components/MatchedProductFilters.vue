<template>
  <div class="matched-product-filters">
    <!-- Compact, icon-led add controls; Include vs Exclude is chosen in an action sheet -->
    <div class="filter-actions">
      <ion-button size="small" fill="outline" @click="promptAddFilter('tags')">
        <ion-icon slot="start" :icon="pricetagOutline" />
        {{ translate("Tags") }}
        <ion-icon slot="end" :icon="addOutline" />
      </ion-button>
      <ion-button size="small" fill="outline" @click="promptAddFilter('productFeatures')">
        <ion-icon slot="start" :icon="optionsOutline" />
        {{ translate("Features") }}
        <ion-icon slot="end" :icon="addOutline" />
      </ion-button>
    </div>

    <!-- Active filter summary: one group per non-empty condition/field combination.
         A leading icon distinguishes tags (price tag) from features (options) so it isn't guesswork. -->
    <div class="active-filters" v-if="activeGroups.length">
      <div class="active-group" v-for="group in activeGroups" :key="group.key">
        <div class="active-group-head">
          <ion-icon
            class="group-icon"
            :icon="group.field === 'tags' ? pricetagOutline : optionsOutline"
            :aria-label="translate(group.field === 'tags' ? 'Tags' : 'Features')"
          />
          <ion-note>{{ translate(group.conditionLabel) }}</ion-note>
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
          <ion-chip v-for="value in group.values" :key="value" @click="removeFilters(group.condition, group.field, value)">
            {{ value }}
            <ion-icon :icon="closeCircle" />
          </ion-chip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonChip, IonIcon, IonNote, IonSelect, IonSelectOption, actionSheetController, modalController } from '@ionic/vue';
import { addOutline, closeCircle, optionsOutline, pricetagOutline } from 'ionicons/icons';
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
  { condition: 'included', field: 'tags' },
  { condition: 'excluded', field: 'tags' },
  { condition: 'included', field: 'productFeatures' },
  { condition: 'excluded', field: 'productFeatures' }
] as const;

const activeGroups = computed(() =>
  GROUP_DEFS
    .map((def) => {
      const values = appliedFilters.value[def.condition][def.field] || [];
      const operator = appliedFiltersOperator.value[def.condition][def.field] || DEFAULT_OPERATOR[def.condition];
      return {
        ...def,
        key: `${def.condition}-${def.field}`,
        conditionLabel: def.condition === 'included' ? 'Included' : 'Excluded',
        values,
        operator
      };
    })
    .filter((group) => group.values.length)
);

async function promptAddFilter(field: 'tags' | 'productFeatures') {
  const sheet = await actionSheetController.create({
    header: translate(field === 'tags' ? 'Add tag filter' : 'Add feature filter'),
    buttons: [
      { text: translate('Include'), handler: () => { openFilterModal('included', field); } },
      { text: translate('Exclude'), handler: () => { openFilterModal('excluded', field); } },
      { text: translate('Cancel'), role: 'cancel' }
    ]
  });
  await sheet.present();
}

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

.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
}

.filter-actions ion-button {
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
  gap: 6px;
}

.group-icon {
  font-size: 16px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.operator-select {
  margin-inline-start: auto;
  min-height: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chips ion-chip {
  margin: 0;
}
</style>
