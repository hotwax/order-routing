<template>
  <div class="route-menu">
    <div v-if="isOnBrokeringRuleRoute">
      <ion-list>
        <ion-list-header>
          <ion-label>{{ "Order batches" }}</ion-label>
          <ion-button color="primary" fill="clear">
            {{ "New" }}
            <ion-icon :icon="addCircleOutline" />
          </ion-button>
        </ion-list-header>
        <ion-card ref="card" @click="router.push('query')">
          <ion-item lines="full">
            <ion-label>
              <h1>{{ 'Order lookup name' }}</h1>
            </ion-label>
            <ion-chip >{{ '1/4' }}</ion-chip>
          </ion-item>
          <ion-item ref="item">
            <ion-badge>{{ 'BADGE' }}</ion-badge>
            <ion-button fill="clear" color="medium" slot="end">
              {{ 'Archive' }}
            </ion-button>
          </ion-item>
        </ion-card>
        <ion-card ref="card" @click="router.push('query')">
          <ion-item lines="full">
            <ion-label>
              <h1>{{ 'Order lookup name' }}</h1>
            </ion-label>
            <ion-chip >{{ '2/4' }}</ion-chip>
          </ion-item>
          <ion-item ref="item">
            <ion-badge>{{ 'BADGE' }}</ion-badge>
            <ion-button fill="clear" color="medium" slot="end">
              {{ 'Archive' }}
            </ion-button>
          </ion-item>
        </ion-card>
        <ion-card ref="card" @click="router.push('query')">
          <ion-item lines="full">
            <ion-label>
              <h1>{{ 'Order lookup name' }}</h1>
            </ion-label>
            <ion-chip >{{ '3/4' }}</ion-chip>
          </ion-item>
          <ion-item ref="item">
            <ion-badge>{{ 'BADGE' }}</ion-badge>
            <ion-button fill="clear" color="medium" slot="end">
              {{ 'Archive' }}
            </ion-button>
          </ion-item>
        </ion-card>
        <ion-card ref="card" @click="router.push('query')">
          <ion-item lines="full">
            <ion-label>
              <h1>{{ 'Order lookup name' }}</h1>
            </ion-label>
            <ion-chip >{{ '4/4' }}</ion-chip>
          </ion-item>
          <ion-item ref="item">
            <ion-badge>{{ 'BADGE' }}</ion-badge>
            <ion-button fill="clear" color="medium" slot="end">
              {{ 'Archive' }}
            </ion-button>
          </ion-item>
        </ion-card>
      </ion-list>
      <ion-footer>
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
    </div>
    <div v-else>
      <ion-list>
        <ion-item-group>
          <ion-item-divider color="medium">
            <ion-label>{{ 'Filters' }}</ion-label>
          </ion-item-divider>
          <ion-item>
            <ion-select label="Queue" value="Brokering Queue">
              <ion-select-option value="Brokering Queue">{{ 'Brokering Queue' }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select label="Shipping method" value="Next Day">
              <ion-select-option value="Next Day">{{ 'Next Day' }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-select label="Order priority" value="High">
              <ion-select-option value="High">{{ 'High' }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-label>{{ 'Promise date' }}</ion-label>
            <ion-chip>{{ 'select date' }}</ion-chip>
          </ion-item>
          <ion-item>
            <ion-select label="Queue" value="Brokering Queue">
              <ion-select-option value="Brokering Queue">{{ 'Brokering Queue' }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-item-group>
      </ion-list>
      <ion-list>
        <ion-item-group>
          <ion-item-divider color="medium">
            <ion-label>{{ 'Sort' }}</ion-label>
          </ion-item-divider>
          <ion-item>
            <ion-label>{{ 'Ship by' }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ 'Ship after' }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ 'Order date' }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ 'Shipping method' }}</ion-label>
          </ion-item>
        </ion-item-group>
      </ion-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonButtons, IonButton, IonCard, IonChip, IonFooter, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonListHeader, IonSelect, IonSelectOption, IonToolbar, onIonViewWillEnter } from '@ionic/vue';
import { addCircleOutline, archiveOutline } from "ionicons/icons";
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const isOnBrokeringRuleRoute = ref(true)
const router = useRouter();

onIonViewWillEnter(() => {
  isOnBrokeringRuleRoute.value = router.currentRoute.value.fullPath.includes('/brokering/route')
})
</script>

<style scoped>
.route-menu > div {
  width: 100%;
}
</style>
