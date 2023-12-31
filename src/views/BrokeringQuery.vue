<template>
  <ion-page>
    <ion-split-pane content-id="query-content">
      <ion-list>
        <ion-item>
          <ion-label>{{ "Warehouse only" }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "Warehouse and stores" }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "Any Location" }}</ion-label>
        </ion-item>
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
              <ion-icon :icon="swapVerticalOutline"/>
              <ion-label>{{ "Sort" }}</ion-label>
              <ion-icon :icon="optionsOutline"/>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Proximity" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Order limit" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Inventory balance" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Custom Sequence" }}</ion-label>
            </ion-item>
          </ion-card>
        </section>
        <section class="actions">
          <h2 class="ion-padding-start">{{ "Actions" }}</h2>
          <ion-card>
            <ion-item lines="none">
              <ion-label>{{ "Fully available" }}</ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-chip>{{ "Next rule" }}</ion-chip>
              <ion-chip>{{ "Move to queue" }}</ion-chip>
              <ion-chip>
                <ion-icon :icon="checkMarkOutline"/>
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
                <ion-icon :icon="checkMarkOutline"/>
                {{ "Allocate partial" }}
              </ion-chip>
              <ion-chip>{{ "Next rule" }}</ion-chip>
              <ion-chip>{{ "Move to queue" }}</ion-chip>
              <ion-chip>
                <ion-icon :icon="checkMarkOutline"/>
                {{ "Auto cancel days: 10" }}
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
                <ion-icon :icon="checkMarkOutline"/>
                {{ "Auto cancel days: 10" }}
              </ion-chip>
            </ion-item>
          </ion-card>
        </section>
      </ion-content>
    </ion-split-pane>
  </ion-page>
</template>

<script setup lang="ts">
import { IonCard, IonChip, IonContent, IonIcon, IonItem, IonLabel, IonList, IonPage, IonSelect, IonSelectOption, IonSplitPane } from "@ionic/vue";
import { checkMarkOutline, filterOutline, optionsOutline, swapVerticalOutline } from "ionicons/icons"
</script>
