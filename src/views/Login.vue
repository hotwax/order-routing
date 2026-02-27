<template>
  <ion-page>
    <ion-content>
      <div class="flex">
        <form class="login-container" @keyup.enter="login()" @submit.prevent>
          <Logo />

          <ion-item lines="full">
            <ion-input label-placement="fixed" :label="translate('OMS')" name="instanceUrl" v-model="instanceUrl" id="instanceUrl" type="text" required />
          </ion-item>
          <ion-item lines="full">
            <ion-input label-placement="fixed" :label="translate('Username')" name="username" v-model="username" id="username" type="text" required />
          </ion-item>
          <ion-item lines="none">
            <ion-input label-placement="fixed" :label="translate('Password')" name="password" v-model="password" id="password" type="password" required />
          </ion-item>

          <div class="ion-padding">
            <ion-button type="submit" color="primary" fill="outline" expand="block" @click="login()">{{ translate("Login") }}</ion-button>
          </div>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonContent, IonInput, IonItem, IonPage } from "@ionic/vue";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Logo from "@/components/Logo.vue";
import { translate } from "@/i18n"
import { useUserStore } from "@/store/useUserStore";

const username = ref("")
const password = ref("")
const instanceUrl = ref("")
const router = useRouter();

const currentInstanceUrlSaved = computed(() => useUserStore().getInstanceUrl)

onMounted(() => {
  instanceUrl.value = currentInstanceUrlSaved.value;
})

function login() {
  useUserStore().setUserInstanceUrl( instanceUrl.value.trim())
  useUserStore().login( { username: username.value.trim(), password: password.value }).then((data: any) => {
    if (data.token) {
      username.value = ""
      password.value = ""
      router.push("/")
    }
  }).catch(err => err)
}
</script>

<style scoped>
.login-container {
  width: 375px;
}

.flex {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
