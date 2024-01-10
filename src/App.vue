<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { IonApp, IonRouterOutlet, loadingController } from '@ionic/vue';
import emitter from "@/event-bus"

const loader = ref(null) as any

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