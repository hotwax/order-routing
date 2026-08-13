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
          <ion-button slot="end" fill="outline" @click="load()">{{ translate("Retry") }}</ion-button>
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
                  <p>{{ scheduleDescription }}</p>
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
import { useUserStore } from "@/store/userStore";
import { isCronExpressionValid } from "@/utils/cronValidation";
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
const userTimeZone = computed(() => useUserStore().getCurrentTimeZone);
const originalCronExpression = computed(() => String(details.value.cronExpression || ""));
const originalActive = computed(() => String(details.value.paused || "Y") !== "Y");
const activeRun = computed(() => recentRuns.value.find(isActiveJobRun) || null);
const cronChanged = computed(() => draftCronExpression.value !== originalCronExpression.value);
const isDirty = computed(() => cronChanged.value || draftActive.value !== originalActive.value);
const isScheduleValid = computed(() => isCronExpressionValid(draftCronExpression.value, userTimeZone.value));
const canSave = computed(() => isDirty.value
  && (!cronChanged.value || isScheduleValid.value)
  && (!draftActive.value || isScheduleValid.value));
const scheduleDescription = computed(() => {
  if (!draftCronExpression.value) return translate("Not scheduled");
  if (!isScheduleValid.value) return translate("Provide a valid cron expression");
  return commonUtil.getCronString(draftCronExpression.value);
});
const nextRunLabel = computed(() => draftActive.value && details.value.nextExecutionDateTime
  ? commonUtil.formatDateTimeValue(details.value.nextExecutionDateTime)
  : translate("Not scheduled"));

let loadRequestId = 0;

watch(() => [props.isOpen, props.schedule?.ruleGroupId], ([open, ruleGroupId]) => {
  if (!open || !ruleGroupId) return;
  // Drop the previously viewed group's details so the spinner shows while the newly selected
  // group loads, instead of rendering the old group's id, job and cron.
  if (details.value.ruleGroupId && details.value.ruleGroupId !== ruleGroupId) {
    details.value = {};
    recentRuns.value = [];
  }
  void load();
});

async function load(preserveDraft = false) {
  const schedule = props.schedule;
  const ruleGroupId = schedule?.ruleGroupId;
  if (!ruleGroupId) return;

  // The selected schedule can change while this runs, so the group is captured up front and every
  // continuation is tagged. A slower response for a previously selected group is discarded rather
  // than merged into the group now open. Same generation guard as useChannelInventory.ts.
  const currentRequestId = ++loadRequestId;
  loading.value = true;
  loadError.value = "";
  try {
    const scheduleDetails = await store.fetchSchedule(ruleGroupId);
    if (currentRequestId !== loadRequestId) return;

    const jobName = scheduleDetails.jobName || schedule?.jobName || "";
    const runs = await store.fetchJobRuns(jobName, 5);
    if (currentRequestId !== loadRequestId) return;

    details.value = { ...(schedule || {}), ...scheduleDetails, ruleGroupId, jobName };
    recentRuns.value = runs;
    if (!preserveDraft) resetDraft();
  } catch (error) {
    if (currentRequestId !== loadRequestId) return;
    logger.error("inventory updates: failed to load schedule details", error);
    loadError.value = "Failed to load inventory update details.";
    details.value = {};
    recentRuns.value = [];
  } finally {
    if (currentRequestId === loadRequestId) loading.value = false;
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
  const ruleGroupId = props.schedule?.ruleGroupId;
  if (!ruleGroupId || !canSave.value) return;
  saving.value = true;
  try {
    const payload: { ruleGroupId: string; paused: string; cronExpression?: string } = {
      ruleGroupId,
      paused: draftActive.value ? "N" : "Y"
    };
    // canSave guarantees a changed expression is a valid one, and an unchanged expression is left
    // out entirely so a pause/resume never rewrites the stored schedule.
    if (cronChanged.value) payload.cronExpression = draftCronExpression.value;
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
  const ruleGroupId = props.schedule?.ruleGroupId;
  if (!ruleGroupId || activeRun.value) return;
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
    // runNow needs an existing scheduler entry. When the group has never been scheduled, one is
    // created in a paused state purely so the run can be triggered, matching ScheduleActionsPopover.
    if (!details.value.jobName) {
      await store.updateSchedule({ ruleGroupId, paused: "Y" });
    }
    await store.runNow(ruleGroupId);
    commonUtil.showToast(translate("Job queued successfully."));
    // Running does not change the schedule, so unsaved edits in the form are kept rather than
    // being silently reset by the reload.
    await load(true);
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
