<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { IonApp, IonRouterOutlet, loadingController } from "@ionic/vue";
import { Settings } from 'luxon'
import { emitter, translate, initialise, resetConfig } from '@common'
import { useUserStore } from "./store/userStore";
import { useAuth } from "./composables/auth";
import router from "./router";

const userStore = useUserStore()

const userProfile = computed(() => userStore.getUserProfile)
const loader = ref(null) as any
const maxAge = import.meta.env.VITE_VUE_APP_CACHE_MAX_AGE ? parseInt(import.meta.env.VITE_VUE_APP_CACHE_MAX_AGE) : 0

initialise({
  cacheMaxAge: maxAge,
  events: {
    unauthorised: unauthorized,
    responseError: () => {
      setTimeout(() => dismissLoader(), 100);
    },
    queueTask: (payload: any) => {
      emitter.emit("queueTask", payload);
    }
  }
})

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

async function unauthorized() {
  // Mark the user as unauthorised, this will help in not making the logout api call in actions
  const redirectionUrl = await useAuth().logout({ isUserUnauthorised: true });
  if(redirectionUrl) {
    window.location.href = redirectionUrl
  } else {
    router.replace("/login");
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

  resetConfig()
})
</script>