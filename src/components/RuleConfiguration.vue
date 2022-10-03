<template>
  <section>
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          {{ $t("Start") }}
        </ion-card-title>
      </ion-card-header>
      <ion-item>
        <ion-label>{{ $t("Run on") }}</ion-label>
        <ion-select>Trigger</ion-select>
      </ion-item>
      <ion-item>
        <ion-label>{{ $t("Trigger") }}</ion-label>
        <ion-select>Release Pre-orders</ion-select>
      </ion-item>
      <ion-item>
        <ion-label>{{ $t("Condition") }}</ion-label>
        <ion-select>Completion</ion-select>
      </ion-item>
    </ion-card>
    <ion-card>
      <ion-accordion-group>
        <ion-item>
          <h3>Route Orders</h3>
          <ion-button slot="end" fill="clear" color="medium" @click="ruleOptions($event)">
            <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
          </ion-button>
        </ion-item>
        <ion-accordion>
          <ion-item slot="header">
            <ion-label>{{ $t("View parameters") }}</ion-label>
          </ion-item>
          <div slot="content">
            <ion-item>
              <ion-label>ShipmentId: 12345678</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>ShipmentTypeId: PUR_SHIP</ion-label>
            </ion-item>
          </div>
        </ion-accordion>
      </ion-accordion-group>
    </ion-card>
    <div class="center-align">
      <ion-button @click="addAction" color="light">
        <ion-icon slot="start" :icon="addOutline" />
        {{ $t("Add Action") }}
      </ion-button>
    </div>
  </section>
</template>

<script lang="ts">
import { IonAccordionGroup, IonAccordion, IonButton, IonCard, IonCardHeader, IonCardTitle, IonItem, IonLabel, IonSelect, IonIcon, popoverController, modalController  } from '@ionic/vue';
import { addOutline, ellipsisVerticalOutline } from "ionicons/icons";
import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import RulePopover from '@/components/RulePopover.vue'
import AddActionModal from '@/components/AddActionModal.vue'

export default defineComponent({
  name: 'Home',
  components: {
    IonAccordionGroup,
    IonAccordion,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonItem,
    IonLabel,
    IonSelect
  },
  methods: {
    async ruleOptions(ev: Event){
      const popover = await popoverController
        .create({
          component: RulePopover,
          translucent: true,
          event: ev,
          showBackdrop: true,
        })
      return popover.present();
    },
    async addAction() {
      const modal = await modalController
        .create({
          component: AddActionModal
        })
        modal.onDidDismiss()
      return modal.present();
    },
  },
  setup() {
    const router = useRouter();
    const store = useStore();
    return {
      addOutline,
      ellipsisVerticalOutline,
      store,
      router
    };
  }
});
</script>
<style scoped>
@media (min-width: 991px) {  
  section {
    overflow: hidden;
    border: var(--border-medium);
    border-radius: 16px;
    max-width: 375px;
    margin: auto;
  }
  .center-align {
    display: flex;
    justify-content: center;
  }
}  
</style>