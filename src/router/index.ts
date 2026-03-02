import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import Tabs from "@/views/Tabs.vue"
import { useAuth } from '@/composables/auth';
import Login from "@/views/Login.vue";

const authGuard = async (to: any, from: any, next: any) => {
  if (!useAuth().isAuthenticated.value) {
    next('/login')
  }
  next()
};

const loginGuard = (to: any, from: any, next: any) => {
  if (useAuth().isAuthenticated.value && !to.query?.token && !to.query?.oms) {
    next('/')
  }
  next();
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
      }
    ],
    beforeEnter: authGuard
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
    beforeEnter: loginGuard
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router