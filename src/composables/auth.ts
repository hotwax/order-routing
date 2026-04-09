import { useUserStore } from "@/store/userStore";
import { productStore } from "@/store/productStore";
import { translate } from "@common";
import { logger, emitter, api, cookieHelper, commonUtil } from "@common";
import { DateTime } from "luxon";
import { computed, ref } from "vue";
import router from "@/router";

interface LoginOption {
  loginAuthType?: string,
  maargInstanceUrl?: string,
  loginAuthUrl?: string
}

export function useAuth() {
  const loginOption = ref<LoginOption>({})

  const clearAuth = () => {
    cookieHelper().remove('token');
    cookieHelper().remove('expirationTime');
    cookieHelper().remove('maarg');
    cookieHelper().remove('oms');
  }

  const isAuthenticated = computed(() => {
    let isTokenExpired = false;
    const token = cookieHelper().get("token");
    const expirationTime = Number(cookieHelper().get("expirationTime"));
    if (expirationTime) {
      const currTime = DateTime.now().toMillis();
      isTokenExpired = expirationTime < currTime;
    }
    return !!(token && !isTokenExpired);
  })

  const login = async (username: string, password: string) => {
    try {
      const resp = await api({
        url: "login",
        method: "post",
        data: {
          "USERNAME": username,
          "PASSWORD": password
        },
        baseURL: commonUtil.getOmsURL()
      });
      if (commonUtil.hasError(resp)) {
        commonUtil.showToast(translate('Sorry, your username or password is incorrect. Please try again.'));
        console.error("error", resp.data._ERROR_MESSAGE_);
        return Promise.reject(new Error(resp.data._ERROR_MESSAGE_));
      }

      cookieHelper().set("token", resp.data.token)
      cookieHelper().set("expirationTime", resp.data.expirationTime)

      await useUserStore().fetchUserProfile();
      await useUserStore().fetchPermissions();
      await productStore().fetchEComStores();
      await useUserStore().fetchAvailableTimeZones();

    } catch (err: any) {
      commonUtil.showToast(translate("Something went wrong while login. Please contact administrator."));
      console.error("error: ", err.toString());
      clearAuth();
      return Promise.reject(err instanceof Object ? err : new Error(err));
    }
  }

  const logout = async (payload?: any) => {
    let redirectionUrl = "";
    emitter.emit("presentLoader", {
      message: "Logging out",
      backdropDismiss: false,
    });

    if (!payload?.isUserUnauthorised) {
      let resp;
      try {
        resp = await api({
          url: "logout",
          method: "GET",
          baseURL: commonUtil.getOmsURL()
        });
        resp = JSON.parse(
          resp.data.startsWith("//") ? resp.data.replace("//", "") : resp
        );
      } catch (err) {
        logger.error("Error logging out", err);
      }

      if (resp?.logoutAuthType == "SAML2SSO") {
        redirectionUrl = resp.logoutUrl;
      }
    }

    useUserStore().logout(); // user store in order-routing has a logout method that handles clearing
    cookieHelper().remove('token');
    cookieHelper().remove('expirationTime');

    emitter.emit("dismissLoader");
    if(redirectionUrl) {
    window.location.href = redirectionUrl
  } else {
    router.replace("/login");
  }
  }

  const fetchLoginOptions = async() => {
    loginOption.value = {}
    try {
      const resp = await api({
        url: "checkLoginOptions",
        method: "GET",
        baseURL: commonUtil.getOmsURL()
      });
      if (!commonUtil.hasError(resp)) {
        loginOption.value = resp.data
        cookieHelper().set("maarg", resp.data.maargInstanceUrl)
      }
    } catch (error) {
      console.error(error)
    }
  };


  return {
    // Variables
    loginOption,
    // Functions
    fetchLoginOptions,
    login,
    logout,
    clearAuth,
    // Getters
    isAuthenticated
  }
}
