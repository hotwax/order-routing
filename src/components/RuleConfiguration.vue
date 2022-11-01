<template>
  <section>
    <div class="center-align">
      <ion-button fill="outline">
        {{ $t("Save changes") }}
      </ion-button>
    </div>
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          {{ $t("Start") }}
        </ion-card-title>
      </ion-card-header>

      <ion-item>
        <ion-label>{{ $t("Name") }}</ion-label>
        <ion-input clear-input="true" value="Morning brokering" />
      </ion-item>

      <ion-item>
        <ion-label>{{ $t("Run on") }}</ion-label>
        <ion-label class="ion-text-wrap" @click="() => isOpen = true" slot="end">8:00 am</ion-label>
          <ion-modal class="date-time-modal" :is-open="isOpen" @didDismiss="() => isOpen = false">
            <ion-content force-overscroll="false">
              <ion-datetime
                hour-cycle="h12"
              />
            </ion-content>
          </ion-modal>
      </ion-item>
      <ion-item>
        <ion-label>{{ $t("Frequency") }}</ion-label>
        <ion-select value="Every Day">
          <ion-select-option value="Every Day">
            Every Day
          </ion-select-option>
        </ion-select>
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
import { IonAccordionGroup, IonAccordion, IonButton, IonCard, IonCardHeader, IonCardTitle, IonContent, IonDatetime, IonItem, IonInput, IonLabel, IonSelect, IonSelectOption, IonIcon, IonModal, popoverController, modalController  } from '@ionic/vue';
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
    IonContent,
    IonDatetime,
    IonIcon,
    IonItem,
    IonInput,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonModal
  },
  data(){
    return {
      isOpen: false
    }
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
  .date-time-modal {
    --width: 290px;
    --height: 385px;
    --border-radius: 8px;
  }

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