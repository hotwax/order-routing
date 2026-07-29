<template>
  <img :src="imageUrl" v-if="imageUrl" />
  <ion-skeleton-text v-else animated />
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { IonSkeletonText } from '@ionic/vue'
import { logger } from "@common";
import defaultImageUrl from "@/assets/images/defaultImage.png";

const props = defineProps({
  src: {
    type: String,
    default: ""
  }
});

const resourceUrl = ref(import.meta.env.VITE_RESOURCE_URL || "");
const imageUrl = ref("");

const checkIfImageExists = (src: string) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = function () {
      resolve(true);
    }
    img.onerror = function () {
      reject(false);
    }
    img.src = src;
  })
}

const setImageUrl = () => {
  if (props.src) {
    if (props.src.indexOf("assets/") != -1) {
      // Assign directly in case of assets
      imageUrl.value = props.src;
    } else if (props.src.startsWith("http")) {
      // If starts with http, it is web url check for existence and assign
      checkIfImageExists(props.src).then(() => {
        imageUrl.value = props.src;
      }).catch(() => {
        imageUrl.value = defaultImageUrl;
        logger.error("Image doesn't exist");
      })
    } else {
      // Image is from resource server, hence append to base resource url, check for existence and assign
      const fullImageUrl = resourceUrl.value.concat(props.src)
      checkIfImageExists(fullImageUrl).then(() => {
        imageUrl.value = fullImageUrl;
      }).catch(() => {
        imageUrl.value = defaultImageUrl;
        logger.error("Image doesn't exist");
      })
    }
  }
}

onMounted(() => {
  setImageUrl();
})

// ⚡ Bolt Optimization:
// Why: `onUpdated` runs on *every* component re-render, causing redundant image existence
// checks and layout thrashing even when the source hasn't changed.
// What: Switched to explicitly watching the `src` prop.
// Impact: Eliminates unnecessary network checks and DOM updates on unrelated component re-renders.
watch(() => props.src, () => {
  setImageUrl();
})
</script>
