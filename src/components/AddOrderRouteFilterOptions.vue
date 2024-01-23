<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ "Order Rule Sort" }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ $t('Close') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="sort in Object.values(enums[props.parentEnumId] ? enums[props.parentEnumId] : {})" :key="sort.enumId">
          <ion-checkbox :checked="isSortOptionSelected(sort.enumCode)" @ionChange="addSortOption(sort)">{{ sort.description || sort.enumCode }}</ion-checkbox>
        </ion-item>
      </ion-list>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="saveSortOptions()">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonList, IonPage, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { useStore } from "vuex";
import { computed, defineProps, onMounted, ref } from "vue";
import { saveOutline } from "ionicons/icons";

const store = useStore();
const enums = computed(() => store.getters["util/getEnums"])

const props = defineProps({
  orderRoutingId: {
    type: String,
    required: true
  },
  orderRoutingFilters: {
    type: Object,
    required: true
  },
  parentEnumId: {
    type: String,
    required: true
  },
  conditionTypeEnumId: {
    type: String,
    required: true
  }
})
let routingFilters = ref({}) as any

onMounted(() => {
  routingFilters.value = props.orderRoutingFilters ? JSON.parse(JSON.stringify(props.orderRoutingFilters)) : {}
})

function addSortOption(sort: any) {
  const isSortOptionAlreadyApplied = isSortOptionSelected(sort.enumCode)?.fieldName

  if(isSortOptionAlreadyApplied) {
    delete routingFilters.value[props.conditionTypeEnumId][sort.enumCode]
  } else {
    // checking unchecking an option and then checking it again, we need to use the same values
    if(props.orderRoutingFilters[props.conditionTypeEnumId]?.[sort.enumCode]) {
      routingFilters.value[props.conditionTypeEnumId][sort.enumCode] = props.orderRoutingFilters[props.conditionTypeEnumId][sort.enumCode]
    } else {
      // when adding a new value, we don't need to pass conditionSeqId
      // Added check that whether the filters for the conditionType exists or not, if not then create a new value for conditionType
      routingFilters.value[props.conditionTypeEnumId] ? routingFilters.value[props.conditionTypeEnumId][sort.enumCode] = {
        orderRoutingId: props.orderRoutingId,
        conditionTypeEnumId: props.conditionTypeEnumId,
        fieldName: sort.enumCode,
        sequenceNum: Object.keys(routingFilters.value[props.conditionTypeEnumId]).length && routingFilters.value[props.conditionTypeEnumId][Object.keys(routingFilters.value[props.conditionTypeEnumId])[Object.keys(routingFilters.value[props.conditionTypeEnumId]).length - 1]]?.sequenceNum >= 0 ? routingFilters.value[props.conditionTypeEnumId][Object.keys(routingFilters.value[props.conditionTypeEnumId])[Object.keys(routingFilters.value[props.conditionTypeEnumId]).length - 1]].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new seqNum to 0
      } : routingFilters.value = {
        ...routingFilters.value,
        [props.conditionTypeEnumId]: {
          [sort.enumCode]: {
            orderRoutingId: props.orderRoutingId,
            conditionTypeEnumId: props.conditionTypeEnumId,
            fieldName: sort.enumCode,
            sequenceNum: 0
          }
        }
      }
    }
  }
}

function saveSortOptions() {
  closeModal(routingFilters.value, 'save');
}

function isSortOptionSelected(code: string) {
  return routingFilters.value[props.conditionTypeEnumId]?.[code]
}

function closeModal(filters = {}, action = 'close') {
  modalController.dismiss({ dismissed: true, filters }, action)
}
</script>
