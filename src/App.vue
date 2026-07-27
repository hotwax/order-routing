<template>
  <ion-app>
    <ion-split-pane content-id="main-content" when="lg">
      <ion-menu
        side="start"
        content-id="main-content"
        type="overlay"
        :disabled="!useAuth().isAuthenticated || router.currentRoute.value.name === 'Login'"
      >
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ translate("Order Routing Rules") }}</ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <ion-list>
            <ion-menu-toggle :auto-hide="false">
              <ion-item
                button
                router-direction="root"
                router-link="/dashboard"
                class="hydrated"
                :class="{ selected: isSelected({ url: '/dashboard', childRoutes: [] }) }"
              >
                <ion-icon slot="start" :ios="gridOutline" :md="gridOutline" />
                <ion-label>{{ translate("Dashboard") }}</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-list-header v-if="sourcingItems.length" color="light">
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

            <ion-list-header v-if="routingItems.length" color="light">
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

            <ion-list-header v-if="otherItems.length" color="light">
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
    <!-- Fast Travel: Cmd/Ctrl+K app switcher + deep-link router across the HotWax suite -->
    <FastTravel v-if="useAuth().isAuthenticated" current-app="order-routing" />
  </ion-app>
</template>

<script lang="ts">
export interface GlobalLoaderOptions {
  message?: string;
  backdropDismiss?: boolean;
}

interface LoaderOverlay {
  present: () => Promise<void>;
  dismiss: () => Promise<boolean | void>;
  remove?: () => void;
  onDidDismiss?: () => Promise<unknown>;
}

interface LoaderLifecycle {
  version: number;
  ready: Promise<void>;
}

/**
 * Coordinates the app-wide Ionic loader without allowing an older async lifecycle to affect
 * the loader that replaced it. Each present/dismiss pair owns one request; the visible loader
 * is dismissed only after the final concurrent request finishes.
 */
export function createGlobalLoaderLifecycle(
  createOverlay: (options: {
    message: string;
    translucent: boolean;
    backdropDismiss?: boolean;
  }) => Promise<LoaderOverlay>,
  translateMessage: (message: string) => string
) {
  let activeOverlay: LoaderOverlay | null = null;
  let activeRequestCount = 0;
  let lifecycle: LoaderLifecycle | null = null;
  let lifecycleVersion = 0;

  async function safelyDismiss(candidate: LoaderOverlay) {
    try {
      await candidate.dismiss();
    } catch {
      // Ionic can reject when an overlay was already removed or dismissed. The lifecycle's
      // identity checks still ensure that a rejection cannot affect the replacement loader.
    }
  }

  function removeUnpresented(candidate: LoaderOverlay) {
    try {
      candidate.remove?.();
    } catch {
      // The candidate was superseded before it could present and may already be detached.
    }
  }

  async function activate(record: LoaderLifecycle, options: GlobalLoaderOptions) {
    let candidate: LoaderOverlay;
    try {
      candidate = await createOverlay({
        message: options.message
          ? translateMessage(options.message)
          : translateMessage("Click the backdrop to dismiss."),
        translucent: true,
        backdropDismiss: options.backdropDismiss
      });
    } catch (error) {
      if (lifecycle === record) lifecycle = null;
      throw error;
    }

    // A newer presentation or a final dismiss arrived while Ionic was creating this overlay.
    // It was never presented, so remove its host element rather than letting it become current.
    if (
      lifecycle !== record ||
      lifecycleVersion !== record.version ||
      activeRequestCount === 0
    ) {
      removeUnpresented(candidate);
      return;
    }

    activeOverlay = candidate;
    try {
      await candidate.present();
    } catch (error) {
      if (activeOverlay === candidate) activeOverlay = null;
      if (lifecycle === record) lifecycle = null;
      removeUnpresented(candidate);
      throw error;
    }

    // Ionic ignores a dismiss while its present animation is in flight. Reconcile after that
    // animation settles, but only against this exact overlay so a stale completion cannot
    // dismiss or retain the current replacement.
    if (
      lifecycle !== record ||
      lifecycleVersion !== record.version ||
      activeOverlay !== candidate ||
      activeRequestCount === 0
    ) {
      await safelyDismiss(candidate);
      if (activeOverlay === candidate) activeOverlay = null;
      return;
    }

    // Keep internal state accurate when the user dismisses a backdrop-enabled loader directly.
    if (candidate.onDidDismiss) {
      void candidate.onDidDismiss().then(() => {
        if (
          lifecycle === record &&
          lifecycleVersion === record.version &&
          activeOverlay === candidate
        ) {
          activeOverlay = null;
          // Backdrop dismissal only removes the visual overlay. Keep request ownership intact:
          // every caller that presented the loader must still release its own count. Resetting the
          // aggregate here lets an older caller's later dismiss consume a newer request's ownership
          // and prematurely dismiss the replacement overlay.
          lifecycle = null;
          lifecycleVersion += 1;
        }
      }).catch(() => undefined);
    }
  }

  function start(options: GlobalLoaderOptions) {
    lifecycleVersion += 1;
    const record: LoaderLifecycle = {
      version: lifecycleVersion,
      ready: Promise.resolve()
    };
    const previous = activeOverlay;

    activeOverlay = null;
    lifecycle = record;
    if (previous) void safelyDismiss(previous);

    record.ready = activate(record, options);
    return record.ready;
  }

  function present(options: GlobalLoaderOptions = { message: "", backdropDismiss: true }) {
    activeRequestCount += 1;

    // A message-bearing request represents a new visible operation and replaces the existing
    // visual loader. Message-less concurrent requests share the current global loader.
    if (!lifecycle || options.message) return start(options);
    return lifecycle.ready;
  }

  function dismiss() {
    if (activeRequestCount > 0) activeRequestCount -= 1;
    if (activeRequestCount > 0) return;

    lifecycleVersion += 1;
    const candidate = activeOverlay;
    activeOverlay = null;
    lifecycle = null;
    if (candidate) void safelyDismiss(candidate);
  }

  return { present, dismiss };
}
</script>

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
import { computed, onBeforeMount, onMounted, onUnmounted } from "vue";
import { gridOutline } from "ionicons/icons";
import { Settings } from "luxon";
import { commonUtil, emitter, FastTravel, translate } from "@common";
import { useAuth } from "@common/composables/useAuth";
import { useUserStore } from "@/store/userStore";
import { useAtpProductStore } from "@/store/atpProductStore";
import { productStore } from "@/store/productStore";
import { isFeatureEnabled } from "@/utils/simConfig";
import { isRoutingRecordRoute } from "@/utils/routingWorkingCopy";
import router from "@/router";

const userStore = useUserStore();
const atpProductStore = useAtpProductStore();
const loaderLifecycle = createGlobalLoaderLifecycle(
  (options) => loadingController.create(options),
  translate
);

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

async function presentLoader(options: GlobalLoaderOptions = { message: "", backdropDismiss: true }) {
  await loaderLifecycle.present(options);
}

function dismissLoader() {
  loaderLifecycle.dismiss();
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
    if (isRoutingRecordRoute(path)) {
      // A detail/Test Drive page is bound to the routing group's own product-store context. Keep
      // the selector aligned with that record; the user can return to the list (resolving any
      // unsaved-change guard) before switching stores.
      (event.target as any).value = currentProductStore.value?.productStoreId || event.detail.value;
      commonUtil.showToast(translate("Return to the routing list before changing product store."));
      return;
    }
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
              const store = productStores.value.find((s: any) => s.productStoreId === event.detail.value);
              atpProductStore.setCurrentProductStore(store || { productStoreId: event.detail.value });
              productStore().setEcomStore({ productStoreId: event.detail.value });
              emitter.emit("productStoreOrConfigChanged");
            }
          }
        ]
      });
      alert.present();
    } else {
      const store = productStores.value.find((s: any) => s.productStoreId === event.detail.value);
      atpProductStore.setCurrentProductStore(store || { productStoreId: event.detail.value });
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
