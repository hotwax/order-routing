<template>
  <ion-app>
    <ion-split-pane content-id="main-content">
      <RouteMenu v-if="!isOnBrokeringRunPage"/>
      <ion-router-outlet id="main-content" />
    </ion-split-pane>
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { IonApp, IonRouterOutlet, IonSplitPane, loadingController, onIonViewWillEnter } from '@ionic/vue';
import emitter from "@/event-bus"
import RouteMenu from "@/components/RouteMenu.vue"
import { useRouter } from 'vue-router';

const loader = ref(null) as any
const router = useRouter();

async function presentLoader(message = "Click the backdrop to dismiss.") {
  if (!loader.value) {
    loader.value = await loadingController
      .create({
        message,
        translucent: true,
        backdropDismiss: true
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

const isOnBrokeringRunPage = computed(() => router.currentRoute.value.fullPath === '/tabs/brokering')

onMounted(async () => {
  loader.value = await loadingController
    .create({
      message: "Click the backdrop to dismiss.",
      translucent: true,
      backdropDismiss: true
    });
  emitter.on('presentLoader', presentLoader);
  emitter.on('dismissLoader', dismissLoader);
})

onUnmounted(() => {
  emitter.off('presentLoader', presentLoader);
  emitter.off('dismissLoader', dismissLoader);
})
</script>