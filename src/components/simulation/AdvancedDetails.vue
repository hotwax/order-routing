<template>
  <ion-accordion-group>
    <ion-accordion v-for="v in variants" :key="v.label" :value="v.label">
      <ion-item slot="header"><ion-label>{{ v.label }} {{ v.failed ? '⚠︎' : '' }}</ion-label></ion-item>
      <div slot="content" class="ion-padding">
        <p v-if="v.failed" class="warn">{{ translate("This variation failed:") }} {{ v.failureReason || translate("unknown error") }}</p>
        <h4>{{ translate("Orders that changed outcome") }}</h4>
        <ion-list>
          <ion-item v-for="(transition, key) in (v.diff?.finalReasonTransitions ?? {})" :key="key">
            <ion-label class="ion-text-wrap">{{ key }}: {{ transition }}</ion-label>
          </ion-item>
          <ion-item v-if="!v.diff || !Object.keys(v.diff.finalReasonTransitions ?? {}).length" lines="none">
            <ion-label color="medium">{{ translate("No outcome changes.") }}</ion-label>
          </ion-item>
        </ion-list>
        <h4>{{ translate("Per-routing delta") }}</h4>
        <ion-list>
          <ion-item v-for="(d, name) in (v.diff?.routingBrokeredDelta ?? {})" :key="name">
            <ion-label>{{ name }}: {{ d[0] }} → {{ d[1] }}</ion-label>
          </ion-item>
        </ion-list>
        <h4>{{ translate("Per-facility delta") }}</h4>
        <ion-list>
          <ion-item v-for="(d, name) in (v.diff?.facilityAllocationDelta ?? {})" :key="name">
            <ion-label>{{ name }}: {{ d[0] }} → {{ d[1] }}</ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-accordion>
  </ion-accordion-group>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { translate } from "@common";
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel, IonList } from "@ionic/vue";

const props = defineProps<{ results: { baseline: any; variants: any[] } | null }>();
const variants = computed(() => props.results?.variants ?? []);
</script>

<style scoped>
.warn { color: var(--ion-color-warning-shade); }
</style>
