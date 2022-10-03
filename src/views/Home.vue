<template>
  <ion-page> 
    <ion-content>
      <main>
        <section>
        <ion-label>{{ $t("FLOWS") }}</ion-label>
        <ion-card>
          <ion-card-content>  
            <h2>Release Pre-orders</h2>
            Scheduled: 7:30am <br>
            Frequency: Every Day
          </ion-card-content>  
        </ion-card>
  
        <ion-card @click="viewRule">
          <ion-card-content> 
            <h2>Morning brokering</h2> 
            Trigger: Release Pre-orders <ion-icon :icon="openOutline" /> <br>
            Condition: Completion
          </ion-card-content>  
        </ion-card>
        </section>
        <aside class="desktop-only" v-if="isDesktop" >
          <RuleConfiguration />
        </aside>
      </main>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonPage, IonCard, IonCardContent, IonContent, IonIcon, IonLabel, isPlatform, createAnimation } from '@ionic/vue';
import { defineComponent } from 'vue';
import { openOutline } from "ionicons/icons";
import RuleConfiguration from '@/components/RuleConfiguration.vue'
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';

export default defineComponent({
  name: 'Home',
  components: {
    IonPage,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonLabel,
    RuleConfiguration,
  },
  data() {
    return {
      isDesktop: isPlatform('desktop'),
      isRuleAnimationCompleted: false,
    }
  },
  methods: {
    viewRule() {
      if (!this.isRuleAnimationCompleted) {
        this.playAnimation();
        this.isRuleAnimationCompleted = true;
      }
    },
    playAnimation() {
      const aside = document.querySelector('aside') as Element
      const main = document.querySelector('main') as Element
      const revealAnimation = createAnimation()
        .addElement(aside)
        .duration(1500)
        .easing('ease')
        .keyframes([
          { offset: 0, flex: '0', opacity: '0' },
          { offset: 0.5, flex: '1', opacity: '0' },
          { offset: 1, flex: '1', opacity: '1' }
        ])
      const gapAnimation = createAnimation()
        .addElement(main)
        .duration(500)
        .fromTo('gap', '0', 'var(--spacer-2xl)');
      createAnimation()
        .addAnimation([gapAnimation, revealAnimation])
        .play();
    }
  },
  
  setup() {
    const router = useRouter();
    const store = useStore();
    return {
      store,
      router,
      openOutline
    };
  }
});
</script>

<style scoped>



@media (min-width: 991px) {
  main {
    display: flex;
    justify-content: center;
    align-items: start;
    gap: var(--spacer-2xl);
    max-width: 990px;
    margin: var(--spacer-base) auto 0;
  }
  main section {
    margin-top: var(--spacer-xl);
    max-width: 50ch;
    flex: auto;
  }
  
  .desktop-only {
    display: unset;
  }
  aside {
    width: 0px;
    opacity: 0;
  }
}
ion-card h2 {
  font-size: 22px;
}

ion-card {
  margin: var(--spacer-base) 0px;
}

/* @media (min-width: 991px) {
  main {
    display: flex;
    justify-content: center;
    align-items: start;
    gap: var(--spacer-2xl);
    max-width: 990px;
    margin: var(--spacer-base) auto 0;
  }

  main > section {
    max-width: 50ch;
  }

  .desktop-only {
    display: unset;
  }

  .mobile-only {
    display: none;
  }

  aside {
    width: 0px;
    opacity: 0;
  }
} */
</style>