<template>
  <div class="stockout">
    <div v-for="row in rows" :key="row.label" class="so-row">
      <h4>{{ row.isBaseline ? translate("Baseline") : row.label }}</h4>
      <template v-if="row.outcomes?.inventory?.available">
        <div class="count">{{ row.outcomes.inventory.newSeasonStoresAtZero }}</div>
        <div class="count-label">{{ translate("new-season stores ended the day at zero") }}</div>
        <ion-accordion-group v-if="row.outcomes.inventory.newSeasonStoresAtZeroList.length">
          <ion-accordion value="stores">
            <ion-item slot="header"><ion-label>{{ translate("Affected stores") }}</ion-label></ion-item>
            <div slot="content" class="ion-padding">
              <ion-item v-for="s in row.outcomes.inventory.newSeasonStoresAtZeroList" :key="s.facilityId">
                <ion-label class="ion-text-wrap">{{ s.facilityName }} — {{ s.productIds.join(', ') }}</ion-label>
              </ion-item>
            </div>
          </ion-accordion>
        </ion-accordion-group>
      </template>
      <p v-else class="note">{{ translate("Inventory modeling off / new-season tags not configured.") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel } from "@ionic/vue";
import type { OutcomeRow } from "@/utils/simulationResults";

defineProps<{ rows: OutcomeRow[] }>();
</script>

<style scoped>
.so-row { margin-bottom: 16px; }
.so-row h4 { margin: 0 0 6px; }
.count { font-size: 1.8rem; font-weight: 600; color: var(--ion-color-danger); }
.count-label { font-size: 0.8rem; color: var(--ion-color-medium); margin-bottom: 6px; }
.note { color: var(--ion-color-medium); font-size: 0.85rem; }
</style>
