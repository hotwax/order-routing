<template><ion-page><ion-header><ion-toolbar><ion-title>{{ translate(mapping ? 'Edit zone mapping' : 'Add zone mapping') }}</ion-title><ion-buttons slot="end"><ion-button @click="modalController.dismiss()">{{ translate('Cancel') }}</ion-button></ion-buttons></ion-toolbar></ion-header><ion-content class="ion-padding"><ion-list>
<ion-item><ion-select :label="translate('Carrier')" v-model="draft.carrier" interface="popover"><ion-select-option value="FedEx">FedEx</ion-select-option><ion-select-option value="UPS">UPS</ion-select-option></ion-select></ion-item>
<ion-item><ion-input label-placement="stacked" :label="translate('Origin ZIP')" v-model="draft.origin" inputmode="numeric" :maxlength="5" /></ion-item>
<ion-item><ion-select :label="translate('Destination match')" v-model="draft.matchType" interface="popover"><ion-select-option value="exact">{{ translate('Exact ZIP') }}</ion-select-option><ion-select-option value="prefix">{{ translate('ZIP prefix') }}</ion-select-option></ion-select></ion-item>
<ion-item><ion-input label-placement="stacked" :label="translate('Destination ZIP or prefix')" v-model="draft.destination" inputmode="numeric" :maxlength="5" /></ion-item>
<ion-item><ion-input label-placement="stacked" :label="translate('Shipping zone')" v-model="draft.zone" /></ion-item>
<ion-item><ion-input type="number" min="1" max="30" label-placement="stacked" :label="translate('Ground transit days')" v-model="draft.days" /></ion-item>
</ion-list><ion-text v-if="error" color="danger"><p role="alert">{{ error }}</p></ion-text><ion-fab vertical="bottom" horizontal="end" slot="fixed"><ion-fab-button :aria-label="translate('Save zone mapping')" @click="save"><ion-icon :icon="checkmarkOutline" /></ion-fab-button></ion-fab></ion-content></ion-page></template>
<script setup lang="ts">
import { ref } from 'vue';
import { IonPage,IonHeader,IonToolbar,IonTitle,IonButtons,IonButton,IonContent,IonList,IonItem,IonInput,IonSelect,IonSelectOption,IonNote,IonText,IonFab,IonFabButton,IonIcon,modalController } from '@ionic/vue';
import { checkmarkOutline } from 'ionicons/icons';
import { translate } from '@common';
import { useZoneMappingsStore, type ZoneMapping } from '@/store/zoneMappings';
const props=defineProps<{mapping?:ZoneMapping}>();
const store=useZoneMappingsStore();
const draft=ref<ZoneMapping>(props.mapping ? {...props.mapping} : {id:crypto.randomUUID(),carrier:'FedEx',origin:'',destination:'',matchType:'exact',zone:'',days:1});
const error=ref('');
async function save(){ const row={...draft.value,origin:draft.value.origin.trim(),destination:draft.value.destination.trim(),zone:draft.value.zone.trim(),days:Number(draft.value.days)};
if(!/^\d{5}$/.test(row.origin) || !(row.matchType==='exact' ? /^\d{5}$/ : /^\d{3}$/).test(row.destination) || !row.zone || !Number.isInteger(row.days) || row.days<1 || row.days>30){error.value=translate('Use a 5-digit origin, a 5-digit destination or 3-digit prefix, a zone, and 1–30 transit days.');return;}
if(store.mappings.some(r=>r.id!==row.id && r.carrier===row.carrier && r.origin===row.origin && r.destination===row.destination && r.matchType===row.matchType)){error.value=translate('A mapping already exists for this carrier and ZIP pair.');return;}
store.save(row);await modalController.dismiss(null,'saved');}
</script>
