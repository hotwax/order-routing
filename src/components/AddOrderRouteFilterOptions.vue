<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate(`Order Rule ${props.label}`) }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-segment v-model="segmentSelected" v-if="conditionTypeEnumId === 'ENTCT_FILTER'">
        <ion-segment-button value="included">
          <ion-label>{{ translate("Include") }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="excluded">
          <ion-label>{{ translate("Exclude") }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div v-if="!enums[props.parentEnumId]" class="empty-state">
        <p>{{ translate(`Failed to fetch ${$props.label?.toLowerCase()} options`) }}</p>
      </div>
      <ion-list v-else>
        <div v-for="sort in getOptions()" :key="sort.enumId">
          <ion-item>
            <ion-checkbox :checked="isSortOptionSelected(sort.enumCode)" @ionChange="addSortOption(sort)">{{ sort.description || sort.enumCode }}</ion-checkbox>
          </ion-item>
        </div>
      </ion-list>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="!areFiltersUpdated" @click="saveSortOptions()">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage, IonSegment, IonSegmentButton, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { useStore } from "vuex";
import { computed, defineProps, onMounted, ref } from "vue";
import { saveOutline } from "ionicons/icons";
import { DateTime } from "luxon";
import { translate } from "@/i18n";

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
  },
  label: {
    type: String
  }
})
let routingFilters = ref({}) as any
let areFiltersUpdated = ref(false)
let segmentSelected = ref("included")

onMounted(() => {
  routingFilters.value = props.orderRoutingFilters ? JSON.parse(JSON.stringify(props.orderRoutingFilters)) : {}
})

function getOptions() {
  if(props.conditionTypeEnumId === "ENTCT_FILTER") {
    const excludeOptions = Object.values(enums.value[props.parentEnumId]).filter((enumeration: any) => enumeration.enumId.includes('_EXCLUDED'))
    const includeOptions = Object.values(enums.value[props.parentEnumId]).filter((enumeration: any) => !enumeration.enumId.includes('_EXCLUDED'))
    return segmentSelected.value === "excluded" ? excludeOptions : includeOptions
  }

  return Object.values(enums.value[props.parentEnumId])
}

function checkFilters() {
  areFiltersUpdated.value = false;
  areFiltersUpdated.value = Object.keys(routingFilters.value).some((options: string) => {
    return !props.orderRoutingFilters[options]
  })

  areFiltersUpdated.value = areFiltersUpdated.value ? areFiltersUpdated.value : Object.keys(props.orderRoutingFilters).some((options: string) => {
    return !routingFilters.value[options]
  })
}

function addSortOption(sort: any) {

  const isSortOptionAlreadyApplied = isSortOptionSelected(sort.enumCode)?.fieldName

  if(isSortOptionAlreadyApplied) {
    delete routingFilters.value[sort.enumCode]
  } else {
    // checking unchecking an option and then checking it again, we need to use the same values
    // TODO: check for a unique case that what if we add a new option, reorder the filters and then remove the old option and then add it again, this case result in duplicate seqNum which should not happen
    if(props.orderRoutingFilters?.[sort.enumCode]) {
      routingFilters.value[sort.enumCode] = props.orderRoutingFilters[sort.enumCode]
    } else {
      // when adding a new value, we don't need to pass conditionSeqId
      routingFilters.value[sort.enumCode] = {
        orderRoutingId: props.orderRoutingId,
        conditionTypeEnumId: props.conditionTypeEnumId,
        fieldName: sort.enumCode,
        sequenceNum: Object.keys(routingFilters.value).length && routingFilters.value[Object.keys(routingFilters.value)[Object.keys(routingFilters.value).length - 1]]?.sequenceNum >= 0 ? routingFilters.value[Object.keys(routingFilters.value)[Object.keys(routingFilters.value).length - 1]].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new seqNum to 0
        createdDate: DateTime.now().toMillis()  // TODO: need to create createdDate object when clicking save button, as adding it here will have difference between creation time when having multiple filters to create
      }
    }
  }

  checkFilters()
}

function saveSortOptions() {
  closeModal("save");
}

function isSortOptionSelected(code: string) {
  return routingFilters.value?.[code]
}

function closeModal(action = "close") {
  modalController.dismiss({ dismissed: true, filters: routingFilters.value }, action)
}
</script>
