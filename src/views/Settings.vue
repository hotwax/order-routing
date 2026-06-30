<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Settings") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content>
      <div class="user-profile">
        <ion-card>
          <ion-item lines="full">
            <ion-avatar slot="start" v-if="userProfile?.partyImageUrl">
              <Image :src="userProfile.partyImageUrl"/>
            </ion-avatar>
            <!-- ion-no-padding to remove extra side/horizontal padding as additional padding 
            is added on sides from ion-item and ion-padding-vertical to compensate the removed
            vertical padding -->
            <ion-card-header class="ion-no-padding ion-padding-vertical">
              <ion-card-subtitle>{{ userProfile?.userId }}</ion-card-subtitle>
              <ion-card-title>{{ userProfile?.userFullName }}</ion-card-title>
            </ion-card-header>
          </ion-item>
          <ion-button color="danger" @click="logout()">{{ translate("Logout") }}</ion-button>
          <ion-button :standalone-hidden="!userStore.hasPermission('COMMON_ADMIN')" fill="outline" @click="goToLaunchpad()">
            {{ translate("Go to Launchpad") }}
            <ion-icon slot="end" :icon="openOutline" />
          </ion-button>
          <!-- Commenting this code as we currently do not have reset password functionality -->
          <!-- <ion-button fill="outline" color="medium">{{ "Reset password") }}</ion-button> -->
        </ion-card>
      </div>

      <div class="section-header">
        <h1>{{ translate("OMS") }}</h1>
      </div>
      <section>
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>
              {{ translate('OMS instance') }}
            </ion-card-subtitle>
            <ion-card-title>
              {{ oms }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            {{ translate('This is the name of the OMS you are connected to right now. Make sure that you are connected to the right instance before proceeding.') }}
          </ion-card-content>
          <ion-button :disabled="!cookieHelper().get('token') || !cookieHelper().get('oms')" @click="commonUtil.goToOms()" fill="clear">
            {{ translate('Go to OMS') }}
            <ion-icon slot="end" :icon="openOutline" />
          </ion-button>
        </ion-card>
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>
              {{ translate("Product Store") }}
            </ion-card-subtitle>
            <ion-card-title>
              {{ translate("Store") }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            {{ translate("A store repesents a company or a unique catalog of products. If your OMS is connected to multiple eCommerce stores sellling different collections of products, you may have multiple Product Stores set up in HotWax Commerce.") }}
          </ion-card-content>
          <ion-item lines="none">
            <ion-select :label="translate('Select store')" interface="popover" :value="currentEComStore.productStoreId" @ionChange="setEComStore($event)">
              <ion-select-option v-for="store in ecomStores" :key="store.productStoreId" :value="store.productStoreId" >{{ store.storeName || store.productStoreId }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card>
      </section>
      <hr />
      <DxpAppVersionInfo />
      <section>
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ translate("Timezone") }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            {{ translate("The timezone you select is used to ensure automations you schedule are always accurate to the time you select.") }}
          </ion-card-content>
          <ion-item v-if="showBrowserTimeZone">
            <ion-label>
              <p class="overline">{{ translate("Browser TimeZone") }}</p>
              {{ browserTimeZone.id }}
              <p v-if="showDateTime">{{ commonUtil.getCurrentTime(browserTimeZone.id, dateTimeFormat) }}</p>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>
              <p class="overline">{{ translate("Selected TimeZone") }}</p>
              {{ currentTimeZoneId }}
              <p v-if="showDateTime">{{ commonUtil.getCurrentTime(currentTimeZoneId, dateTimeFormat) }}</p>
            </ion-label>
            <ion-button @click="changeTimeZone()" slot="end" fill="outline" color="dark">{{ translate("Change") }}</ion-button>
          </ion-item>
        </ion-card>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonAvatar, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonMenuButton, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { computed, ref } from "vue";
import { useUserStore } from "@/store/userStore";
import { productStore } from "@/store/productStore";
import { useAtpProductStore } from "@/store/atpProductStore";
import TimeZoneModal from "@/components/TimezoneModal.vue";
import Image from "@/components/Image.vue"
import { openOutline } from "ionicons/icons"
import { translate, commonUtil, cookieHelper, emitter } from "@common";
import { useAuth } from "@common/composables/useAuth";
import DxpAppVersionInfo from "@/components/DxpAppVersionInfo.vue";

const userStore = useUserStore()

const userProfile = computed(() => userStore.getUserProfile)
const currentEComStore = computed(() => productStore().getCurrentEComStore)
const ecomStores = computed(() => productStore().ecomStores)
const oms = computed(() => cookieHelper().get("oms"));
const currentTimeZoneId = computed(() => userProfile.value?.timeZone)
const browserTimeZone = ref({
  label: '',
  id: Intl.DateTimeFormat().resolvedOptions().timeZone
})

/* eslint-disable no-undef */
const props = defineProps({
  showBrowserTimeZone: {
    type: Boolean,
    default: true
  },
/* eslint-enable no-undef */
  showDateTime: {
    type: Boolean,
    default: true
  },
  dateTimeFormat: {
    type: String,
    default: 't ZZZZ'
  }
})

function setEComStore(event: CustomEvent) {
  if(ecomStores.value.length) {
    productStore().setEcomStore({
      "productStoreId": event.detail.value
    })
    const atpProductStore = useAtpProductStore();
    const store = atpProductStore.productStores.find((s: any) => s.productStoreId === event.detail.value);
    atpProductStore.setCurrentProductStore(store || { productStoreId: event.detail.value });
    emitter.emit("productStoreOrConfigChanged");
  }
}

async function changeTimeZone() {
  const timeZoneModal = await modalController.create({
    component: TimeZoneModal,
  });
  return timeZoneModal.present();
}

function logout() {
  useAuth().logout({ isUserUnauthorised: false })
}

function goToLaunchpad() {
  window.location.href = `${import.meta.env.VITE_LOGIN_URL}`
}
</script>

<style scoped>

  ion-content {
    --padding-bottom: var(--spacer-xl);
  }
  ion-card > ion-button {
    margin: var(--spacer-xs);
  }
  section {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    align-items: start;
  }
  .user-profile {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  }
  hr {
    border-top: 1px solid var(--border-medium);
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacer-xs) 10px 0px;
  }
</style>
