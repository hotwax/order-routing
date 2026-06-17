import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import { useAuth } from "@common/composables/useAuth";
import Login from "@common/components/Login.vue";
import {
  albumsOutline,
  businessOutline,
  cloudUploadOutline,
  globeOutline,
  pulseOutline,
  sendOutline,
  settingsOutline,
  shuffleOutline,
  storefrontOutline
} from "ionicons/icons";

import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    permissionId?: string;
    title?: string;
    icon?: string;
    menuIndex?: number;
    section?: "sourcing" | "routing" | "foundations";
    childRoutes?: string[];
  }
}

const authGuard = async (to: any, _from: any, next: any) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated.value) {
    to.fullPath !== "/" && localStorage.setItem("requestedPagePath", to.fullPath);
    return next("/login");
  }
  next();
};

const routes: Array<RouteRecordRaw> = [
  { path: "/", redirect: "/threshold" },

  // -------------------- Sourcing (ATP) --------------------
  {
    path: "/threshold",
    name: "Threshold",
    component: () => import("@/views/Threshold.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Threshold",
      icon: globeOutline,
      section: "sourcing",
      menuIndex: 1,
      childRoutes: ["/create-threshold", "/update-threshold/"]
    }
  },
  {
    path: "/safety-stock",
    name: "Safety stock",
    component: () => import("@/views/SafetyStock.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Safety stock",
      icon: pulseOutline,
      section: "sourcing",
      menuIndex: 2,
      childRoutes: ["/create-safety-stock", "/update-safety-stock/"]
    }
  },
  {
    path: "/store-pickup",
    name: "Store pickup",
    component: () => import("@/views/StorePickup.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Store pickup",
      icon: storefrontOutline,
      section: "sourcing",
      menuIndex: 3,
      childRoutes: ["/create-store-pickup", "/update-store-pickup/"]
    }
  },
  {
    path: "/shipping",
    name: "Shipping",
    component: () => import("@/views/Shipping.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Shipping",
      icon: sendOutline,
      section: "sourcing",
      menuIndex: 4,
      childRoutes: ["/create-shipping", "/update-shipping/"]
    }
  },
  {
    path: "/inventory-channels",
    name: "Inventory channels",
    component: () => import("@/views/InventoryChannels.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Inventory channels",
      icon: cloudUploadOutline,
      section: "sourcing",
      menuIndex: 5
    }
  },
  {
    path: "/inventory",
    name: "Inventory",
    component: () => import("@/views/Inventory.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Inventory",
      icon: albumsOutline,
      section: "sourcing",
      menuIndex: 6,
      childRoutes: ["/inventory/"]
    }
  },
  {
    path: "/inventory/:productId",
    name: "Inventory detail",
    component: () => import("@/views/InventoryDetail.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/create-threshold",
    name: "Create threshold",
    component: () => import("@/views/CreateUpdateThresholdRule.vue"),
    beforeEnter: authGuard
  },
  {
    path: "/create-safety-stock",
    name: "Create safety stock",
    component: () => import("@/views/CreateUpdateSafetyStockRule.vue"),
    beforeEnter: authGuard
  },
  {
    path: "/create-store-pickup",
    name: "Create store pickup",
    component: () => import("@/views/CreateUpdateStorePickupRule.vue"),
    beforeEnter: authGuard
  },
  {
    path: "/create-shipping",
    name: "Create shipping",
    component: () => import("@/views/CreateUpdateShippingRule.vue"),
    beforeEnter: authGuard
  },
  {
    path: "/update-threshold/:ruleId",
    name: "Update threshold",
    component: () => import("@/views/CreateUpdateThresholdRule.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/update-safety-stock/:ruleId",
    name: "Update safety stock",
    component: () => import("@/views/CreateUpdateSafetyStockRule.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/update-store-pickup/:ruleId",
    name: "Update store pickup",
    component: () => import("@/views/CreateUpdateStorePickupRule.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/update-shipping/:ruleId",
    name: "Update shipping",
    component: () => import("@/views/CreateUpdateShippingRule.vue"),
    beforeEnter: authGuard,
    props: true
  },

  // -------------------- Routing (Brokering) --------------------
  {
    path: "/brokering",
    name: "Brokering",
    component: () => import("@/views/BrokeringRuns.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Brokering",
      icon: shuffleOutline,
      section: "routing",
      menuIndex: 10,
      childRoutes: ["/brokering/"]
    }
  },
  {
    path: "/brokering/:routingGroupId/routes",
    component: () => import("@/views/BrokeringRoute.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/brokering/:routingGroupId/routes/test",
    component: () => import("@/views/BrokeringRunTest.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/brokering/:routingGroupId/:orderRoutingId/rules",
    component: () => import("@/views/BrokeringQuery.vue"),
    beforeEnter: authGuard,
    props: true
  },

  // -------------------- Foundations --------------------
  {
    path: "/facility-groups",
    name: "Facility groups",
    component: () => import("@/views/FacilityGroups.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Facility groups",
      icon: businessOutline,
      section: "foundations",
      menuIndex: 15
    }
  },

  // -------------------- Settings & auth --------------------
  {
    path: "/settings",
    name: "Settings",
    component: () => import("@/views/Settings.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Settings",
      icon: settingsOutline,
      menuIndex: 20
    }
  },
  {
    path: "/login",
    name: "Login",
    component: Login
  },

  // -------------------- Legacy /tabs/* redirects --------------------
  { path: "/tabs", redirect: "/brokering" },
  { path: "/tabs/brokering", redirect: "/brokering" },
  { path: "/tabs/settings", redirect: "/settings" },
  {
    path: "/tabs/brokering/:routingGroupId/routes",
    redirect: (to) => `/brokering/${to.params.routingGroupId}/routes`
  },
  {
    path: "/tabs/brokering/:routingGroupId/routes/test",
    redirect: (to) => `/brokering/${to.params.routingGroupId}/routes/test`
  },
  {
    path: "/tabs/brokering/:routingGroupId/:orderRoutingId/rules",
    redirect: (to) =>
      `/brokering/${to.params.routingGroupId}/${to.params.orderRoutingId}/rules`
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
