<template>
  <div class="route-menu">
    <div>
      <ion-list>
        <ion-list-header ref="listHeader">
          <ion-label>{{ "Order batches" }}</ion-label>
          <ion-button color="primary" fill="clear">
            {{ "New" }}
            <ion-icon :icon="addCircleOutline" />
          </ion-button>
        </ion-list-header>
        <ion-card v-for="card in [1, 2, 3, 4]" ref="cards" :key="card" @click.prevent="animate">
          <ion-item lines="full">
            <ion-label>
              <h1>{{ 'Order lookup name' }}</h1>
            </ion-label>
            <ion-chip>{{ `${card}/4` }}</ion-chip>
          </ion-item>
          <ion-item v-show="isOnBrokeringRulePage" ref="item">
            <ion-badge>{{ 'BADGE' }}</ion-badge>
            <ion-button fill="clear" color="medium" slot="end">
              {{ 'Archive' }}
            </ion-button>
          </ion-item>
        </ion-card>
      </ion-list>
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
      <ion-list v-show="!isOnBrokeringRulePage">
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
      <ion-list v-show="!isOnBrokeringRulePage">
        <ion-item-group>
          <ion-item-divider color="medium">
            <ion-label>{{ 'Sort' }}</ion-label>
          </ion-item-divider>
          <ion-reorder-group :disabled="false">
            <ion-item>
              <ion-label>{{ 'Ship by' }}</ion-label>
              <ion-reorder />
            </ion-item>
            <ion-item>
              <ion-label>{{ 'Ship after' }}</ion-label>
              <ion-reorder />
            </ion-item>
            <ion-item>
              <ion-label>{{ 'Order date' }}</ion-label>
              <ion-reorder />
            </ion-item>
            <ion-item>
              <ion-label>{{ 'Shipping method' }}</ion-label>
              <ion-reorder />
            </ion-item>
          </ion-reorder-group>
        </ion-item-group>
      </ion-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonButtons, IonButton, IonCard, IonChip, IonFooter, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonListHeader, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonToolbar, createAnimation } from '@ionic/vue';
import { addCircleOutline, archiveOutline } from "ionicons/icons";
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const cards = ref([])
const listHeader = ref(null) as any
const item = ref(null) as any
const moveTop = ref(0)

const isOnBrokeringRulePage = computed(() => router.currentRoute.value.fullPath.includes('/route'))

function animate(e: Event) {
  if(isOnBrokeringRulePage.value) {
    routeForward(e)
  } else {
    routeBackward(e)
  }
}

function routeForward(e: Event) {
  const element = e.currentTarget as HTMLElement
  const hideCards = cards.value.map((card: any) => {
    if(element != card.$el) {
      return card.$el
    }
  }).filter(card => card)

  
  createAnimation()
    .addElement(listHeader.value.$el)
    .addElement(item.value.$el)
    .addElement(hideCards)
    .duration(1000)
    .fromTo('opacity', '1', '0')
    .to('display', 'none').play()
  
  moveTop.value = element.getBoundingClientRect().top

  createAnimation()
    .addElement(element)
    .duration(1000)
    .fromTo('transform', 'translateY(0px)', `translateY(-${moveTop.value}px)`).play()

  router.push('query')
}

function routeBackward(e: Event) {
  const showCards = cards.value.map((card: any) => {
    if(e.currentTarget != card.$el) {
      return card.$el
    }
  }).filter(card => card)
  const element = e.currentTarget as HTMLElement
  
  createAnimation()
  .addElement(listHeader.value.$el)
  .addElement(item.value.$el)
  .addElement(showCards)
  .duration(1000)
  .fromTo('opacity', '0', '1')
  .to('display', 'block').play()
  
  createAnimation()
    .addElement(element)
    .duration(1000)
    .fromTo('transform', `translateY(-${moveTop.value}px)`, 'translateY(0px)').play();

  router.go(-1)
}

</script>

<style scoped>
.route-menu > div {
  width: 100%;
}
</style>
