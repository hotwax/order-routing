<template>
  <ion-page> 
    <ion-content>
      <main>
        <section>
          <ion-list>
            <ion-list-header lines="full">
              <ion-label color="medium">{{ $t("FLOWS") }}</ion-label>
              <ion-button>
                {{ $t("Add") }}
                <ion-icon :icon="addCircleOutline" />
              </ion-button>
            </ion-list-header>

            <ion-card @click="viewRule">
              <ion-item lines="none">
                <h2>Release Pre-orders</h2>
                <ion-toggle color="secondary" slot="end" :checked="true" />
              </ion-item>
              <ion-card-content>
                {{ $t("Scheduled") }}: 7:30am <br>
                {{ $t("Frequency") }}: Every Day
                <ion-icon slot="end" :icon="ellipsisVerticalOutline" />
              </ion-card-content>
            </ion-card>
      
            <ion-card @click="viewRule">
              <ion-item lines="none">
                <h2>Morning brokering</h2>
                <ion-toggle color="secondary" slot="end" :checked="true" />
              </ion-item>
              <ion-card-content>
                {{ $t("Scheduled") }}: 8:00am <br>
                {{ $t("Frequency") }}: Every Day
                <ion-icon slot="end" :icon="ellipsisVerticalOutline" />
              </ion-card-content>
            </ion-card>
          </ion-list>
        </section>
        <aside class="desktop-only" v-if="isDesktop" >
          <RuleConfiguration />
        </aside>
      </main>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonPage, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonItem, IonLabel, IonList, IonListHeader, isPlatform, IonToggle, createAnimation } from '@ionic/vue';
import { defineComponent } from 'vue';
import { addCircleOutline, ellipsisVerticalOutline } from "ionicons/icons";
import RuleConfiguration from '@/components/RuleConfiguration.vue'
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';

export default defineComponent({
  name: 'Home',
  components: {
    IonPage,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonToggle,
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
      addCircleOutline,
      ellipsisVerticalOutline
    };
  }
});
</script>

<style scoped>
  ion-card h2 {
    font-size: 22px;
  }

  ion-card {
    margin: var(--spacer-base) 0;
  }

  ion-card ion-icon {
    position: absolute;
    right: 10px;
    bottom: var(--spacer-base);
    font-size: var(--spacer-base);
  }

  aside {
    position: sticky;
    top: var(--spacer-lg);
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 991px) {
    main {
      display: flex;
      justify-content: center;
      align-items: start;
      max-width: 990px;
      margin: var(--spacer-base) auto 0;
    }

    main > section {
      flex-basis: 370px;
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
  }
</style>