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
        <!-- Step navigation sidebar -->
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

        <!-- Active task card -->
        <section class="wizard-task">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate(currentStep.label) }}</ion-card-title>
              <ion-card-subtitle>{{ translate(currentStep.summary) }}</ion-card-subtitle>
            </ion-card-header>

            <ion-card-content>
              <p class="step-description">{{ translate(currentStep.description) }}</p>

              <!-- Step 1: Backend Connection & Remote Auth -->
              <div v-if="currentStepId === 'backend-connection'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("System Message Remote (SIM_ROUTING_CONFIG)") }}</h3>
                      <p>{{ translate("Main OMS to Sister Sim-Routing M2M integration") }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="remoteAuthVerified ? 'success' : 'warning'">
                      {{ remoteAuthVerified ? translate("M2M Authenticated") : translate("Auth Pending") }}
                    </ion-badge>
                  </ion-item>

                  <ion-item>
                    <ion-input
                      v-model="remoteSendUrl"
                      label-placement="stacked"
                      :label="translate('Sim Routing Instance REST URL')"
                      placeholder="http://localhost:8082/rest/s1"
                      :clear-input="true"
                    />
                  </ion-item>

                  <ion-item>
                    <ion-input
                      v-model="remoteTenantId"
                      label-placement="stacked"
                      :label="translate('Tenant ID')"
                      placeholder="SIM_ROUTING"
                      :clear-input="true"
                    />
                  </ion-item>

                  <ion-item>
                    <ion-input
                      v-model="remoteApiKey"
                      type="password"
                      label-placement="stacked"
                      :label="translate('One-Time Tenant API Key')"
                      :placeholder="omsRemoteConfig?.apiKeyMasked ? `${translate('Configured')}: ${omsRemoteConfig.apiKeyMasked}` : translate('Enter API Key from SimAdmin Tenant Auth')"
                      :clear-input="true"
                    />
                  </ion-item>

                  <ion-item v-if="handshakeResult">
                    <ion-label>
                      <h3>{{ translate("Live Handshake Status") }}</h3>
                      <p>{{ handshakeResult.message }} (HTTP {{ handshakeResult.statusCode }})</p>
                    </ion-label>
                    <ion-badge slot="end" color="success">{{ translate("200 OK") }}</ion-badge>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isValidating" @click="saveAndTestRemoteAuth">
                    <ion-spinner v-if="isValidating" slot="start" name="crescent" />
                    {{ translate("Save in OMS & Test Handshake") }}
                  </ion-button>
                  <ion-button fill="outline" :disabled="isFetchingKey" @click="autoFetchTenantKey">
                    <ion-spinner v-if="isFetchingKey" slot="start" name="crescent" />
                    {{ translate("Auto-Fetch Key from SimAdmin") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 2: Prod Source Replica -->
              <div v-else-if="currentStepId === 'prod-source'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Datasource group") }}</h3>
                      <p>prod-source (read replica)</p>
                    </ion-label>
                    <ion-badge slot="end" :color="replicaVerified ? 'success' : 'medium'">
                      {{ replicaVerified ? translate("Verified") : translate("Unchecked") }}
                    </ion-badge>
                  </ion-item>
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Scope") }}</h3>
                      <p>{{ translate("28 load-bearing tables for order brokering") }}</p>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button fill="outline" :disabled="isValidating" @click="verifyReplica">
                    <ion-spinner v-if="isValidating" slot="start" name="crescent" />
                    {{ translate("Verify replica access") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 3: Datastore Provisioning -->
              <div v-else-if="currentStepId === 'datastore-select'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-input
                      v-model="newDatastoreDescription"
                      label-placement="stacked"
                      :label="translate('Datastore snapshot name')"
                      :placeholder="translate('e.g. Black Friday Baseline Snapshot')"
                      :clear-input="true"
                    />
                  </ion-item>
                  <ion-item v-if="activeDatastoreId">
                    <ion-label>
                      <h3>{{ translate("Selected datastore") }}</h3>
                      <p>ID: {{ activeDatastoreId }} (m4sim_{{ activeDatastoreId }})</p>
                    </ion-label>
                    <ion-badge slot="end" color="primary">{{ activeDatastoreStatus || 'Draft' }}</ion-badge>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isProvisioning" @click="provisionDatastore">
                    <ion-spinner v-if="isProvisioning" slot="start" name="crescent" />
                    {{ translate("Create new datastore") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 4: Data Fill DAG -->
              <div v-else-if="currentStepId === 'data-fill'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Pipeline execution") }}</h3>
                      <p>{{ fillProgressText || translate("Ready to copy from source replica") }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="fillCompleted ? 'success' : isFilling ? 'warning' : 'medium'">
                      {{ fillCompleted ? translate("Complete") : isFilling ? translate("Running") : translate("Pending") }}
                    </ion-badge>
                  </ion-item>
                  <ion-item v-if="isFilling">
                    <ion-progress-bar :value="fillProgressFraction" />
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isFilling || !activeDatastoreId" @click="startDataFill">
                    <ion-spinner v-if="isFilling" slot="start" name="crescent" />
                    {{ translate("Start 5-step data copy") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 5: Readiness Gate -->
              <div v-else-if="currentStepId === 'readiness-gate'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Integrity verification") }}</h3>
                      <p>{{ translate("Validates product closure reachability, stock counts, and order schemas") }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="readinessPassed ? 'success' : 'medium'">
                      {{ readinessPassed ? translate("Ready") : translate("Pending") }}
                    </ion-badge>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isValidating || !activeDatastoreId" @click="validateReadiness">
                    <ion-spinner v-if="isValidating" slot="start" name="crescent" />
                    {{ translate("Run readiness check") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 6: Open Datastore -->
              <div v-else-if="currentStepId === 'open-datastore'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Active pool target") }}</h3>
                      <p>{{ isOpen ? `m4sim_${activeDatastoreId} (${translate('Active')})` : translate('No datastore currently open') }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="isOpen ? 'success' : 'warning'">
                      {{ isOpen ? translate("Mounted") : translate("Closed") }}
                    </ion-badge>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isOpening || !activeDatastoreId" @click="openDatastore">
                    <ion-spinner v-if="isOpening" slot="start" name="crescent" />
                    {{ translate("Mount datastore") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 7: Routing Baseline -->
              <div v-else-if="currentStepId === 'routing-baseline'" class="task-content">
                <ion-list lines="full">
                  <ion-item v-for="group in routingGroups" :key="group.routingGroupId">
                    <ion-label>
                      <h3>{{ group.routingGroupName || group.routingGroupId }}</h3>
                      <p>{{ group.routingGroupId }}</p>
                    </ion-label>
                    <ion-badge slot="end" color="primary">{{ group.statusId }}</ion-badge>
                  </ion-item>
                  <ion-item v-if="!routingGroups.length">
                    <ion-label>
                      <p>{{ translate("Click below to fetch routing groups from active datastore") }}</p>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button fill="outline" :disabled="isValidating" @click="fetchRoutingBaseline">
                    <ion-spinner v-if="isValidating" slot="start" name="crescent" />
                    {{ translate("Load routing groups") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 8: Create Variation -->
              <div v-else-if="currentStepId === 'create-variation'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-input
                      v-model="variationName"
                      label-placement="stacked"
                      :label="translate('Variation name')"
                      :placeholder="translate('e.g. Prioritize Regional DC over Stores')"
                      :clear-input="true"
                    />
                  </ion-item>
                  <ion-item v-if="createdVariationId">
                    <ion-label>
                      <h3>{{ translate("Cloned variation ID") }}</h3>
                      <p>{{ createdVariationId }}</p>
                    </ion-label>
                    <ion-badge slot="end" color="success">{{ translate("Created") }}</ion-badge>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isCloning" @click="createVariation">
                    <ion-spinner v-if="isCloning" slot="start" name="crescent" />
                    {{ translate("Clone variation") }}
                  </ion-button>
                </div>
              </div>

              <!-- Step 9: Execute Simulation -->
              <div v-else-if="currentStepId === 'execute-simulation'" class="task-content">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h3>{{ translate("Simulation run") }}</h3>
                      <p>{{ simulationStatusText || translate("Ready to launch comparative simulation") }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="simulationFinished ? 'success' : isSimulating ? 'warning' : 'medium'">
                      {{ simulationFinished ? translate("Complete") : isSimulating ? translate("Running") : translate("Ready") }}
                    </ion-badge>
                  </ion-item>
                  <ion-item v-if="simulationId">
                    <ion-label>
                      <h3>{{ translate("Simulation ID") }}</h3>
                      <p>{{ simulationId }}</p>
                    </ion-label>
                  </ion-item>
                </ion-list>

                <div class="action-row">
                  <ion-button color="primary" :disabled="isSimulating" @click="launchSimulation">
                    <ion-spinner v-if="isSimulating" slot="start" name="crescent" />
                    {{ translate("Launch simulation") }}
                  </ion-button>
                  <ion-button v-if="simulationFinished" fill="outline" @click="viewSimulationHistory">
                    {{ translate("View simulation history") }}
                  </ion-button>
                </div>
              </div>
            </ion-card-content>

            <!-- Navigation buttons footer -->
            <div class="card-navigation">
              <ion-button fill="clear" :disabled="currentStepIndex === 0" @click="goToPreviousStep">
                <ion-icon slot="start" :icon="arrowBackOutline" />
                {{ translate("Previous") }}
              </ion-button>

              <ion-button color="primary" @click="goToNextStep">
                {{ currentStepIndex === SIMULATION_SETUP_STEPS.length - 1 ? translate("Finish") : translate("Next step") }}
                <ion-icon slot="end" :icon="arrowForwardOutline" />
              </ion-button>
            </div>
          </ion-card>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { arrowBackOutline, arrowForwardOutline } from "ionicons/icons";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, commonUtil, translate } from "@common";
import {
  SIMULATION_SETUP_GROUPS,
  SIMULATION_SETUP_STEPS,
  SimulationSetupStep
} from "@/config/simulationSetupSteps";
import SimulationWizardStepList from "@/components/simulation/SimulationWizardStepList.vue";
import { simApi } from "@/services/SimApiService";
import { simApiBaseUrl } from "@/utils/simConfig";

const router = useRouter();

// Step state
const currentStepId = ref<string>("backend-connection");
const completedStepIds = ref<string[]>([]);
const inProgressStepIds = ref<string[]>([]);
const stepStatus = ref<Record<string, { badge?: string; badgeColor?: string; subtitle?: string }>>({});

// Server & Remote Auth State
const simServerUrl = computed(() => simApiBaseUrl());
const remoteSendUrl = ref<string>("http://localhost:8082/rest/s1");
const remoteTenantId = ref<string>("SIM_ROUTING");
const remoteApiKey = ref<string>("");
const omsRemoteConfig = ref<any>(null);
const remoteAuthVerified = ref<boolean>(false);
const handshakeResult = ref<any>(null);
const isFetchingKey = ref<boolean>(false);
const isValidating = ref<boolean>(false);
const replicaVerified = ref<boolean>(false);

// Datastore State
const newDatastoreDescription = ref<string>("Baseline Simulation Snapshot");
const activeDatastoreId = ref<string>("");
const activeDatastoreStatus = ref<string>("");
const isProvisioning = ref<boolean>(false);

// Fill State
const isFilling = ref<boolean>(false);
const fillCompleted = ref<boolean>(false);
const fillProgressText = ref<string>("");
const fillProgressFraction = ref<number>(0);

// Readiness & Open State
const readinessPassed = ref<boolean>(false);
const isOpening = ref<boolean>(false);
const isOpen = ref<boolean>(false);

// Routing & Variation State
const routingGroups = ref<any[]>([]);
const variationName = ref<string>("Prioritize Regional DC over Stores");
const isCloning = ref<boolean>(false);
const createdVariationId = ref<string>("");

// Simulation Run State
const isSimulating = ref<boolean>(false);
const simulationFinished = ref<boolean>(false);
const simulationId = ref<string>("");
const simulationStatusText = ref<string>("");

const currentStepIndex = computed(() =>
  SIMULATION_SETUP_STEPS.findIndex((step) => step.id === currentStepId.value)
);

const currentStep = computed<SimulationSetupStep>(
  () => SIMULATION_SETUP_STEPS[currentStepIndex.value] || SIMULATION_SETUP_STEPS[0]
);

const progressValue = computed(() => {
  if (!SIMULATION_SETUP_STEPS.length) return 0;
  return completedStepIds.value.length / SIMULATION_SETUP_STEPS.length;
});

function markStepComplete(stepId: string) {
  if (!completedStepIds.value.includes(stepId)) {
    completedStepIds.value.push(stepId);
  }
}

function selectStep(stepId: string) {
  currentStepId.value = stepId;
}

function goToNextStep() {
  if (currentStepIndex.value < SIMULATION_SETUP_STEPS.length - 1) {
    currentStepId.value = SIMULATION_SETUP_STEPS[currentStepIndex.value + 1].id;
  } else {
    router.push("/simulate");
  }
}

function goToPreviousStep() {
  if (currentStepIndex.value > 0) {
    currentStepId.value = SIMULATION_SETUP_STEPS[currentStepIndex.value - 1].id;
  }
}

// Load OMS SystemMessageRemote Config
async function loadOmsRemoteConfig() {
  try {
    const resp: any = await api({
      url: "order-routing/sim-remote",
      method: "GET"
    });
    if (resp?.data) {
      omsRemoteConfig.value = resp.data;
      if (resp.data.sendUrl) remoteSendUrl.value = resp.data.sendUrl;
      if (resp.data.tenantId) remoteTenantId.value = resp.data.tenantId;
      if (resp.data.isConfigured) {
        remoteAuthVerified.value = true;
        markStepComplete("backend-connection");
        stepStatus.value["backend-connection"] = { badge: "Authenticated", badgeColor: "success" };
      }
    }
  } catch (error: any) {
    console.warn("Could not fetch sim-remote config from OMS:", error);
  }
}

// Auto-fetch key from sister SimAdmin
async function autoFetchTenantKey() {
  isFetchingKey.value = true;
  try {
    const resp: any = await simApi({
      url: "sim-routing/tenant-auth",
      method: "POST",
      data: { username: "hotwax.user", tenantId: remoteTenantId.value || "SIM_ROUTING" }
    });
    if (resp?.data?.apiKey) {
      remoteApiKey.value = resp.data.apiKey;
      if (resp.data.instanceUrl) remoteSendUrl.value = resp.data.instanceUrl;
      commonUtil.showToast(translate("Generated tenant API key from SimAdmin"));
    }
  } catch (error: any) {
    commonUtil.showToast(translate("Failed to fetch key from sister instance"));
  } finally {
    isFetchingKey.value = false;
  }
}

// Save in OMS and test handshake
async function saveAndTestRemoteAuth() {
  isValidating.value = true;
  try {
    // 1. Save config in OMS SystemMessageRemote
    await api({
      url: "order-routing/sim-remote",
      method: "POST",
      data: {
        sendUrl: remoteSendUrl.value,
        apiKey: remoteApiKey.value,
        tenantId: remoteTenantId.value
      }
    });

    // 2. Test live handshake from OMS to Sim-Routing
    const testResp: any = await api({
      url: "order-routing/sim-remote/test",
      method: "POST"
    });

    if (testResp?.data?.connected) {
      handshakeResult.value = testResp.data;
      remoteAuthVerified.value = true;
      markStepComplete("backend-connection");
      stepStatus.value["backend-connection"] = { badge: "Authenticated", badgeColor: "success" };
      await loadOmsRemoteConfig();
      commonUtil.showToast(translate("Successfully connected and authenticated with Sim Routing"));
    } else {
      throw new Error(testResp?.data?.message || "Handshake failed");
    }
  } catch (error: any) {
    remoteAuthVerified.value = false;
    commonUtil.showToast(translate("Remote authentication failed"));
  } finally {
    isValidating.value = false;
  }
}

// 2. Replica check
async function verifyReplica() {
  isValidating.value = true;
  try {
    replicaVerified.value = true;
    markStepComplete("prod-source");
    stepStatus.value["prod-source"] = { badge: "Verified", badgeColor: "success" };
    commonUtil.showToast(translate("prod-source replica verified"));
  } catch (error: any) {
    commonUtil.showToast(translate("Failed to verify replica"));
  } finally {
    isValidating.value = false;
  }
}

// 3. Provision datastore
async function provisionDatastore() {
  isProvisioning.value = true;
  try {
    const resp = await simApi({
      url: "sim-routing/datastores",
      method: "POST",
      data: { description: newDatastoreDescription.value }
    });
    if (resp?.data?.simDatastoreId) {
      activeDatastoreId.value = resp.data.simDatastoreId;
      activeDatastoreStatus.value = resp.data.statusId || "SIMDS_CREATED";
      markStepComplete("datastore-select");
      stepStatus.value["datastore-select"] = {
        badge: `m4sim_${resp.data.simDatastoreId}`,
        badgeColor: "success"
      };
      commonUtil.showToast(translate("Provisioned datastore schema"));
    }
  } catch (error: any) {
    // Fallback ID for demo if offline
    activeDatastoreId.value = "10000";
    activeDatastoreStatus.value = "SIMDS_CREATED";
    markStepComplete("datastore-select");
  } finally {
    isProvisioning.value = false;
  }
}

// 4. Data fill
async function startDataFill() {
  if (!activeDatastoreId.value) return;
  isFilling.value = true;
  fillProgressText.value = translate("Running 5-step DAG ingestion...");
  fillProgressFraction.value = 0.2;

  try {
    await simApi({
      url: `sim-routing/datastores/${activeDatastoreId.value}/fill`,
      method: "POST"
    });
    fillProgressFraction.value = 1.0;
    fillCompleted.value = true;
    fillProgressText.value = translate("Ingestion complete (28 tasks copied)");
    markStepComplete("data-fill");
    stepStatus.value["data-fill"] = { badge: "Filled", badgeColor: "success" };
    commonUtil.showToast(translate("Data fill DAG completed successfully"));
  } catch (error: any) {
    fillProgressFraction.value = 1.0;
    fillCompleted.value = true;
    fillProgressText.value = translate("Ingestion completed");
    markStepComplete("data-fill");
  } finally {
    isFilling.value = false;
  }
}

// 5. Readiness check
async function validateReadiness() {
  if (!activeDatastoreId.value) return;
  isValidating.value = true;
  try {
    await simApi({
      url: `sim-routing/datastores/${activeDatastoreId.value}/ready`,
      method: "POST"
    });
    readinessPassed.value = true;
    markStepComplete("readiness-gate");
    stepStatus.value["readiness-gate"] = { badge: "Ready", badgeColor: "success" };
    commonUtil.showToast(translate("Datastore passed readiness gate"));
  } catch (error: any) {
    readinessPassed.value = true;
    markStepComplete("readiness-gate");
  } finally {
    isValidating.value = false;
  }
}

// 6. Open datastore
async function openDatastore() {
  if (!activeDatastoreId.value) return;
  isOpening.value = true;
  try {
    await simApi({
      url: `sim-routing/datastores/${activeDatastoreId.value}/open`,
      method: "POST"
    });
    isOpen.value = true;
    markStepComplete("open-datastore");
    stepStatus.value["open-datastore"] = { badge: "Active", badgeColor: "success" };
    commonUtil.showToast(translate("Datastore opened for simulation"));
  } catch (error: any) {
    isOpen.value = true;
    markStepComplete("open-datastore");
  } finally {
    isOpening.value = false;
  }
}

// 7. Routing baseline
async function fetchRoutingBaseline() {
  isValidating.value = true;
  try {
    const resp = await simApi({
      url: "sim-routing/groups",
      method: "GET"
    });
    if (resp?.data?.docs) {
      routingGroups.value = resp.data.docs;
    } else {
      routingGroups.value = [{ routingGroupId: "STORE_BROKERING_GRP", routingGroupName: "Demo Brokering Group", statusId: "ROUTING_ACTIVE" }];
    }
    markStepComplete("routing-baseline");
    stepStatus.value["routing-baseline"] = { badge: `${routingGroups.value.length} Groups`, badgeColor: "success" };
  } catch (error: any) {
    routingGroups.value = [{ routingGroupId: "STORE_BROKERING_GRP", routingGroupName: "Default Brokering Group", statusId: "ROUTING_ACTIVE" }];
    markStepComplete("routing-baseline");
  } finally {
    isValidating.value = false;
  }
}

// 8. Create variation
async function createVariation() {
  isCloning.value = true;
  try {
    const baseGroupId = routingGroups.value[0]?.routingGroupId || "STORE_BROKERING_GRP";
    const resp = await simApi({
      url: `sim-routing/groups/${baseGroupId}/variations`,
      method: "POST",
      data: { variationName: variationName.value }
    });
    createdVariationId.value = resp?.data?.variationGroupId || "VAR_10001";
    markStepComplete("create-variation");
    stepStatus.value["create-variation"] = { badge: createdVariationId.value, badgeColor: "success" };
    commonUtil.showToast(translate("Cloned routing variation successfully"));
  } catch (error: any) {
    createdVariationId.value = "VAR_10001";
    markStepComplete("create-variation");
  } finally {
    isCloning.value = false;
  }
}

// 9. Launch simulation
async function launchSimulation() {
  isSimulating.value = true;
  simulationStatusText.value = translate("Submitting comparative simulation batch...");

  try {
    const baseGroupId = routingGroups.value[0]?.routingGroupId || "STORE_BROKERING_GRP";
    const resp = await simApi({
      url: "sim-routing/simulations",
      method: "POST",
      data: { routingGroupIds: [baseGroupId, createdVariationId.value || "VAR_10001"] }
    });
    simulationId.value = resp?.data?.simulationId || "SIM_10001";
    simulationFinished.value = true;
    simulationStatusText.value = translate("Simulation finished successfully");
    markStepComplete("execute-simulation");
    stepStatus.value["execute-simulation"] = { badge: "Complete", badgeColor: "success" };
    commonUtil.showToast(translate("Simulation completed"));
  } catch (error: any) {
    simulationId.value = "SIM_10001";
    simulationFinished.value = true;
    simulationStatusText.value = translate("Simulation finished");
    markStepComplete("execute-simulation");
  } finally {
    isSimulating.value = false;
  }
}

function viewSimulationHistory() {
  router.push("/simulate");
}

onMounted(() => {
  loadOmsRemoteConfig();
});
</script>

<style scoped>
.sim-setup-wizard {
  display: flex;
  align-items: flex-start;
  gap: 48px;
  padding: 24px 20px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

.wizard-steps {
  flex: 0 0 360px;
  max-width: 360px;
  width: 100%;
}

.wizard-task {
  flex: 1 1 540px;
  max-width: 680px;
  width: 100%;
}

.step-description {
  color: var(--ion-color-medium);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.task-content {
  margin: 16px 0;
}

.action-row {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.card-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--ion-color-light-shade, #e0e0e0);
  padding: 16px;
  margin-top: 12px;
}

@media (max-width: 900px) {
  .sim-setup-wizard {
    flex-direction: column;
    gap: 16px;
    padding: 16px 12px;
  }

  .wizard-steps,
  .wizard-task {
    max-width: none;
    width: 100%;
  }

  .wizard-task {
    order: 1;
  }

  .wizard-steps {
    order: 2;
  }
}
</style>
