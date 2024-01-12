<template>
  <ion-menu>
    <ion-content>
      <ion-list v-show="isOnBrokeringRulePage">
        <ion-list-header ref="listHeader">
          <ion-label>{{ "Order batches" }}</ion-label>
          <ion-button color="primary" fill="clear">
            {{ "New" }}
            <ion-icon :icon="addCircleOutline" />
          </ion-button>
        </ion-list-header>
        <ion-card v-for="card in [1, 2, 3, 4]" ref="cards" :key="card" @click.prevent="router.push('query')">
          <ion-item lines="full">
            <ion-label>
              <h1>{{ "Order lookup name" }}</h1>
            </ion-label>
            <ion-chip>{{ `${card}/4` }}</ion-chip>
          </ion-item>
          <ion-item ref="item">
            <ion-badge>{{ "BADGE" }}</ion-badge>
            <ion-button fill="clear" color="medium" slot="end">
              {{ "Archive" }}
            </ion-button>
          </ion-item>
        </ion-card>
      </ion-list>
      <ion-item lines="none">
        <ion-label><h1>{{ "<order lookup name>" }}</h1></ion-label>
        <ion-chip slot="end">{{ "2/4" }}
          <ion-icon :icon="chevronUpOutline"/>
        </ion-chip>
      </ion-item>
      <ion-list v-show="!isOnBrokeringRulePage">
        <ion-item-group>
          <ion-item-divider color="medium">
            <ion-label>{{ "Filters" }}</ion-label>
          </ion-item-divider>
          <ion-item>
            <ion-select label="Queue" value="Brokering Queue">
              <ion-select-option value="Brokering Queue">{{ "Brokering Queue" }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select label="Shipping method" value="Next Day">
              <ion-select-option value="Next Day">{{ "Next Day" }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select label="Order priority" value="High">
              <ion-select-option value="High">{{ "High" }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-label>{{ "Promise date" }}</ion-label>
            <ion-chip>{{ "select date" }}</ion-chip>
          </ion-item>
          <ion-item>
            <ion-select label="Queue" value="Brokering Queue">
              <ion-select-option value="Brokering Queue">{{ "Brokering Queue" }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-item-group>
      </ion-list>
      <ion-list v-show="!isOnBrokeringRulePage">
        <ion-item-group>
          <ion-item-divider color="medium">
            <ion-label>{{ "Sort" }}</ion-label>
          </ion-item-divider>
          <ion-reorder-group :disabled="false">
            <ion-item>
              <ion-label>{{ "Ship by" }}</ion-label>
              <ion-reorder />
            </ion-item>
            <ion-item>
              <ion-label>{{ "Ship after" }}</ion-label>
              <ion-reorder />
            </ion-item>
            <ion-item>
              <ion-label>{{ "Order date" }}</ion-label>
              <ion-reorder />
            </ion-item>
            <ion-item>
              <ion-label>{{ "Shipping method" }}</ion-label>
              <ion-reorder />
            </ion-item>
          </ion-reorder-group>
        </ion-item-group>
      </ion-list>
    </ion-content>
    <ion-footer v-show="isOnBrokeringRulePage">
      <ion-toolbar>
        <ion-item lines="none">
          <ion-buttons>
            <ion-button>
              <ion-icon :icon="archiveOutline"/>
              {{ "Archive" }}
            </ion-button>
          </ion-buttons>
          <ion-badge slot="end">
            {{ "4 rules" }}
          </ion-badge>
        </ion-item>
      </ion-toolbar>
    </ion-footer>
  </ion-menu>
</template>

<script setup lang="ts">
import { IonBadge, IonButtons, IonButton, IonCard, IonChip, IonContent, IonFooter, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonListHeader, IonMenu, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonToolbar, createAnimation } from "@ionic/vue";
import { addCircleOutline, archiveOutline, chevronUpOutline } from "ionicons/icons";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const cards = ref([])
const listHeader = ref(null) as any
const item = ref(null) as any

const isOnBrokeringRulePage = computed(() => router.currentRoute.value.fullPath.includes("/route"))
</script>
