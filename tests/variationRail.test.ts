import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sim: null as any,
  routeRef: null as any,
  alertRole: "cancel",
  alertCreate: vi.fn(),
  showToast: vi.fn()
}));

vi.mock("@common", () => ({
  commonUtil: { showToast: mocks.showToast },
  translate: (message: string) => message
}));

vi.mock("vue-router", async () => {
  const { ref } = await import("vue");
  mocks.routeRef = ref({ path: "/order-routing/G1" });
  return { useRouter: () => ({ currentRoute: mocks.routeRef }) };
});

vi.mock("@/store/simulationStore", () => ({
  simulationStore: () => mocks.sim
}));

vi.mock("@/components/simulation/SimulationResults.vue", () => ({
  default: { name: "SimulationResults", template: "<div />" }
}));

vi.mock("ionicons/icons", () => ({
  addCircleOutline: "add",
  barChartOutline: "chart",
  chevronDownOutline: "down",
  chevronUpOutline: "up",
  playOutline: "play",
  refreshOutline: "reset",
  saveOutline: "save"
}));

vi.mock("@ionic/vue", () => {
  const passthrough = (name: string, tag = "div") => ({
    name,
    inheritAttrs: false,
    template: `<${tag} v-bind="$attrs"><slot /></${tag}>`
  });
  return {
    alertController: { create: mocks.alertCreate },
    IonButton: passthrough("IonButton", "button"),
    IonButtons: passthrough("IonButtons"),
    IonChip: passthrough("IonChip"),
    IonContent: passthrough("IonContent"),
    IonFabButton: passthrough("IonFabButton", "button"),
    IonHeader: passthrough("IonHeader"),
    IonIcon: passthrough("IonIcon", "span"),
    IonInput: {
      name: "IonInput",
      props: { modelValue: String, disabled: Boolean },
      emits: ["update:modelValue", "keyup"],
      template: '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    IonItem: passthrough("IonItem"),
    IonLabel: passthrough("IonLabel"),
    IonModal: passthrough("IonModal"),
    IonNote: passthrough("IonNote"),
    IonRadio: passthrough("IonRadio"),
    IonRadioGroup: {
      name: "IonRadioGroup",
      props: { value: String },
      emits: ["ionChange"],
      template: "<div><slot /></div>"
    },
    IonSpinner: passthrough("IonSpinner"),
    IonTitle: passthrough("IonTitle"),
    IonToolbar: passthrough("IonToolbar")
  };
});

import VariationRail from "../src/components/simulation/VariationRail.vue";

function createSimulation() {
  const sim: any = reactive({
    routingGroupId: "G1",
    groupLoadState: "ready",
    baseline: { routingGroupId: "G1", routings: [] },
    working: { routingGroupId: "G1", routings: [] },
    variations: [
      { id: "V1", label: "First", group: { routings: [] }, serverVid: "V1" },
      { id: "V2", label: "Second", group: { routings: [] }, serverVid: "V2" }
    ],
    activeVariationId: "",
    dirty: false,
    isRunningVariationRun: false,
    isSavingVariation: false,
    variationRunResult: null,
    runCompareError: null,
    interruptedVariationRun: null,
    loadError: null,
    get isSimulationReady() { return this.groupLoadState === "ready" && !!this.baseline && !!this.working; },
    get activeVariation() { return this.variations.find((variation: any) => variation.id === this.activeVariationId) || null; },
    get isDirty() { return this.dirty; },
    flushWorkingCopy: vi.fn(),
    loadVariation: vi.fn(async (id: string) => {
      sim.activeVariationId = id;
      return true;
    }),
    resetWorkingToBaseline: vi.fn(() => {
      sim.activeVariationId = "";
      sim.dirty = false;
    }),
    saveAsVariation: vi.fn(async () => true),
    updateVariation: vi.fn(async () => true),
    runActiveVariation: vi.fn(async () => true),
    loadGroup: vi.fn(async () => true)
  });
  return sim;
}

function radioGroup(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: "IonRadioGroup" });
}

async function selectRadio(wrapper: ReturnType<typeof mount>, value: string) {
  radioGroup(wrapper).vm.$emit("ionChange", { detail: { value } });
  await flushPromises();
}

describe("VariationRail interaction safety", () => {
  beforeEach(() => {
    mocks.sim = createSimulation();
    mocks.routeRef.value = { path: "/order-routing/G1" };
    mocks.alertRole = "cancel";
    mocks.alertCreate.mockImplementation(async () => ({
      present: vi.fn(async () => undefined),
      onDidDismiss: vi.fn(async () => ({ role: mocks.alertRole }))
    }));
    vi.clearAllMocks();
  });

  it("switches between baseline and a saved variation through the store", async () => {
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });

    await selectRadio(wrapper, "V1");
    expect(mocks.sim.flushWorkingCopy).toHaveBeenCalledOnce();
    expect(mocks.sim.loadVariation).toHaveBeenCalledWith("V1");
    expect(radioGroup(wrapper).props("value")).toBe("V1");

    await selectRadio(wrapper, "");
    expect(mocks.sim.resetWorkingToBaseline).toHaveBeenCalledOnce();
    expect(radioGroup(wrapper).props("value")).toBe("");
  });

  it("reverts the selected radio when a dirty-switch prompt is cancelled", async () => {
    mocks.sim.activeVariationId = "V1";
    mocks.sim.dirty = true;
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });

    await selectRadio(wrapper, "V2");

    expect(mocks.alertCreate).toHaveBeenCalledOnce();
    expect(mocks.sim.loadVariation).not.toHaveBeenCalled();
    expect(mocks.sim.activeVariationId).toBe("V1");
    expect(radioGroup(wrapper).props("value")).toBe("V1");
  });

  it("honors editor dirty state even before the projection reaches the store", async () => {
    mocks.sim.activeVariationId = "V1";
    mocks.alertRole = "destructive";
    const wrapper = mount(VariationRail, {
      props: { routingGroupId: "G1", editorDirty: true }
    });

    await selectRadio(wrapper, "V2");

    expect(mocks.alertCreate).toHaveBeenCalledOnce();
    expect(mocks.sim.loadVariation).toHaveBeenCalledWith("V2");
  });

  it("rolls the radio back when an accepted switch cannot load its target", async () => {
    mocks.sim.activeVariationId = "V1";
    mocks.sim.dirty = true;
    mocks.alertRole = "destructive";
    mocks.sim.loadVariation.mockResolvedValueOnce(false);
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });

    await selectRadio(wrapper, "V2");

    expect(mocks.sim.activeVariationId).toBe("V1");
    expect(radioGroup(wrapper).props("value")).toBe("V1");
  });

  it("guards reset with the same dirty prompt and preserves the variation on cancel", async () => {
    mocks.sim.activeVariationId = "V1";
    const wrapper = mount(VariationRail, {
      props: { routingGroupId: "G1", editorDirty: true }
    });
    const resetButton = wrapper.findAllComponents({ name: "IonFabButton" })[2];

    await resetButton.trigger("click");
    await flushPromises();

    expect(mocks.alertCreate).toHaveBeenCalledOnce();
    expect(mocks.sim.resetWorkingToBaseline).not.toHaveBeenCalled();
    expect(mocks.sim.activeVariationId).toBe("V1");

    mocks.alertRole = "destructive";
    await resetButton.trigger("click");
    await flushPromises();
    expect(mocks.sim.resetWorkingToBaseline).toHaveBeenCalledOnce();
  });

  it.each([
    ["saving", { isSavingVariation: true, isRunningVariationRun: false }],
    ["running", { isSavingVariation: false, isRunningVariationRun: true }]
  ])("blocks variation navigation while an operation is %s", async (_label, operation) => {
    Object.assign(mocks.sim, operation);
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });

    await selectRadio(wrapper, "V1");

    expect(mocks.sim.loadVariation).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith("Wait for the current variation operation to finish.");
    expect(radioGroup(wrapper).props("value")).toBe("");
  });

  it.each([
    ["saving", { isSavingVariation: true, isRunningVariationRun: false }],
    ["running", { isSavingVariation: false, isRunningVariationRun: true }]
  ])("disables reset while an operation is %s", (_label, operation) => {
    mocks.sim.activeVariationId = "V1";
    Object.assign(mocks.sim, operation);
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const resetButton = wrapper.findAllComponents({ name: "IonFabButton" })[2];

    expect(resetButton.attributes("disabled")).toBeDefined();
  });

  it("closes teleported results state when its cached detail route becomes inactive", async () => {
    mocks.sim.variationRunResult = { routingGroupId: "V1" };
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const resultsButton = wrapper.findAllComponents({ name: "IonFabButton" })[1];
    await resultsButton.trigger("click");
    expect(wrapper.findComponent({ name: "IonModal" }).attributes("is-open")).toBe("true");

    mocks.routeRef.value = { path: "/order-routing/G2" };
    await flushPromises();

    expect(wrapper.findComponent({ name: "IonModal" }).attributes("is-open")).toBe("false");
    expect(wrapper.find("aside").isVisible()).toBe(false);
  });

  it("explains an interrupted run and safely reloads its saved variation before rerunning", async () => {
    mocks.sim.interruptedVariationRun = {
      routingGroupId: "G1",
      variationId: "V1",
      serverVariationId: "V1",
      variationLabel: "First",
      sampleCap: 500,
      startedAt: Date.now(),
      status: "interrupted"
    };
    mocks.sim.runCompareError = "The previous run outcome is unknown. It is safe to run again.";
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });

    expect(wrapper.text()).toContain("Previous run outcome unknown");
    expect(wrapper.text()).toContain("safe to run again");
    await wrapper.find('[data-testid="rerun-interrupted-variation"]').trigger("click");
    await flushPromises();

    expect(mocks.sim.loadVariation).toHaveBeenCalledWith("V1");
    expect(mocks.sim.runActiveVariation).toHaveBeenCalledOnce();
  });
});
