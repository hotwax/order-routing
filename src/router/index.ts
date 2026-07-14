import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import { useAuth } from "@common/composables/useAuth";
import Login from "@common/components/Login.vue";
import { isFeatureEnabled } from "@/utils/simConfig";
import {
  albumsOutline,
  businessOutline,
  calendarOutline,
  cloudUploadOutline,
  flaskOutline,
  globeOutline,
  pulseOutline,
  sendOutline,
  settingsOutline,
  storefrontOutline
} from "ionicons/icons";

import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    permissionId?: string;
    title?: string;
    icon?: string;
    menuIndex?: number;
    section?: "sourcing" | "routing";
    childRoutes?: string[];
    featureFlag?: string;
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

// Same as authGuard, but first redirects away when the simulation feature is disabled for this
// deployment (VITE_SIMULATION_ENABLED="false"), so /simulate* can't be reached by URL/bookmark.
const simulateGuard = (to: any, from: any, next: any) =>
  isFeatureEnabled("simulation") ? authGuard(to, from, next) : next("/order-routing");

const routes: Array<RouteRecordRaw> = [
  { path: "/", redirect: "/dashboard" },

  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/views/Dashboard.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Dashboard"
    }
  },

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

  // -------------------- Order Routing --------------------
  {
    path: "/order-routing",
    name: "Order Routing",
    component: () => import("@/views/OrderRoutingList.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Order Routing",
      icon: calendarOutline,
      section: "routing",
      menuIndex: 10,
      childRoutes: ["/order-routing/"]
    }
  },
  {
    path: "/order-routing/:routingGroupId",
    component: () => import("@/views/RoutingDetail.vue"),
    beforeEnter: authGuard,
    props: true
  },
  {
    path: "/order-routing/:routingGroupId/test",
    component: () => import("@/views/RoutingGroupTest.vue"),
    beforeEnter: authGuard,
    props: true
  },
  // Redirect the pre-rename paths so existing bookmarks / deep links keep working.
  { path: "/brokering-calendar", redirect: "/order-routing" },
  { path: "/brokering/:routingGroupId/routes", redirect: (to) => `/order-routing/${to.params.routingGroupId}` },
  { path: "/brokering/:routingGroupId/routes/test", redirect: (to) => `/order-routing/${to.params.routingGroupId}/test` },
  {
    // Simulating a routing group now happens on its detail page (the Variations rail); this route is
    // the cross-group archive of past simulation runs. Editing at /simulate/:id was removed.
    path: "/simulate",
    name: "Simulation history",
    component: () => import("@/views/SimulationHome.vue"),
    beforeEnter: simulateGuard,
    meta: {
      title: "Simulation history",
      icon: flaskOutline,
      section: "routing",
      menuIndex: 11,
      childRoutes: ["/simulate/"],
      featureFlag: "simulation"
    }
  },
  {
    path: "/simulate/history/:simulationId",
    name: "PastSimulationDetail",
    component: () => import("@/views/PastSimulationDetail.vue"),
    beforeEnter: simulateGuard,
    props: true
  },

  {
    path: "/facility-groups",
    name: "Facility groups",
    component: () => import("@/views/FacilityGroups.vue"),
    beforeEnter: authGuard,
    meta: {
      title: "Facility groups",
      icon: businessOutline,
      section: "routing",
      menuIndex: 11
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

];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
