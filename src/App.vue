<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { IonApp, IonRouterOutlet, loadingController } from "@ionic/vue";
import emitter from "@/event-bus"
import { Settings } from 'luxon'
import store from "./store";
import { translate } from "@/i18n"

const loader = ref(null) as any
const userProfile = computed(() => store.getters["user/getUserProfile"])

async function presentLoader(options = { message: "Click the backdrop to dismiss.", backdropDismiss: true }) {
  // When having a custom message remove already existing loader, if not removed it takes into account the already existing loader
  if(options.message && loader.value) dismissLoader();

  if (!loader.value) {
    loader.value = await loadingController
      .create({
        message: translate(options.message),
        translucent: true,
        backdropDismiss: options.backdropDismiss
      });
  }
  loader.value.present();
}

function dismissLoader() {
  if (loader.value) {
    loader.value.dismiss();
    loader.value = null as any;
  }
}

onMounted(async () => {
  loader.value = await loadingController
    .create({
      message: translate("Click the backdrop to dismiss."),
      translucent: true,
      backdropDismiss: true
    });
  emitter.on("presentLoader", presentLoader);
  emitter.on("dismissLoader", dismissLoader);

  if (userProfile.value) {
    // Luxon timezone should be set with the user's selected timezone
    userProfile.value.timeZone && (Settings.defaultZone = userProfile.value.timeZone);
  }
})

onUnmounted(() => {
  emitter.off("presentLoader", presentLoader);
  emitter.off("dismissLoader", dismissLoader);
})
</script>