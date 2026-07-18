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
  gitBranchOutline: "branch",
  playOutline: "play",
  refreshOutline: "reset",
  saveOutline: "save",
  trashOutline: "trash"
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
      emits: ["update:modelValue", "ionFocus", "keyup"],
      template: '<input :value="modelValue" :disabled="disabled" @focus="$emit(\'ionFocus\')" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    },
    IonItem: passthrough("IonItem"),
    IonLabel: passthrough("IonLabel"),
    IonList: passthrough("IonList"),
    IonModal: {
      name: "IonModal",
      inheritAttrs: false,
      props: {
        isOpen: Boolean,
        breakpoints: Array,
        initialBreakpoint: Number,
        backdropBreakpoint: Number,
        backdropDismiss: Boolean,
        canDismiss: [Boolean, Function],
        handleBehavior: String
      },
      emits: ["ionBreakpointDidChange", "didDismiss"],
      template: '<div class="ion-modal" :data-open="String(isOpen)"><slot /></div>'
    },
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
    isRunningBaselineRun: false,
    isSavingVariation: false,
    variationRunResult: null,
    baselineRunResult: null,
    runCompareError: null,
    baselineRunError: null,
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
    discardVariation: vi.fn(async (id: string) => {
      sim.variations = sim.variations.filter((variation: any) => variation.id !== id);
      sim.activeVariationId = "";
      return true;
    }),
    runActiveVariation: vi.fn(async () => true),
    runBaseline: vi.fn(async () => true),
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

  it("uses a route-owned native sheet without blocking the routing canvas", async () => {
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const sheet = wrapper.findAllComponents({ name: "IonModal" })[0];

    expect(sheet.props("isOpen")).toBe(true);
    expect(sheet.props("breakpoints")).toEqual([0.08, 0.5, 0.9]);
    expect(sheet.props("initialBreakpoint")).toBe(0.08);
    expect(sheet.props("backdropBreakpoint")).toBe(1);
    expect(sheet.props("backdropDismiss")).toBe(false);
    expect(sheet.props("handleBehavior")).toBe("cycle");
    expect(sheet.props("canDismiss")()).toBe(false);

    expect(wrapper.text()).toContain("Expand");
    await wrapper.findAllComponents({ name: "IonButton" })[0].trigger("click");
    expect(wrapper.text()).toContain("Minimize");

    mocks.routeRef.value = { path: "/order-routing/G2" };
    await flushPromises();
    expect(sheet.props("isOpen")).toBe(false);
    expect(sheet.props("canDismiss")()).toBe(true);
  });

  it("presents variation creation as a named branch and expands when naming it", async () => {
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const nameInput = wrapper.find('[data-testid="variation-name"]');
    const createButton = wrapper.find('[data-testid="create-variation"]');

    expect(wrapper.text()).toContain("Simulation");
    expect(wrapper.text()).toContain("Branch from");
    expect(wrapper.text()).toContain("Baseline");
    expect(wrapper.text()).toContain("Live config");
    expect(wrapper.text()).toContain("Create a variation");
    expect(createButton.attributes("disabled")).toBeDefined();

    await nameInput.trigger("focus");
    expect(wrapper.text()).toContain("Minimize");

    await nameInput.setValue("  Faster west coast  ");
    expect(createButton.attributes("disabled")).toBeUndefined();
    await createButton.trigger("click");
    await flushPromises();

    expect(mocks.sim.saveAsVariation).toHaveBeenCalledWith("Faster west coast");
  });

  it("leads with variation creation and hides the baseline selector for first-time use", () => {
    mocks.sim.variations = [];
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const saveSectionText = wrapper.find(".save-section").text();

    expect(radioGroup(wrapper).exists()).toBe(false);
    expect(saveSectionText.indexOf("Create a variation")).toBeLessThan(saveSectionText.indexOf("Branch from"));
    expect(wrapper.findAllComponents({ name: "IonFabButton" })[0].attributes("aria-label")).toBe("Run baseline");
  });

  it("runs the selected baseline and blocks it only while live edits are unresolved", async () => {
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const runButton = wrapper.findAllComponents({ name: "IonFabButton" })[0];

    expect(runButton.attributes("aria-label")).toBe("Run baseline");
    expect(runButton.attributes("disabled")).toBeUndefined();
    await runButton.trigger("click");
    await flushPromises();
    expect(mocks.sim.runBaseline).toHaveBeenCalledOnce();

    const dirtyWrapper = mount(VariationRail, {
      props: { routingGroupId: "G1", liveDirty: true, editorDirty: true }
    });
    const dirtyRunButton = dirtyWrapper.findAllComponents({ name: "IonFabButton" })[0];
    expect(dirtyRunButton.attributes("disabled")).toBeDefined();
  });

  it("shows the selected variation as the source and only enables update for dirty work", async () => {
    mocks.sim.activeVariationId = "V1";
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const updateButton = wrapper.findAllComponents({ name: "IonButton" })
      .find((button) => button.text() === "Update");

    expect(wrapper.text()).toContain("Branch from");
    expect(wrapper.text()).toContain("First");
    expect(wrapper.text()).toContain("Saved variation");
    expect(updateButton?.attributes("disabled")).toBeDefined();

    mocks.sim.dirty = true;
    await flushPromises();
    expect(wrapper.text()).toContain("Unsaved variation changes");
    expect(updateButton?.attributes("disabled")).toBeUndefined();
  });

  it("discards the selected variation only after destructive confirmation", async () => {
    mocks.sim.activeVariationId = "V1";
    const wrapper = mount(VariationRail, { props: { routingGroupId: "G1" } });
    const discardButton = wrapper.find('[data-testid="discard-variation"]');

    await discardButton.trigger("click");
    await flushPromises();
    expect(mocks.sim.discardVariation).not.toHaveBeenCalled();

    mocks.alertRole = "destructive";
    await discardButton.trigger("click");
    await flushPromises();

    expect(mocks.sim.discardVariation).toHaveBeenCalledWith("V1");
    expect(mocks.sim.activeVariationId).toBe("");
    expect(mocks.showToast).toHaveBeenCalledWith("Variation discarded");
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
    const modals = wrapper.findAllComponents({ name: "IonModal" });
    expect(modals[0].props("isOpen")).toBe(true);
    expect(modals[1].props("isOpen")).toBe(true);

    mocks.routeRef.value = { path: "/order-routing/G2" };
    await flushPromises();

    expect(modals[0].props("isOpen")).toBe(false);
    expect(modals[1].props("isOpen")).toBe(false);
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
