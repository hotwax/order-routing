import { computed, createApp, reactive } from "vue"
import App from "./App.vue"
import router from "./router";


import { IonicVue } from "@ionic/vue";

/* Core CSS required for Ionic components to work properly */
import "@ionic/vue/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/vue/css/padding.css";
import "@ionic/vue/css/float-elements.css";
import "@ionic/vue/css/text-alignment.css";
import "@ionic/vue/css/text-transformation.css";
import "@ionic/vue/css/flex-utils.css";
import "@ionic/vue/css/display.css";

/* Theme variables */
import "./theme/variables.css";
import "@hotwax/apps-theme";

import { dxpComponents } from "@hotwax/dxp-components"
import { userUtil } from "@/user-utils/userUtil";
import { getConfig, initialise } from '@/adapter';

import i18n from "./i18n"
import logger from './logger';
import permissionPlugin from '@/authorization';
import permissionRules from '@/authorization/Rules';
import permissionActions from '@/authorization/Actions';
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { useUserStore } from "./store/useUserStore";

const pinia = createPinia().use(piniaPluginPersistedstate);
const app = createApp(App)
  .use(IonicVue, {
    mode: "md"
  })
  .use(logger, {
    level: process.env.VUE_APP_DEFAULT_LOG_LEVEL
  })
  .use(router)
  .use(i18n)
  .use(pinia)
  .use(permissionPlugin, {
    rules: permissionRules,
    actions: permissionActions
  })
  .use(dxpComponents, {
    defaultImgUrl: require("@/assets/images/defaultImage.png"),
    login: userUtil.login,
    logout: userUtil.logout,
    loader: userUtil.loader,
    appLoginUrl: process.env.VUE_APP_LOGIN_URL as string,
    getConfig,
    initialise
  });

router.isReady().then(() => {
  app.mount("#app");
});

//TODO: Remove this after dxp-components is updated to replace appContext.config.globalProperties.$store and stopped calling vuex pattern getters/actions
app.config.globalProperties.$store = {
  getters: reactive({
    'user/getUserProfile': computed(() => useUserStore().getUserProfile),
    'user/getInstanceUrl': computed(() => useUserStore().getInstanceUrl),
    'user/getCurrentEComStore': computed(() => useUserStore().getCurrentEComStore),
  })
}