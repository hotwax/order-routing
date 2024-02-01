<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal"> 
          <ion-icon :icon="close" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ $t("Select time zone") }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar @ionFocus="selectSearchBarText($event)" :placeholder="$t('Search time zones')"  v-model="queryString" v-on:keyup.enter="queryString = $event.target.value; findTimeZone()" />
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <!-- Empty state -->
    <div class="empty-state" v-if="filteredTimeZones.length === 0">
      <p>{{ $t("No time zone found")}}</p>
    </div>

    <!-- Timezones -->
    <div v-else>
      <ion-list>
        <ion-radio-group value="rd" v-model="timeZoneId">
          <ion-item :key="timeZone.id" v-for="timeZone in filteredTimeZones">
            <ion-radio label-placement="end" justify="start" :value="timeZone.id">{{ timeZone.label }} ({{ timeZone.id }})</ion-radio>
          </ion-item>
        </ion-radio-group>
      </ion-list>
    </div>
    
    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!timeZoneId" @click="setUserTimeZone">
        <ion-icon :icon="save" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { 
  IonButtons,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonItem,
  IonIcon,
  IonRadioGroup,
  IonRadio,
  IonList,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  modalController,
} from "@ionic/vue";
import { onBeforeMount, ref } from "vue";
import { close, save } from "ionicons/icons";
import { useStore } from "@/store";
import { UserService } from "@/services/UserService";
import { hasError } from "@/utils"
import { DateTime } from "luxon";

const store = useStore();
let queryString = ref("")
let filteredTimeZones = ref([])
let timeZones = ref([])
let timeZoneId = ref("")

onBeforeMount(() => {
  getAvailableTimeZones();
})

function closeModal() {
  modalController.dismiss({ dismissed: true });
}

function escapeRegExp(text: string) {
  //TODO Handle it in a better way
  // Currently when the user types special character as it part of Regex expressions it breaks the code
  // so removed the characters for now
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function findTimeZone() { 
  const regularExp = new RegExp(`${escapeRegExp(queryString.value)}`, "i");
  filteredTimeZones.value = timeZones.value.filter((timeZone: any) => {
    return regularExp.test(timeZone.id) || regularExp.test(timeZone.label);
  });
}

function getAvailableTimeZones() {
  UserService.getAvailableTimeZones().then((resp: any) => {
    if (resp.status === 200 && !hasError(resp)) {
      timeZones.value = resp.data.timeZones.filter((timeZone: any) => {
        return DateTime.local().setZone(timeZone.id).isValid;
      });
      findTimeZone();
    }
  })
}

function selectSearchBarText(event: any) {
  event.target.getInputElement().then((element: any) => {
    element.select();
  })
}

async function setUserTimeZone() {
  return store.dispatch("user/setUserTimeZone", {
    "tzId": timeZoneId.value
  }).then(() => {
    closeModal()
  })
}
</script>
