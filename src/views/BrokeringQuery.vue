<template>
  <ion-page>
    <ion-split-pane content-id="query-content">
      <ion-list>
        <ion-reorder-group :disabled="false">
          <ion-item>
            <ion-label>{{ "Warehouse only" }}</ion-label>
            <ion-reorder />
          </ion-item>
          <ion-item>
            <ion-label>{{ "Warehouse and stores" }}</ion-label>
            <ion-reorder />
          </ion-item>
          <ion-item>
            <ion-label>{{ "Any Location" }}</ion-label>
            <ion-reorder />
          </ion-item>
        </ion-reorder-group>
      </ion-list>
      <ion-content id="query-content">
        <section class="filters">
          <ion-card>
            <ion-item>
              <ion-icon slot="start" :icon="filterOutline"/>
              <ion-label>{{ "Filters" }}</ion-label>
              <ion-icon :icon="optionsOutline"/>
            </ion-item>
            <ion-item>
              <ion-select label="Group" value="East coast stores">
                <ion-select-option value="East coast stores">{{ 'East coast stores' }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select label="Proximity" value="Zone 1">
                <ion-select-option value="Zone 1">{{ 'Zone 1' }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Brokering safety stock" }}</ion-label>
              <ion-chip>{{ "3" }}</ion-chip>
            </ion-item>
          </ion-card>
          <ion-card>
            <ion-item>
              <ion-icon slot="start" :icon="swapVerticalOutline"/>
              <ion-label>{{ "Sort" }}</ion-label>
              <ion-icon :icon="optionsOutline"/>
            </ion-item>
            <ion-reorder-group :disabled="false">
              <ion-item>
                <ion-label>{{ "Proximity" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Order limit" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Inventory balance" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Custom Sequence" }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-card>
        </section>
        <section>
          <h2 class="ion-padding-start">{{ "Actions" }}</h2>
          <div class="actions">
            <ion-card>
              <ion-item lines="none">
                <ion-label>{{ "Fully available" }}</ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-chip>{{ "Next rule" }}</ion-chip>
                <ion-chip>{{ "Move to queue" }}</ion-chip>
                <ion-chip>
                  <ion-icon slot="start" :icon="checkmarkOutline" />
                  {{ "Auto cancel days: 10" }}
                </ion-chip>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-item lines="none">
                <ion-label>{{ "Partially available" }}</ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-chip>
                  <ion-icon :icon="checkmarkOutline" />
                  <ion-label>{{ "Allocate partial" }}</ion-label>
                </ion-chip>
                <ion-chip>{{ "Next rule" }}</ion-chip>
                <ion-chip>{{ "Move to queue" }}</ion-chip>
                <ion-chip>
                  <ion-icon :icon="checkmarkOutline" />
                  <ion-label>{{ "Auto cancel days: 10" }}</ion-label>
                </ion-chip>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-item lines="none">
                <ion-label>{{ "Not available" }}</ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-chip>{{ "Move to queue" }}</ion-chip>
                <ion-chip>{{ "Next rule" }}</ion-chip>
                <ion-chip>
                  <ion-icon :icon="checkmarkOutline"/>
                  <ion-label>{{ "Auto cancel days: 10" }}</ion-label>
                </ion-chip>
              </ion-item>
            </ion-card>
          </div>
        </section>
      </ion-content>
    </ion-split-pane>
  </ion-page>
</template>

<script setup lang="ts">
import { IonCard, IonChip, IonContent, IonIcon, IonItem, IonLabel, IonList, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonSplitPane } from "@ionic/vue";
import { checkmarkOutline, filterOutline, optionsOutline, swapVerticalOutline } from "ionicons/icons"
</script>

<style scoped>
.actions, .filters {
  display: grid;
  grid-template-columns: repeat(2, auto);
}
</style>
