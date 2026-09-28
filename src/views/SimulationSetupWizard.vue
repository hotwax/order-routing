<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-back-button default-href="/order-routing" slot="start" />
        <ion-title>{{ translate("Simulation setup wizard") }}</ion-title>
        <ion-progress-bar :value="progressValue" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <main class="sim-setup-wizard">
        <section class="wizard-steps">
          <ion-list lines="none">
            <ion-list-header>
              <ion-label>
                {{ translate("Progress") }}
                <p>{{ completedStepIds.length }} {{ translate("of") }} {{ SIMULATION_SETUP_STEPS.length }} {{ translate("steps complete") }}</p>
              </ion-label>
            </ion-list-header>
          </ion-list>
          <simulation-wizard-step-list
            :groups="SIMULATION_SETUP_GROUPS"
            :steps="SIMULATION_SETUP_STEPS"
            :current-step-id="currentStepId"
            :completed-step-ids="completedStepIds"
            :in-progress-step-ids="inProgressStepIds"
            :step-status="stepStatus"
            @select-step="selectStep"
          />
        </section>

        <section class="wizard-task">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate(currentStep.label) }}</ion-card-title>
              <ion-card-subtitle>{{ translate(currentStep.summary) }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p class="step-description">{{ translate(currentStep.description) }}</p>
              <p v-if="actionError" class="feedback error" role="alert">{{ actionError }}</p>

              <div v-if="currentStepId === 'backend-connection'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("System Message Remote (SIM_ROUTING_CONFIG)") }}</h3>
                      <p>{{ translate("Main OMS to Sister Sim-Routing instance connection") }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="connectionCheckStatus === 'success' ? 'success' : (omsRemoteConfig ? 'primary' : 'warning')">
                      {{ connectionCheckStatus === 'success' ? translate("Connected") : (omsRemoteConfig ? translate("Configured") : translate("Not configured")) }}
                    </ion-badge>
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="remoteSendUrl" :disabled="busy" label-placement="stacked"
                      :label="translate('Sim Routing Instance REST URL')" placeholder="http://localhost:8082/rest/s1" :clear-input="true" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="remoteUsername" :disabled="busy" label-placement="stacked"
                      :label="translate('Sim Routing Username')" :placeholder="translate('Enter the dedicated Sim Routing service username')" :clear-input="true" />
                  </ion-item>
                  <ion-item>
                    <ion-input v-model="remotePassword" :disabled="busy" type="password" label-placement="stacked"
                      :label="translate('Sim Routing Password')"
                      :placeholder="omsRemoteConfig ? translate('Leave blank to keep the configured password') : translate('Enter the Sim Routing service password')"
                      :clear-input="true" />
                  </ion-item>
                </ion-list>
                <div class="action-row">
                  <ion-button color="primary" :disabled="busy || !remoteSendUrl || !remoteUsername || (!omsRemoteConfig && !remotePassword)" @click="saveRemoteAuth">
                    <ion-spinner v-if="isSavingRemote" slot="start" name="crescent" />{{ translate("Save in OMS") }}
                  </ion-button>
                  <ion-button fill="outline" :disabled="busy || !canTestRemote" @click="testRemoteConnection">
                    <ion-spinner v-if="isTestingConnection" slot="start" name="crescent" />{{ translate("Test connection") }}
                  </ion-button>
                </div>
                <p v-if="omsRemoteConfig && !canTestRemote" class="feedback">{{ translate("Save changes in OMS before testing the connection.") }}</p>
                <p v-if="connectionCheckStatus !== 'idle'" class="feedback" :class="connectionCheckStatus" role="status">{{ connectionCheckMessage }}</p>
              </div>

              <div v-else-if="currentStepId === 'datastore-select'" class="task-content">
                <ion-item>
                  <ion-select :label="translate('Existing datastores')" :placeholder="translate('Choose a datastore')"
                    interface="popover" :value="activeDatastoreId" :disabled="busy || connectionCheckStatus !== 'success'"
                    @ionChange="selectDatastore($event.detail.value)">
                    <ion-select-option v-for="datastore in visibleDatastores" :key="datastore.simDatastoreId" :value="datastore.simDatastoreId">
                      {{ datastore.displayName || datastore.datastoreName }} — {{ datastore.statusId }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <p v-if="selectedDatastore" class="feedback">{{ selectedDatastore.datastoreName }} · {{ selectedDatastore.statusId }}</p>
                <p v-if="!visibleDatastores.length && connectionCheckStatus === 'success'" class="feedback">{{ translate("No datastores found. Create one below.") }}</p>
                <ion-button v-if="selectedDatastore && selectedDatastore.statusId !== 'SIMDS_REMOVED'" color="danger" fill="outline"
                  :disabled="busy || isOpen" @click="deleteTarget = selectedDatastore">
                  {{ translate("Delete selected datastore") }}
                </ion-button>
                <p v-if="selectedDatastore && isOpen" class="feedback">{{ translate("Open another datastore before deleting this one.") }}</p>
                <p v-if="selectedDatastore && isFilling" class="feedback">{{ translate("Wait for the running fill to finish before deleting a datastore.") }}</p>
                <ion-item>
                  <ion-input v-model="newDatastoreDescription" label-placement="stacked"
                    :label="translate('New datastore name')" :placeholder="translate('e.g. Baseline snapshot')" :clear-input="true" />
                </ion-item>
                <div class="action-row">
                  <ion-button fill="outline" :disabled="busy || connectionCheckStatus !== 'success'" @click="loadDatastores">
                    {{ translate("Refresh datastores") }}
                  </ion-button>
                  <ion-button :disabled="busy || connectionCheckStatus !== 'success' || !newDatastoreDescription.trim()" @click="provisionDatastore">
                    <ion-spinner v-if="isProvisioning" slot="start" name="crescent" />{{ translate("Create new datastore") }}
                  </ion-button>
                </div>
              </div>

              <div v-else-if="currentStepId === 'data-fill'" class="task-content">
                <p v-if="!activeDatastoreId" class="feedback">{{ translate("Choose a datastore first.") }}</p>
                <p v-else-if="!isOpen" class="feedback">{{ translate("Open the selected datastore before starting the copy.") }}</p>
                <p v-else-if="fillCompleted && !fillId" class="feedback success">{{ translate("Selected datastore is already Ready; no new fill is needed.") }}</p>
                <ion-list v-else-if="activeDatastoreId" lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Fill run") }}</h3>
                      <p>{{ fillId || translate("Not started") }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="fillCompleted ? 'success' : isFilling ? 'warning' : 'medium'">
                      {{ fillStatus || translate("Pending") }}
                    </ion-badge>
                  </ion-item>
                  <ion-item v-if="fillId">
                    <ion-label>
                      <p>{{ translate("Completed tasks") }}: {{ fillMetrics.completeTasks }}{{ fillMetrics.totalTasks ? ` / ${fillMetrics.totalTasks}` : '' }}</p>
                      <p>{{ translate("Failed tasks") }}: {{ fillMetrics.failedTasks }} · {{ translate("Rows copied") }}: {{ fillMetrics.rowsWritten.toLocaleString() }}</p>
                    </ion-label>
                  </ion-item>
                  <ion-item v-if="fillId && fillMetrics.totalTasks"><ion-progress-bar :value="fillMetrics.completeTasks / fillMetrics.totalTasks" /></ion-item>
                </ion-list>
                <ion-list v-if="fillId && visibleFillTasks.length" lines="full" :aria-label="translate('Running and failed operations')">
                  <ion-list-header><ion-label>{{ translate("Running and failed operations") }}</ion-label></ion-list-header>
                  <ion-item v-for="task in visibleFillTasks" :key="task.taskId">
                    <ion-label class="ion-text-wrap">
                      <h3>{{ task.name }}</h3>
                      <p>{{ translate("Step") }} {{ task.stepNum }}</p>
                      <p v-if="task.statusId === 'SIMDSFS_FAILED' && task.errorText" class="error">{{ task.errorText }}</p>
                      <p v-if="task.statusId === 'SIMDSFS_FAILED' && task.jobRunId">{{ translate("Job") }} {{ task.jobRunId }}</p>
                    </ion-label>
                    <ion-spinner v-if="task.statusId === 'SIMDSFS_RUNNING'" slot="end" name="crescent" :aria-label="translate('Running')" />
                    <ion-badge v-else-if="task.statusId === 'SIMDSFS_FAILED'" slot="end" color="danger">{{ translate("Failed") }}</ion-badge>
                    <ion-badge v-else slot="end" color="medium">{{ task.statusId }}</ion-badge>
                  </ion-item>
                </ion-list>
                <ion-accordion-group v-if="fillId && groupedFillTasks.length">
                  <ion-accordion v-for="group in groupedFillTasks" :key="group.value" :value="group.value">
                    <ion-item slot="header">
                      <ion-label>{{ translate(group.label) }}</ion-label>
                      <ion-badge slot="end" :color="group.value === 'complete' ? 'success' : 'medium'">{{ group.tasks.length }}</ion-badge>
                    </ion-item>
                    <ion-list slot="content" lines="full">
                      <ion-item v-for="task in group.tasks" :key="task.taskId">
                        <ion-label class="ion-text-wrap">
                          <h3>{{ task.name }}</h3>
                          <p>{{ translate("Step") }} {{ task.stepNum }}</p>
                        </ion-label>
                        <ion-icon v-if="group.value === 'complete'" slot="end" :icon="checkmarkCircle" color="success" :aria-label="translate('Complete')" />
                        <ion-badge v-else slot="end" color="medium">{{ translate("Pending") }}</ion-badge>
                      </ion-item>
                    </ion-list>
                  </ion-accordion>
                </ion-accordion-group>
                <p class="feedback">{{ translate("The fill checks prod-source access; a failure here is not treated as success.") }}</p>
                <div class="action-row">
                  <ion-button v-if="!fillId && !fillCompleted" :disabled="busy || !isOpen || !activeDatastoreId || selectedDatastore?.statusId !== 'SIMDS_CREATED'" @click="startDataFill">
                    <ion-spinner v-if="isFilling" slot="start" name="crescent" />{{ translate("Start data copy") }}
                  </ion-button>
                  <ion-button v-if="fillId && !fillCompleted" fill="outline" :disabled="busy" @click="pollFill">
                    <ion-spinner v-if="isFilling" slot="start" name="crescent" />{{ translate("Refresh fill status") }}
                  </ion-button>
                </div>
              </div>

              <div v-else-if="currentStepId === 'readiness-gate'" class="task-content">
                <ion-item>
                  <ion-label>
                    <h3>{{ translate("Datastore status") }}</h3>
                    <p>{{ selectedDatastore?.datastoreName || translate("Choose a datastore first.") }}</p>
                    <p v-if="selectedDatastore?.filledFrom">{{ translate("Filled from") }}: {{ selectedDatastore.filledFrom }}</p>
                  </ion-label>
                  <ion-badge slot="end" :color="readinessPassed ? 'success' : 'medium'">{{ selectedDatastore?.statusId || translate("Unknown") }}</ion-badge>
                </ion-item>
                <p class="feedback">{{ translate("The fill marks the datastore Ready automatically after its check passes.") }}</p>
                <div class="action-row">
                  <ion-button fill="outline" :disabled="busy || !activeDatastoreId" @click="refreshReadiness">
                    {{ translate("Refresh status") }}
                  </ion-button>
                </div>
              </div>

              <div v-else-if="currentStepId === 'open-datastore'" class="task-content">
                <ion-item>
                  <ion-label>
                    <h3>{{ translate("Simulation datastore") }}</h3>
                    <p>{{ selectedDatastore?.datastoreName || translate("Choose a datastore first.") }}</p>
                  </ion-label>
                  <ion-badge slot="end" :color="isOpen ? 'success' : 'medium'">{{ isOpen ? translate("Opened here") : translate("Not opened here") }}</ion-badge>
                </ion-item>
                <div class="action-row">
                  <ion-button :disabled="busy || !activeDatastoreId || !['SIMDS_CREATED', 'SIMDS_READY'].includes(selectedDatastore?.statusId || '')" @click="openDatastore">
                    <ion-spinner v-if="isOpening" slot="start" name="crescent" />{{ translate("Open datastore") }}
                  </ion-button>
                </div>
              </div>

              <div v-else-if="currentStepId === 'routing-baseline'" class="task-content">
                <ion-item>
                  <ion-select :label="translate('Copied routing group')" :placeholder="translate('Choose a routing group')"
                    interface="popover" :value="selectedGroupId" :disabled="busy || !isOpen"
                    @ionChange="selectGroup($event.detail.value)">
                    <ion-select-option v-for="group in routingGroups" :key="group.routingGroupId" :value="group.routingGroupId">
                      {{ group.groupName || group.routingGroupId }} ({{ group.routingGroupId }})
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <p v-if="groupValidity" class="feedback" :class="groupValidity.verdict === 'VALID' ? 'success' : 'error'">
                  {{ translate("Validation") }}: {{ groupValidity.verdict }} · {{ translate("Valid references") }}: {{ groupValidity.validCount || 0 }} · {{ translate("Missing in copy") }}: {{ groupValidity.notInCopyCount || 0 }} · {{ translate("Missing at source") }}: {{ groupValidity.sourceGapCount || 0 }}
                </p>
                <p v-if="!routingGroups.length && isOpen" class="feedback">{{ translate("No copied routing groups found in the active datastore.") }}</p>
                <div class="action-row">
                  <ion-button fill="outline" :disabled="busy || !isOpen" @click="fetchRoutingBaseline">
                    {{ translate("Load routing groups") }}
                  </ion-button>
                  <ion-button v-if="routingGroups.length < totalGroupCount" fill="outline" :disabled="busy" @click="loadMoreRoutingGroups">
                    {{ translate("Load more groups") }}
                  </ion-button>
                  <ion-button :disabled="busy || !selectedGroupId" @click="validateSelectedGroup">
                    <ion-spinner v-if="isValidatingGroup" slot="start" name="crescent" />{{ translate("Validate selected group") }}
                  </ion-button>
                </div>
              </div>

              <div v-else-if="currentStepId === 'create-variation'" class="task-content">
                <p class="feedback">{{ translate("Optional: run the baseline alone, or clone its rules. A clone is identical until edited; this wizard does not edit rules.") }}</p>
                <ion-item>
                  <ion-input v-model="variationName" label-placement="stacked" :label="translate('Variation name')"
                    :placeholder="translate('e.g. Safety stock experiment')" :clear-input="true" />
                </ion-item>
                <ion-item v-if="createdVariationId">
                  <ion-label><h3>{{ translate("Cloned variation ID") }}</h3><p>{{ createdVariationId }}</p></ion-label>
                  <ion-badge slot="end" color="success">{{ translate("Created") }}</ion-badge>
                </ion-item>
                <div class="action-row">
                  <ion-button :disabled="busy || !baselineValid || !variationName.trim() || !!createdVariationId" @click="createVariation">
                    <ion-spinner v-if="isCloning" slot="start" name="crescent" />{{ translate("Clone variation") }}
                  </ion-button>
                </div>
              </div>

              <div v-else-if="currentStepId === 'execute-simulation'" class="task-content">
                <ion-item>
                  <ion-label>
                    <h3>{{ translate("Simulation run") }}</h3>
                    <p>{{ simulationId || translate("Not started") }} · {{ simulationStatus || translate("Ready to submit") }}</p>
                  </ion-label>
                  <ion-badge slot="end" :color="simulationFinished ? 'success' : isSimulating ? 'warning' : 'medium'">{{ simulationStatus || translate("Pending") }}</ion-badge>
                </ion-item>
                <p v-if="createdVariationId" class="feedback">{{ translate("Run baseline with cloned variation") }}: {{ includeVariation ? translate("Yes") : translate("No") }}</p>
                <ion-item v-if="createdVariationId && !simulationId" lines="none">
                  <ion-checkbox :checked="includeVariation" label-placement="end" @ionChange="includeVariation = $event.detail.checked">
                    {{ translate("Include cloned variation (currently identical to baseline)") }}
                  </ion-checkbox>
                </ion-item>
                <div v-if="simulationFinished" class="results">
                  <h3>{{ translate("Run results") }}</h3>
                  <p>{{ translate("Attempted") }}: {{ simulation?.attemptedItemCount ?? 0 }} · {{ translate("Brokered") }}: {{ simulation?.brokeredItemCount ?? 0 }} · {{ translate("Queued") }}: {{ simulation?.queuedItemCount ?? 0 }}</p>
                  <ion-item v-for="variant in simulationVariants" :key="variant.variantSeqId">
                    <ion-label>
                      <h3>{{ variant.label || variant.variantSeqId }}</h3>
                      <p>{{ translate("Attempted") }}: {{ variant.attemptedItemCount ?? 0 }} · {{ translate("Brokered") }}: {{ variant.brokeredItemCount ?? 0 }} · {{ translate("Queued") }}: {{ variant.queuedItemCount ?? 0 }}</p>
                      <p v-if="variant.failureReason" class="error">{{ variant.failureReason }}</p>
                    </ion-label>
                  </ion-item>
                </div>
                <div class="action-row">
                  <ion-button v-if="!simulationId" :disabled="busy || !baselineValid || !isOpen" @click="launchSimulation">
                    <ion-spinner v-if="isSimulating" slot="start" name="crescent" />{{ translate("Launch simulation") }}
                  </ion-button>
                  <ion-button v-else fill="outline" :disabled="busy" @click="pollSimulation">
                    <ion-spinner v-if="isSimulating" slot="start" name="crescent" />{{ translate("Refresh run status") }}
                  </ion-button>
                  <ion-button v-if="simulationFinished && selectedGroupId" @click="openRoutingGroup">
                    {{ translate("View routing group") }}<ion-icon slot="end" :icon="arrowForwardOutline" />
                  </ion-button>
                </div>
              </div>
            </ion-card-content>

            <div class="card-navigation">
              <ion-button fill="clear" :disabled="currentStepIndex === 0" @click="goToPreviousStep">
                <ion-icon slot="start" :icon="arrowBackOutline" />{{ translate("Previous") }}
              </ion-button>
              <ion-button v-if="currentStepIndex < SIMULATION_SETUP_STEPS.length - 1" color="primary" :disabled="!canGoNext" @click="goToNextStep">
                {{ translate("Next step") }}<ion-icon slot="end" :icon="arrowForwardOutline" />
              </ion-button>
              <ion-badge v-else-if="simulationFinished" color="success">{{ translate("Simulation complete") }}</ion-badge>
            </div>
          </ion-card>
        </section>
      </main>
      <ion-alert :is-open="!!deleteTarget" :header="translate('Permanently delete datastore?')"
        :message="deleteTarget ? `${deleteTarget.displayName || deleteTarget.datastoreName} (${deleteTarget.datastoreName}) — ${translate('This permanently deletes its MySQL database and all simulation data. No backup is created.')}` : ''"
        :buttons="deleteAlertButtons" @didDismiss="deleteTarget = null" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonAccordion, IonAccordionGroup, IonAlert, IonBackButton, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle,
  IonCardTitle, IonCheckbox, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList,
  IonListHeader, IonPage, IonProgressBar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from "@ionic/vue";
import { arrowBackOutline, arrowForwardOutline, checkmarkCircle } from "ionicons/icons";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { commonUtil, translate } from "@common";
import { SIMULATION_SETUP_GROUPS, SIMULATION_SETUP_STEPS } from "@/config/simulationSetupSteps";
import SimulationWizardStepList from "@/components/simulation/SimulationWizardStepList.vue";
import {
  checkSimulationRemoteConnection, loadSimulationRemoteConfig, saveSimulationRemoteConfig,
} from "@/services/SimulationRemoteConfigService";
import type { SimulationRemoteConfig } from "@/services/SimulationRemoteConfigService";
import {
  cloneSimVariation, createSimDatastore, deleteSimDatastore, getSimDatastore, getSimFill, getSimRun,
  listSimDatastores, listSimRoutingGroups, openSimDatastore, simulationSetupError,
  startSimFill, submitSimRun, validateSimRoutingGroup,
} from "@/services/SimulationSetupService";
import type { SimDatastore, SimFillTask, SimGroupValidity, SimRoutingGroup, SimRun, SimRunVariant } from "@/services/SimulationSetupService";

const storageKey = "simulation-setup-run";
const router = useRouter();
let mounted = true;
let selectionVersion = 0;
const currentStepId = ref("backend-connection");
const completedStepIds = ref<string[]>([]);
const inProgressStepIds = ref<string[]>([]);
const stepStatus = ref<Record<string, { badge?: string; badgeColor?: string; subtitle?: string }>>({});
const actionError = ref("");

const remoteSendUrl = ref("http://localhost:8082/rest/s1");
const remoteUsername = ref("");
const remotePassword = ref("");
const omsRemoteConfig = ref<SimulationRemoteConfig | null>(null);
const isSavingRemote = ref(false);
const isTestingConnection = ref(false);
const connectionCheckStatus = ref<"idle" | "success" | "error">("idle");
const connectionCheckMessage = ref("");
const canTestRemote = computed(() => Boolean(omsRemoteConfig.value &&
  remoteSendUrl.value === omsRemoteConfig.value.sendUrl &&
  remoteUsername.value === omsRemoteConfig.value.username && !remotePassword.value));

const datastores = ref<SimDatastore[]>([]);
const visibleDatastores = computed(() => datastores.value.filter(datastore => datastore.statusId !== "SIMDS_REMOVED"));
const newDatastoreDescription = ref("Baseline Simulation Snapshot");
const activeDatastoreId = ref("");
const selectedDatastore = ref<SimDatastore | null>(null);
const isProvisioning = ref(false);
const isDeleting = ref(false);
const deleteTarget = ref<SimDatastore | null>(null);
const deleteAlertButtons = [
  { text: translate("Cancel"), role: "cancel" },
  { text: translate("Delete database"), role: "destructive", handler: () => { void confirmDeleteDatastore(); } },
];
const fillId = ref("");
const fillStatus = ref("");
const isFilling = ref(false);
const fillCompleted = ref(false);
const fillMetrics = ref({ completeTasks: 0, failedTasks: 0, totalTasks: 0, rowsWritten: 0 });
const fillTasks = ref<SimFillTask[]>([]);
const visibleFillTasks = computed(() => fillTasks.value.filter(task =>
  task.statusId !== "SIMDSFS_COMPLETE" && task.statusId !== "SIMDSFS_PENDING"));
const groupedFillTasks = computed(() => [
  { value: "complete", label: "Completed operations", tasks: fillTasks.value.filter(task => task.statusId === "SIMDSFS_COMPLETE") },
  { value: "pending", label: "Pending operations", tasks: fillTasks.value.filter(task => task.statusId === "SIMDSFS_PENDING") },
].filter(group => group.tasks.length));
const readinessPassed = computed(() => selectedDatastore.value?.statusId === "SIMDS_READY");
const isOpening = ref(false);
const isOpen = ref(false);

const routingGroups = ref<SimRoutingGroup[]>([]);
const totalGroupCount = ref(0);
const groupPageIndex = ref(0);
const selectedGroupId = ref("");
const groupValidity = ref<SimGroupValidity | null>(null);
const isLoadingGroups = ref(false);
const isValidatingGroup = ref(false);
const baselineValid = computed(() => isOpen.value && Boolean(selectedGroupId.value) && groupValidity.value?.verdict === "VALID");
const variationName = ref("");
const createdVariationId = ref("");
const isCloning = ref(false);
const includeVariation = ref(false);
const simulationId = ref("");
const simulationStatus = ref("");
const simulation = ref<SimRun | null>(null);
const simulationVariants = ref<SimRunVariant[]>([]);
const isSimulating = ref(false);
const simulationFinished = computed(() => simulationStatus.value === "BRSIM_COMPLETE");

const busy = computed(() => isSavingRemote.value || isTestingConnection.value || isProvisioning.value || isDeleting.value ||
  isFilling.value || isOpening.value || isLoadingGroups.value || isValidatingGroup.value ||
  isCloning.value || isSimulating.value);
const currentStepIndex = computed(() => SIMULATION_SETUP_STEPS.findIndex(step => step.id === currentStepId.value));
const currentStep = computed(() => SIMULATION_SETUP_STEPS[currentStepIndex.value] || SIMULATION_SETUP_STEPS[0]);
const progressValue = computed(() => completedStepIds.value.length / SIMULATION_SETUP_STEPS.length);
const canGoNext = computed(() => currentStepId.value === "create-variation"
  ? baselineValid.value : completedStepIds.value.includes(currentStepId.value));

function markStepComplete(stepId: string, badge = "Complete") {
  if (!completedStepIds.value.includes(stepId)) completedStepIds.value.push(stepId);
  stepStatus.value[stepId] = { badge, badgeColor: "success" };
}

function clearStepsFrom(stepId: string) {
  const index = SIMULATION_SETUP_STEPS.findIndex(step => step.id === stepId);
  for (const step of SIMULATION_SETUP_STEPS.slice(index)) delete stepStatus.value[step.id];
  completedStepIds.value = completedStepIds.value.filter(id =>
    SIMULATION_SETUP_STEPS.findIndex(step => step.id === id) < index);
}

function selectStep(stepId: string) { currentStepId.value = stepId; actionError.value = ""; }
function goToNextStep() {
  if (canGoNext.value && currentStepIndex.value < SIMULATION_SETUP_STEPS.length - 1) {
    if (currentStepId.value === "create-variation" && !createdVariationId.value) {
      markStepComplete("create-variation", "Skipped");
    }
    selectStep(SIMULATION_SETUP_STEPS[currentStepIndex.value + 1].id);
  }
}
function goToPreviousStep() {
  if (currentStepIndex.value > 0) selectStep(SIMULATION_SETUP_STEPS[currentStepIndex.value - 1].id);
}

function openRoutingGroup() {
  if (selectedGroupId.value) void router.push(`/order-routing/${encodeURIComponent(selectedGroupId.value)}`);
}

function rememberRun() {
  sessionStorage.setItem(storageKey, JSON.stringify({
    datastoreId: activeDatastoreId.value, fillId: fillId.value,
    groupId: selectedGroupId.value, variationId: createdVariationId.value,
    simulationId: simulationId.value,
  }));
}

function fail(error: unknown) {
  actionError.value = simulationSetupError(error);
  commonUtil.showToast(actionError.value);
}

watch([remoteSendUrl, remoteUsername, remotePassword], () => {
  if (connectionCheckStatus.value === "idle") return;
  connectionCheckStatus.value = "idle";
  connectionCheckMessage.value = "";
  clearStepsFrom("backend-connection");
  ++selectionVersion;
  activeDatastoreId.value = "";
  selectedDatastore.value = null;
  datastores.value = [];
  fillId.value = "";
  fillTasks.value = [];
  fillCompleted.value = false;
  isOpen.value = false;
  routingGroups.value = [];
  selectedGroupId.value = "";
  groupValidity.value = null;
  createdVariationId.value = "";
  simulationId.value = "";
  simulationStatus.value = "";
  sessionStorage.removeItem(storageKey);
});

async function loadOmsRemoteConfig() {
  try {
    const remote = await loadSimulationRemoteConfig();
    omsRemoteConfig.value = remote;
    if (remote?.sendUrl) remoteSendUrl.value = remote.sendUrl;
    if (remote?.username) remoteUsername.value = remote.username;
    if (remote) stepStatus.value["backend-connection"] = { badge: "Configured", badgeColor: "primary" };
  } catch (error) { fail(error); }
}

async function saveRemoteAuth() {
  isSavingRemote.value = true;
  actionError.value = "";
  connectionCheckStatus.value = "idle";
  clearStepsFrom("backend-connection");
  try {
    await saveSimulationRemoteConfig({ sendUrl: remoteSendUrl.value, username: remoteUsername.value,
      password: remotePassword.value }, Boolean(omsRemoteConfig.value));
    remotePassword.value = "";
    await loadOmsRemoteConfig();
    commonUtil.showToast(translate("Sim Routing credentials saved in OMS"));
  } catch (error) { fail(error); }
  finally { isSavingRemote.value = false; }
}

async function testRemoteConnection() {
  if (!canTestRemote.value) return;
  isTestingConnection.value = true;
  actionError.value = "";
  connectionCheckStatus.value = "idle";
  completedStepIds.value = completedStepIds.value.filter(id => id !== "backend-connection");
  delete stepStatus.value["backend-connection"];
  try {
    const count = await checkSimulationRemoteConnection();
    if (!mounted) return;
    connectionCheckStatus.value = "success";
    connectionCheckMessage.value = translate("Connected through Main OMS. {count} datastores found.").replace("{count}", String(count));
    markStepComplete("backend-connection", "Connected");
    await loadDatastores();
  } catch (error) {
    connectionCheckStatus.value = "error";
    connectionCheckMessage.value = simulationSetupError(error);
    stepStatus.value["backend-connection"] = { badge: "Check failed", badgeColor: "danger" };
  } finally { isTestingConnection.value = false; }
}

async function loadDatastores() {
  actionError.value = "";
  try {
    datastores.value = await listSimDatastores();
    const saved = sessionStorage.getItem(storageKey);
    const savedRun = saved ? JSON.parse(saved) : null;
    if (!activeDatastoreId.value && savedRun?.datastoreId && visibleDatastores.value.some(d => d.simDatastoreId === savedRun.datastoreId)) {
      await chooseDatastore(savedRun.datastoreId, savedRun);
    } else if (activeDatastoreId.value) {
      await refreshReadiness();
    }
  } catch (error) { fail(error); }
}

async function selectDatastore(id: string) {
  if (id) await chooseDatastore(id);
}

async function chooseDatastore(id: string, savedRun?: Record<string, string>) {
  const version = ++selectionVersion;
  actionError.value = "";
  try {
    const datastore = await getSimDatastore(id);
    if (version !== selectionVersion || !mounted) return;
    clearStepsFrom("datastore-select");
    activeDatastoreId.value = id;
    selectedDatastore.value = datastore;
    fillId.value = savedRun?.fillId || "";
    fillStatus.value = "";
    fillTasks.value = [];
    fillCompleted.value = datastore.statusId === "SIMDS_READY";
    fillMetrics.value = { completeTasks: 0, failedTasks: 0, totalTasks: 0, rowsWritten: 0 };
    isOpen.value = false;
    routingGroups.value = [];
    totalGroupCount.value = 0;
    groupPageIndex.value = 0;
    selectedGroupId.value = "";
    groupValidity.value = null;
    createdVariationId.value = "";
    includeVariation.value = false;
    simulationId.value = "";
    simulationStatus.value = "";
    simulation.value = null;
    simulationVariants.value = [];
    markStepComplete("datastore-select", "Selected");
    if (fillCompleted.value) {
      markStepComplete("data-fill", "Ready copy");
      markStepComplete("readiness-gate", "Ready");
    }
    if (savedRun?.groupId) selectedGroupId.value = savedRun.groupId;
    if (savedRun?.variationId) createdVariationId.value = savedRun.variationId;
    if (savedRun?.simulationId) simulationId.value = savedRun.simulationId;
    rememberRun();
    if (fillId.value && !fillCompleted.value) await refreshFillOnce();
    if (simulationId.value) await refreshSimulationOnce();
  } catch (error) { fail(error); }
}

async function provisionDatastore() {
  isProvisioning.value = true;
  actionError.value = "";
  try {
    const id = await createSimDatastore(newDatastoreDescription.value.trim());
    datastores.value = await listSimDatastores();
    await chooseDatastore(id);
  } catch (error) { fail(error); }
  finally { isProvisioning.value = false; }
}

async function confirmDeleteDatastore() {
  const target = deleteTarget.value;
  if (!target || busy.value || isOpen.value) return;
  isDeleting.value = true;
  actionError.value = "";
  try {
    await deleteSimDatastore(target.simDatastoreId);
    datastores.value = await listSimDatastores();
    if (activeDatastoreId.value === target.simDatastoreId) {
      ++selectionVersion;
      clearStepsFrom("datastore-select");
      activeDatastoreId.value = "";
      selectedDatastore.value = null;
      fillId.value = "";
      fillStatus.value = "";
      fillTasks.value = [];
      fillCompleted.value = false;
      isOpen.value = false;
      routingGroups.value = [];
      selectedGroupId.value = "";
      groupValidity.value = null;
      createdVariationId.value = "";
      simulationId.value = "";
      simulationStatus.value = "";
      sessionStorage.removeItem(storageKey);
    }
    commonUtil.showToast(translate("Datastore database deleted"));
  } catch (error) { fail(error); }
  finally { isDeleting.value = false; }
}

async function refreshFillOnce() {
  if (!activeDatastoreId.value || !fillId.value) return;
  const progress = await getSimFill(activeDatastoreId.value, fillId.value);
  fillStatus.value = progress.statusId;
  fillTasks.value = progress.tasks || [];
  const counts = progress.taskCounts || {};
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  fillMetrics.value = {
    completeTasks: Number(counts.SIMDSFS_COMPLETE || 0),
    failedTasks: Number(counts.SIMDSFS_FAILED || 0),
    totalTasks: total || fillMetrics.value.totalTasks,
    rowsWritten: Number(progress.rowsWritten || 0),
  };
  if (progress.statusId === "SIMDSF_COMPLETE") {
    fillCompleted.value = true;
    markStepComplete("data-fill");
    await refreshReadiness();
  } else if (progress.statusId === "SIMDSF_FAILED") {
    throw new Error(translate(fillTasks.value.some(task => task.statusId === "SIMDSFS_FAILED")
      ? "Data copy stopped. Review the failed task below."
      : "Data copy stopped. Task details are not available from Sim Routing."));
  } else if (progress.statusId === "SIMDSF_CANCELLED") {
    throw new Error(translate("Data copy was cancelled."));
  }
}

async function startDataFill() {
  if (!activeDatastoreId.value || !isOpen.value || selectedDatastore.value?.statusId !== "SIMDS_CREATED") return;
  isFilling.value = true;
  actionError.value = "";
  try {
    const openedName = await openSimDatastore(activeDatastoreId.value);
    if (openedName !== selectedDatastore.value?.datastoreName) throw new Error("Sim Routing opened a different datastore.");
    const submitted = await startSimFill(activeDatastoreId.value);
    fillId.value = submitted.fillId;
    fillMetrics.value.totalTasks = submitted.taskCount;
    rememberRun();
    await waitForFill();
  } catch (error) { fail(error); }
  finally { isFilling.value = false; }
}

async function pollFill() {
  if (!fillId.value) return;
  isFilling.value = true;
  actionError.value = "";
  try { await waitForFill(); }
  catch (error) { fail(error); }
  finally { isFilling.value = false; }
}

async function waitForFill() {
  const expectedId = fillId.value;
  const version = selectionVersion;
  while (mounted && fillId.value === expectedId && selectionVersion === version) {
    await refreshFillOnce();
    if (fillCompleted.value) return;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function refreshReadiness() {
  if (!activeDatastoreId.value) return;
  actionError.value = "";
  try {
    selectedDatastore.value = await getSimDatastore(activeDatastoreId.value);
    if (readinessPassed.value) {
      fillCompleted.value = true;
      markStepComplete("data-fill", "Ready copy");
      markStepComplete("readiness-gate", "Ready");
    } else {
      clearStepsFrom("readiness-gate");
      groupValidity.value = null;
    }
  } catch (error) { fail(error); }
}

async function openDatastore() {
  if (!activeDatastoreId.value || !["SIMDS_CREATED", "SIMDS_READY"].includes(selectedDatastore.value?.statusId || "")) return;
  isOpening.value = true;
  actionError.value = "";
  try {
    const openedName = await openSimDatastore(activeDatastoreId.value);
    if (openedName !== selectedDatastore.value?.datastoreName) throw new Error("Sim Routing opened a different datastore.");
    isOpen.value = true;
    markStepComplete("open-datastore", "Opened");
    if (readinessPassed.value) await fetchRoutingBaseline();
  } catch (error) { fail(error); }
  finally { isOpening.value = false; }
}

async function fetchRoutingBaseline() {
  if (!isOpen.value) return;
  isLoadingGroups.value = true;
  actionError.value = "";
  try {
    const page = await listSimRoutingGroups(0);
    routingGroups.value = page.groups;
    totalGroupCount.value = page.totalCount;
    groupPageIndex.value = 0;
    if (selectedGroupId.value && !routingGroups.value.some(group => group.routingGroupId === selectedGroupId.value)) {
      selectedGroupId.value = "";
      groupValidity.value = null;
    }
  } catch (error) { fail(error); }
  finally { isLoadingGroups.value = false; }
}

async function loadMoreRoutingGroups() {
  if (!isOpen.value || routingGroups.value.length >= totalGroupCount.value) return;
  isLoadingGroups.value = true;
  actionError.value = "";
  try {
    const nextPage = groupPageIndex.value + 1;
    const page = await listSimRoutingGroups(nextPage);
    routingGroups.value.push(...page.groups);
    totalGroupCount.value = page.totalCount;
    groupPageIndex.value = nextPage;
  } catch (error) { fail(error); }
  finally { isLoadingGroups.value = false; }
}

function selectGroup(id: string) {
  selectedGroupId.value = id;
  groupValidity.value = null;
  clearStepsFrom("routing-baseline");
  createdVariationId.value = "";
  includeVariation.value = false;
  simulationId.value = "";
  simulationStatus.value = "";
  rememberRun();
}

async function validateSelectedGroup() {
  if (!selectedGroupId.value || !isOpen.value) return;
  isValidatingGroup.value = true;
  actionError.value = "";
  clearStepsFrom("routing-baseline");
  try {
    groupValidity.value = await validateSimRoutingGroup(selectedGroupId.value);
    if (groupValidity.value.verdict === "VALID") markStepComplete("routing-baseline", "Valid");
    else actionError.value = translate("This group has unresolved references in the datastore. Choose another group or repair the copy before running.");
    rememberRun();
  } catch (error) { fail(error); }
  finally { isValidatingGroup.value = false; }
}

async function createVariation() {
  if (!baselineValid.value || !variationName.value.trim()) return;
  isCloning.value = true;
  actionError.value = "";
  try {
    createdVariationId.value = await cloneSimVariation(selectedGroupId.value, variationName.value.trim());
    markStepComplete("create-variation", "Cloned");
    rememberRun();
  } catch (error) { fail(error); }
  finally { isCloning.value = false; }
}

async function refreshSimulationOnce() {
  if (!simulationId.value) return;
  const result = await getSimRun(simulationId.value);
  simulation.value = result.simulation;
  simulationVariants.value = result.variants;
  simulationStatus.value = result.simulation.statusId;
  if (result.simulation.statusId === "BRSIM_COMPLETE") markStepComplete("execute-simulation");
  else if (result.simulation.statusId === "BRSIM_FAILED") throw new Error(`Simulation ${simulationId.value} failed. Check the run record in Sim Routing.`);
}

async function launchSimulation() {
  if (!baselineValid.value || !isOpen.value || simulationId.value) return;
  isSimulating.value = true;
  actionError.value = "";
  try {
    const ids = [selectedGroupId.value];
    if (includeVariation.value && createdVariationId.value) ids.push(createdVariationId.value);
    const submitted = await submitSimRun(ids);
    simulationId.value = submitted.simulationId;
    simulationStatus.value = "BRSIM_QUEUED";
    rememberRun();
    await waitForSimulation();
  } catch (error) { fail(error); }
  finally { isSimulating.value = false; }
}

async function pollSimulation() {
  if (!simulationId.value) return;
  isSimulating.value = true;
  actionError.value = "";
  try { await waitForSimulation(); }
  catch (error) { fail(error); }
  finally { isSimulating.value = false; }
}

async function waitForSimulation() {
  const expectedId = simulationId.value;
  const version = selectionVersion;
  while (mounted && simulationId.value === expectedId && selectionVersion === version) {
    await refreshSimulationOnce();
    if (simulationFinished.value) return;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

onMounted(() => { mounted = true; loadOmsRemoteConfig(); });
onUnmounted(() => { mounted = false; });
</script>

<style scoped>
.sim-setup-wizard { display: flex; align-items: flex-start; gap: 48px; padding: 24px 20px 48px; max-width: 1200px; margin: 0 auto; }
.wizard-steps { flex: 0 0 360px; max-width: 360px; width: 100%; }
.wizard-task { flex: 1 1 540px; max-width: 680px; width: 100%; }
.step-description { color: var(--ion-color-medium); font-size: 14px; line-height: 1.5; margin-bottom: 16px; }
.task-content { margin: 16px 0; }
.action-row { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
.feedback { margin: 12px 0; color: var(--ion-color-medium); font-size: 14px; }
.success { color: var(--ion-color-success); }
.error { color: var(--ion-color-danger); }
.results { margin-top: 24px; padding: 16px; border: 1px solid var(--ion-color-medium); border-radius: 6px; }
.card-navigation { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--ion-color-step-150, #e0e0e0); padding: 16px; margin-top: 12px; }
@media (max-width: 850px) { .sim-setup-wizard { flex-direction: column; gap: 12px; } .wizard-steps, .wizard-task { flex: auto; max-width: 100%; } }
</style>
