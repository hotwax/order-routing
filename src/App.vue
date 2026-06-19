<template>
  <ion-app>
    <ion-split-pane content-id="main-content" when="lg">
      <ion-menu
        side="start"
        content-id="main-content"
        type="overlay"
        :disabled="!useAuth().isAuthenticated.value || (router.currentRoute.value.name as string) === 'Login'"
      >
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ translate("Order Routing Rules") }}</ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <ion-list>
            <ion-list-header v-if="sourcingItems.length">
              <ion-label>{{ translate("Sourcing") }}</ion-label>
            </ion-list-header>
            <ion-menu-toggle :auto-hide="false" v-for="(page, index) in sourcingItems" :key="`s-${index}`">
              <ion-item
                button
                router-direction="root"
                :router-link="page.url"
                class="hydrated"
                :class="{ selected: isSelected(page) }"
              >
                <ion-icon slot="start" :ios="page.icon" :md="page.icon" />
                <ion-label>{{ translate(page.title) }}</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-list-header v-if="routingItems.length">
              <ion-label>{{ translate("Routing") }}</ion-label>
            </ion-list-header>
            <ion-menu-toggle :auto-hide="false" v-for="(page, index) in routingItems" :key="`r-${index}`">
              <ion-item
                button
                router-direction="root"
                :router-link="page.url"
                class="hydrated"
                :class="{ selected: isSelected(page) }"
              >
                <ion-icon slot="start" :ios="page.icon" :md="page.icon" />
                <ion-label>{{ translate(page.title) }}</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-list-header v-if="otherItems.length">
              <ion-label>{{ translate("General") }}</ion-label>
            </ion-list-header>
            <ion-menu-toggle :auto-hide="false" v-for="(page, index) in otherItems" :key="`o-${index}`">
              <ion-item
                button
                router-direction="root"
                :router-link="page.url"
                class="hydrated"
                :class="{ selected: isSelected(page) }"
              >
                <ion-icon slot="start" :ios="page.icon" :md="page.icon" />
                <ion-label>{{ translate(page.title) }}</ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>
        </ion-content>

        <ion-footer>
          <ion-toolbar>
            <ion-item lines="none">
              <ion-label class="ion-text-wrap">
                <p class="overline">{{ instanceUrl }}</p>
              </ion-label>
              <ion-note slot="end">{{ userProfile?.timeZone }}</ion-note>
            </ion-item>
            <ion-item v-if="productStores?.length > 1" lines="none">
              <ion-select
                interface="popover"
                :value="currentProductStore.productStoreId"
                @ionChange="setProductStore($event)"
              >
                <ion-select-option
                  v-for="store in productStores"
                  :key="store.productStoreId"
                  :value="store.productStoreId"
                >
                  {{ store.storeName ? store.storeName : store.productStoreId }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="currentProductStore?.productStoreId" lines="none">
              <ion-label class="ion-text-wrap">
                {{ currentProductStore.storeName ? currentProductStore.storeName : currentProductStore.productStoreId }}
              </ion-label>
            </ion-item>
          </ion-toolbar>
        </ion-footer>
      </ion-menu>
      <ion-router-outlet id="main-content" />
    </ion-split-pane>
  </ion-app>
</template>

<script setup lang="ts">
import {
  alertController,
  IonApp,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonNote,
  IonRouterOutlet,
  IonSelect,
  IonSelectOption,
  IonSplitPane,
  IonTitle,
  IonToolbar,
  loadingController,
  SelectCustomEvent
} from "@ionic/vue";
import { computed, onBeforeMount, onMounted, onUnmounted, ref } from "vue";
import { Settings } from "luxon";
import { commonUtil, emitter, translate } from "@common";
import { useAuth } from "@common/composables/useAuth";
import { useUserStore } from "@/store/userStore";
import { useAtpProductStore } from "@/store/atpProductStore";
import { productStore } from "@/store/productStore";
import { isFeatureEnabled } from "@/utils/simConfig";
import router from "@/router";

const userStore = useUserStore();
const atpProductStore = useAtpProductStore();
const loader = ref<any>(null);

const userProfile = computed(() => userStore.getUserProfile);
const currentProductStore = computed(() => atpProductStore.getCurrentProductStore);
const productStores = computed(() => atpProductStore.getProductStores);
const instanceUrl = computed(() => commonUtil.getOmsURL());

const menuItems = computed(() => {
  return router
    .getRoutes()
    .filter((route) => route.meta && route.meta.menuIndex)
    .filter(
      (route) =>
        !route.meta.permissionId ||
        (userStore as any).hasPermission(route.meta.permissionId as string)
    )
    .filter((route) => !route.meta.featureFlag || isFeatureEnabled(route.meta.featureFlag as string))
    .sort((a, b) => (a.meta!.menuIndex as number) - (b.meta!.menuIndex as number))
    .map((route) => ({
      title: route.meta!.title as string,
      url: route.path,
      icon: route.meta!.icon as string,
      childRoutes: (route.meta!.childRoutes as string[]) || [],
      section: route.meta!.section as string | undefined,
      menuIndex: route.meta!.menuIndex as number
    }));
});

const sourcingItems = computed(() => menuItems.value.filter((m) => m.section === "sourcing"));
const routingItems = computed(() => menuItems.value.filter((m) => m.section === "routing"));
const otherItems = computed(() => menuItems.value.filter((m) => !m.section));

function isSelected(page: { url: string; childRoutes: string[] }) {
  const path = router.currentRoute.value.path;
  if (page.url === path) return true;
  return page.childRoutes?.some((r) => path === r || path.includes(r));
}

async function presentLoader(options = { message: "", backdropDismiss: true }) {
  if (options.message && loader.value) dismissLoader();

  if (!loader.value) {
    loader.value = await loadingController.create({
      message: options.message ? translate(options.message) : translate("Click the backdrop to dismiss."),
      translucent: true,
      backdropDismiss: options.backdropDismiss
    });
  }
  loader.value.present();
}

function dismissLoader() {
  if (loader.value) {
    loader.value.dismiss();
    loader.value = null;
  }
}

async function setProductStore(event: SelectCustomEvent) {
  const createUpdateRoutes = [
    "/create-threshold",
    "/update-threshold/",
    "/create-safety-stock",
    "/update-safety-stock/",
    "/create-store-pickup",
    "/update-store-pickup/",
    "/create-shipping",
    "/update-shipping/"
  ];
  const path = router.currentRoute.value.path;
  if (productStores.value) {
    if (createUpdateRoutes.some((route) => path.includes(route))) {
      const alert = await alertController.create({
        header: translate("Leave page"),
        message: translate("Any change made on this page will be lost. You will not be able to reverse this action."),
        buttons: [
          {
            text: translate("No"),
            role: "cancel",
            handler: async () => {
              (event.target as any).value = currentProductStore.value.productStoreId;
            }
          },
          {
            text: translate("Yes"),
            handler: async () => {
              await atpProductStore.setCurrentProductStore({ productStoreId: event.detail.value });
              productStore().setEcomStore({ productStoreId: event.detail.value });
              emitter.emit("productStoreOrConfigChanged");
            }
          }
        ]
      });
      alert.present();
    } else {
      atpProductStore.setCurrentProductStore({ productStoreId: event.detail.value });
      productStore().setEcomStore({ productStoreId: event.detail.value });
      emitter.emit("productStoreOrConfigChanged");
    }
  }
}

onBeforeMount(() => {
  emitter.on("presentLoader", presentLoader as any);
  emitter.on("dismissLoader", dismissLoader as any);
});

onMounted(() => {
  if (userProfile.value && userProfile.value.timeZone) {
    Settings.defaultZone = userProfile.value.timeZone;
  }
});

onUnmounted(() => {
  emitter.off("presentLoader", presentLoader as any);
  emitter.off("dismissLoader", dismissLoader as any);
});
</script>

<style scoped>
ion-menu.md ion-item.selected ion-icon {
  color: var(--ion-color-secondary);
}
ion-menu.ios ion-item.selected ion-icon {
  color: var(--ion-color-secondary);
}
ion-item.selected {
  --color: var(--ion-color-secondary);
}
</style>
