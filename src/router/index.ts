import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import Tabs from "@/views/Tabs.vue"
import { useAuth } from '@common';
import Login from "@common/components/Login.vue";

const authGuard = async () => {
  if (!useAuth().isAuthenticated.value) {
    return { path: '/login' }
  }
};

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/tabs/brokering"
  },
  {
    path: "/tabs",
    component: Tabs,
    children: [
      {
        path: "",
        redirect: "/brokering"
      },
      {
        path: "brokering",
        component: () => import("@/views/BrokeringRuns.vue")
      },
      {
        path: "brokering/:routingGroupId/routes",
        component: () => import("@/views/BrokeringRoute.vue"),
        props: true
      },
      {
        path: "brokering/:routingGroupId/routes/test",
        component: () => import("@/views/BrokeringRunTest.vue"),
        props: true
      },
      {
        path: "brokering/:routingGroupId/:orderRoutingId/rules",
        component: () => import("@/views/BrokeringQuery.vue"),
        props: true
      },
      {
        path: "settings",
        component: () => import("@/views/Settings.vue")
      },
      {
        path: "circuit",
        component: () => import("@/views/Circuit.vue")
      },
      {
        path: "simulate",
        component: () => import("@/views/SimulationHome.vue")
      },
      {
        path: "simulate/:routingGroupId",
        component: () => import("@/views/Simulation.vue")
      },
    ],
    beforeEnter: authGuard
  },
  {
    path: "/login",
    name: "Login",
    component: Login
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router