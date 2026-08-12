<template>
  <ion-modal
    :is-open="isOpen"
    :backdrop-dismiss="!isDirty"
    :can-dismiss="canDismiss"
    @didDismiss="handleDidDismiss"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button :aria-label="translate('Close')" @click="requestClose">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ schedule?.groupName || translate("Inventory update") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="loading || saving" :aria-label="translate('Refresh')" @click="requestRefresh">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list v-if="loading && !details.ruleGroupId" lines="none">
        <ion-item><ion-spinner name="crescent" /></ion-item>
      </ion-list>

      <ion-list v-else-if="loadError" lines="full" role="alert">
        <ion-item>
          <ion-label>
            {{ translate("Inventory update details unavailable") }}
            <p>{{ translate("Failed to load inventory update details.") }}</p>
          </ion-label>
          <ion-button slot="end" fill="outline" @click="load">{{ translate("Retry") }}</ion-button>
        </ion-item>
      </ion-list>

      <template v-else-if="details.ruleGroupId">
        <ion-list lines="full">
          <ion-item>
            <ion-label>
              {{ schedule?.groupName }}
              <p>{{ translate("Group ID") }}: {{ details.ruleGroupId }}</p>
              <p v-if="details.jobName">{{ translate("Service job") }}: {{ details.jobName }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              {{ translate("Run now") }}
              <p>{{ translate("Generate an inventory update file without changing this schedule.") }}</p>
            </ion-label>
            <ion-button
              slot="end"
              fill="outline"
              :disabled="running || saving || Boolean(activeRun)"
              @click="confirmRunNow"
            >
              <ion-spinner v-if="running" name="crescent" />
              <span v-else>{{ translate("Run now") }}</span>
            </ion-button>
          </ion-item>
          <ion-item>
            <ion-label>
              {{ translate("Active") }}
              <p>{{ draftActive ? translate("This update will run on its schedule.") : translate("Scheduled runs are paused.") }}</p>
            </ion-label>
            <ion-toggle slot="end" :checked="draftActive" :disabled="saving" @ionChange="draftActive = $event.detail.checked" />
          </ion-item>
          <ion-item v-if="activeRun">
            <ion-label>
              {{ translate("Generating file") }}
              <p>{{ commonUtil.formatDateTimeValue(activeRun.startTime) }}</p>
            </ion-label>
            <ion-badge slot="end" color="primary">{{ translate("In progress") }}</ion-badge>
          </ion-item>
        </ion-list>

        <ion-accordion-group>
          <ion-accordion value="schedule">
            <ion-item slot="header">
              <ion-label>
                {{ translate("Schedule") }}
                <p>{{ scheduleDescription }}</p>
              </ion-label>
              <ion-note slot="end">{{ nextRunLabel }}</ion-note>
            </ion-item>
            <ion-list slot="content" lines="full">
              <ion-item>
                <ion-input
                  v-model="draftCronExpression"
                  label-placement="stacked"
                  :label="translate('Quartz cron expression')"
                  :disabled="saving"
                />
              </ion-item>
              <ion-item>
                <ion-label>
                  {{ translate("Schedule preview") }}
                  <p>{{ isScheduleValid ? scheduleDescription : translate("Provide a valid cron expression") }}</p>
                </ion-label>
              </ion-item>
              <ion-list-header>{{ translate("Schedule Options") }}</ion-list-header>
              <ion-radio-group v-model="draftCronExpression">
                <ion-item v-for="option in scheduleOptions" :key="option.expression">
                  <ion-radio label-placement="end" justify="start" :value="option.expression" :disabled="saving">
                    {{ translate(option.label) }}
                  </ion-radio>
                </ion-item>
              </ion-radio-group>
            </ion-list>
          </ion-accordion>

          <ion-accordion value="recent-runs">
            <ion-item slot="header">
              <ion-label>
                {{ translate("Recent runs") }}
                <p>{{ translate("Last 5 executions for this service job.") }}</p>
              </ion-label>
              <ion-note slot="end">{{ recentRuns.length }}</ion-note>
            </ion-item>
            <ion-list slot="content" lines="full">
              <ion-item v-for="run in recentRuns" :key="runKey(run)">
                <ion-label>
                  {{ runStatusLabel(run) }}
                  <p>{{ commonUtil.formatDateTimeValue(run.startTime) }}</p>
                  <p v-if="run.endTime">{{ translate("Completed") }} {{ commonUtil.formatDateTimeValue(run.endTime) }}</p>
                </ion-label>
                <ion-badge slot="end" :color="runStatusColor(run)">{{ runStatusLabel(run) }}</ion-badge>
              </ion-item>
              <ion-item v-if="!recentRuns.length"><ion-label>{{ translate("No recent runs found") }}</ion-label></ion-item>
            </ion-list>
          </ion-accordion>
        </ion-accordion-group>

        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button
            :disabled="!canSave || saving"
            :aria-label="translate(saving ? 'Saving' : 'Save')"
            @click="save"
          >
            <ion-spinner v-if="saving" name="crescent" />
            <ion-icon v-else :icon="saveOutline" />
          </ion-fab-button>
        </ion-fab>
      </template>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
  alertController
} from "@ionic/vue";
import { closeOutline, refreshOutline, saveOutline } from "ionicons/icons";
import { computed, ref, watch } from "vue";
import { commonUtil, logger, translate } from "@common";
import { useInventoryUpdatesStore, type InventoryUpdateSchedule } from "@/store/inventoryUpdates";
import { isActiveJobRun } from "@/utils/inventoryUpdates";
import { parseRoutingStringRecordEnvJson } from "@/utils/routingEditorEnv";

const props = defineProps<{
  isOpen: boolean;
  schedule: InventoryUpdateSchedule | null;
}>();
const emit = defineEmits<{ close: []; dismissed: []; updated: [] }>();
const store = useInventoryUpdatesStore();
const loading = ref(false);
const saving = ref(false);
const running = ref(false);
const loadError = ref("");
const details = ref<Record<string, any>>({});
const recentRuns = ref<any[]>([]);
const draftCronExpression = ref("");
const draftActive = ref(false);

const configuredOptions = parseRoutingStringRecordEnvJson(import.meta.env.VITE_CRON_EXPRESSIONS as string | undefined);
const scheduleOptions = Object.entries(configuredOptions).map(([label, expression]) => ({ label, expression }));
const originalCronExpression = computed(() => String(details.value.cronExpression || ""));
const originalActive = computed(() => String(details.value.paused || "Y") !== "Y");
const activeRun = computed(() => recentRuns.value.find(isActiveJobRun) || null);
const isDirty = computed(() => draftCronExpression.value !== originalCronExpression.value || draftActive.value !== originalActive.value);
const isScheduleValid = computed(() => {
  if (!draftCronExpression.value) return false;
  try {
    commonUtil.getCronString(draftCronExpression.value);
    return true;
  } catch (_error) {
    return false;
  }
});
const canSave = computed(() => isDirty.value && (!draftActive.value || isScheduleValid.value));
const scheduleDescription = computed(() => {
  if (!draftCronExpression.value) return translate("Not scheduled");
  try {
    return commonUtil.getCronString(draftCronExpression.value) || translate("Not scheduled");
  } catch (_error) {
    return translate("Provide a valid cron expression");
  }
});
const nextRunLabel = computed(() => draftActive.value && details.value.nextExecutionDateTime
  ? commonUtil.formatDateTimeValue(details.value.nextExecutionDateTime)
  : translate("Not scheduled"));

watch(() => [props.isOpen, props.schedule?.ruleGroupId], ([open]) => {
  if (open && props.schedule?.ruleGroupId) void load();
});

async function load() {
  if (!props.schedule?.ruleGroupId) return;
  loading.value = true;
  loadError.value = "";
  try {
    const scheduleDetails = await store.fetchSchedule(props.schedule.ruleGroupId);
    const jobName = scheduleDetails.jobName || props.schedule.jobName;
    const runs = await store.fetchJobRuns(jobName, 5);
    details.value = {
      ...props.schedule,
      ...scheduleDetails,
      ruleGroupId: props.schedule.ruleGroupId,
      jobName
    };
    recentRuns.value = runs;
    resetDraft();
  } catch (error) {
    logger.error("inventory updates: failed to load schedule details", error);
    loadError.value = "Failed to load inventory update details.";
    details.value = {};
    recentRuns.value = [];
  } finally {
    loading.value = false;
  }
}

function resetDraft() {
  draftCronExpression.value = originalCronExpression.value;
  draftActive.value = originalActive.value;
}

async function confirmDiscard() {
  if (!isDirty.value) return true;
  const alert = await alertController.create({
    header: translate("Unsaved changes"),
    message: translate("You have unsaved job changes. Discard them?"),
    backdropDismiss: false,
    buttons: [
      { text: translate("Keep editing"), role: "cancel" },
      { text: translate("Discard changes"), role: "destructive" }
    ]
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  return result.role === "destructive";
}

async function canDismiss() {
  return confirmDiscard();
}

async function requestClose() {
  if (await confirmDiscard()) {
    resetDraft();
    emit("close");
  }
}

function handleDidDismiss() {
  resetDraft();
  emit("close");
  emit("dismissed");
}

async function requestRefresh() {
  if (await confirmDiscard()) await load();
}

async function save() {
  if (!props.schedule?.ruleGroupId || !canSave.value) return;
  saving.value = true;
  try {
    const payload: { ruleGroupId: string; paused: string; cronExpression?: string } = {
      ruleGroupId: props.schedule.ruleGroupId,
      paused: draftActive.value ? "N" : "Y"
    };
    if (isScheduleValid.value) payload.cronExpression = draftCronExpression.value;
    await store.updateSchedule(payload);
    commonUtil.showToast(translate("Inventory update schedule saved."));
    await load();
    emit("updated");
  } catch (error) {
    logger.error("inventory updates: failed to save schedule", error);
    commonUtil.showToast(translate("Something went wrong."));
  } finally {
    saving.value = false;
  }
}

async function confirmRunNow() {
  if (!props.schedule?.ruleGroupId || activeRun.value) return;
  const alert = await alertController.create({
    header: translate("Run now"),
    message: translate("Generate an inventory update file now without changing this schedule?"),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Run now"), role: "confirm" }
    ]
  });
  await alert.present();
  const result = await alert.onDidDismiss();
  if (result.role !== "confirm") return;

  running.value = true;
  try {
    if (!details.value.jobName) {
      await store.updateSchedule({ ruleGroupId: props.schedule.ruleGroupId, paused: "Y" });
    }
    await store.runNow(props.schedule.ruleGroupId);
    commonUtil.showToast(translate("Job queued successfully."));
    await load();
    emit("updated");
  } catch (error) {
    logger.error("inventory updates: failed to run schedule", error);
    commonUtil.showToast(translate("Something went wrong."));
  } finally {
    running.value = false;
  }
}

function runStatusLabel(run: any) {
  if (isActiveJobRun(run)) return translate("In progress");
  if (run?.hasError === "Y") return translate("Failed");
  if (run?.startTime && run?.endTime) return translate("Completed");
  return translate("Not available");
}

function runStatusColor(run: any) {
  const status = runStatusLabel(run);
  if (status === translate("In progress")) return "primary";
  if (status === translate("Failed")) return "danger";
  if (status === translate("Completed")) return "success";
  return "medium";
}

function runKey(run: any) {
  return String(run.jobRunId || `${run.startTime || "run"}-${run.endTime || "active"}`);
}
</script>
