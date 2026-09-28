import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  checkConnection: vi.fn(),
  listDatastores: vi.fn(),
  deleteDatastore: vi.fn(),
  getDatastore: vi.fn(),
  startFill: vi.fn(),
  getFill: vi.fn(),
  openDatastore: vi.fn(),
  listGroups: vi.fn(),
  validateGroup: vi.fn(),
  submitRun: vi.fn(),
  getRun: vi.fn(),
  routerPush: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@common", () => ({
  api: (...args: any[]) => mocks.api(...args),
  commonUtil: { showToast: (...args: any[]) => mocks.showToast(...args) },
  translate: (label: string) => label,
}));

vi.mock("@/services/SimulationRemoteConfigService", () => ({
  loadSimulationRemoteConfig: (...args: any[]) => mocks.loadConfig(...args),
  saveSimulationRemoteConfig: (...args: any[]) => mocks.saveConfig(...args),
  checkSimulationRemoteConnection: (...args: any[]) => mocks.checkConnection(...args),
}));

vi.mock("@/services/SimulationSetupService", () => ({
  listSimDatastores: (...args: any[]) => mocks.listDatastores(...args),
  deleteSimDatastore: (...args: any[]) => mocks.deleteDatastore(...args),
  getSimDatastore: (...args: any[]) => mocks.getDatastore(...args),
  openSimDatastore: (...args: any[]) => mocks.openDatastore(...args),
  listSimRoutingGroups: (...args: any[]) => mocks.listGroups(...args),
  validateSimRoutingGroup: (...args: any[]) => mocks.validateGroup(...args),
  submitSimRun: (...args: any[]) => mocks.submitRun(...args),
  getSimRun: (...args: any[]) => mocks.getRun(...args),
  createSimDatastore: vi.fn(),
  startSimFill: (...args: any[]) => mocks.startFill(...args),
  getSimFill: (...args: any[]) => mocks.getFill(...args),
  cloneSimVariation: vi.fn(),
  simulationSetupError: (error: any) => error?.message || "Request failed",
}));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("ionicons/icons", () => ({ arrowBackOutline: "back", arrowForwardOutline: "forward", checkmarkCircle: "done" }));
vi.mock("@/components/simulation/SimulationWizardStepList.vue", () => ({
  default: defineComponent({ name: "SimulationWizardStepList", template: "<div />" }),
}));

vi.mock("@ionic/vue", () => {
  const component = (name: string, tag = "div") => defineComponent({
    name,
    inheritAttrs: false,
    props: { disabled: Boolean },
    template: `<${tag} v-bind="$attrs" :disabled="disabled"><slot /></${tag}>`,
  });
  const IonAccordion = defineComponent({
    name: "IonAccordion",
    props: { value: String },
    setup(props, { slots }) {
      const open = ref(false);

      return () => {
        const children = slots.default?.() || [];

        return h("section", { "data-accordion": props.value }, [
          h("div", { class: "accordion-header", onClick: () => { open.value = !open.value; } },
            children.filter(child => child.props?.slot === "header")),
          open.value ? h("div", children.filter(child => child.props?.slot === "content")) : null,
        ]);
      };
    },
  });
  const IonInput = defineComponent({
    name: "IonInput",
    inheritAttrs: false,
    props: {
      modelValue: { type: String, default: "" },
      label: { type: String, default: "" },
      type: { type: String, default: "text" },
      placeholder: { type: String, default: "" },
    },
    emits: ["update:modelValue"],
    methods: {
      onInput(event: Event) {
        this.$emit("update:modelValue", (event.target as HTMLInputElement).value);
      },
    },
    template: "<label><span>{{ label }}</span><input :type=\"type\" :value=\"modelValue\" :placeholder=\"placeholder\" @input=\"onInput\" /></label>",
  });
  const IonSelect = defineComponent({
    name: "IonSelect",
    props: { value: String, label: String, placeholder: String, disabled: Boolean },
    emits: ["ionChange"],
    methods: {
      onChange(event: Event) {
        this.$emit("ionChange", { detail: { value: (event.target as HTMLSelectElement).value } });
      },
    },
    template: "<label><span>{{ label }}</span><select :value=\"value\" :disabled=\"disabled\" @change=\"onChange\"><option value=\"\" disabled>{{ placeholder }}</option><slot /></select></label>",
  });
  const IonSelectOption = defineComponent({
    name: "IonSelectOption",
    props: { value: String },
    template: "<option :value=\"value\"><slot /></option>",
  });

  return {
    IonAccordion,
    IonAccordionGroup: component("IonAccordionGroup"),
    IonAlert: defineComponent({ name: "IonAlert", props: { isOpen: Boolean, buttons: Array }, template: "<div />" }),
    IonBackButton: component("IonBackButton", "button"),
    IonBadge: component("IonBadge", "span"),
    IonButton: component("IonButton", "button"),
    IonCard: component("IonCard", "article"),
    IonCardContent: component("IonCardContent"),
    IonCardHeader: component("IonCardHeader", "header"),
    IonCardSubtitle: component("IonCardSubtitle", "p"),
    IonCardTitle: component("IonCardTitle", "h2"),
    IonCheckbox: component("IonCheckbox"),
    IonContent: component("IonContent", "main"),
    IonHeader: component("IonHeader", "header"),
    IonIcon: component("IonIcon", "span"),
    IonInput,
    IonItem: component("IonItem"),
    IonLabel: component("IonLabel", "span"),
    IonList: component("IonList"),
    IonListHeader: component("IonListHeader", "header"),
    IonNote: component("IonNote", "span"),
    IonPage: component("IonPage", "section"),
    IonProgressBar: component("IonProgressBar"),
    IonSelect,
    IonSelectOption,
    IonSpinner: component("IonSpinner", "span"),
    IonTitle: component("IonTitle", "h1"),
    IonToolbar: component("IonToolbar"),
  };
});

import SimulationSetupWizard from "../src/views/SimulationSetupWizard.vue";

describe("Simulation setup remote authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.mockResolvedValue({ data: null });
    mocks.loadConfig.mockResolvedValue(null);
    mocks.saveConfig.mockResolvedValue({ data: {} });
    mocks.checkConnection.mockResolvedValue(1);
    mocks.listDatastores.mockResolvedValue([]);
    mocks.deleteDatastore.mockResolvedValue(undefined);
    sessionStorage.clear();
  });

  it("only marks the connection complete after the real Main OMS check succeeds", async () => {
    mocks.loadConfig.mockResolvedValue({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    mocks.checkConnection.mockRejectedValueOnce(new Error("Sim OMS unavailable"));
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();

    const testButton = () => wrapper.findAllComponents({ name: "IonButton" })
      .find(button => button.text().includes("Test connection"))!;
    await testButton().trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Sim OMS unavailable");
    expect(wrapper.findAllComponents({ name: "IonButton" }).find(button => button.text().includes("Next step"))!.props("disabled")).toBe(true);

    await testButton().trigger("click");
    await flushPromises();
    expect(mocks.checkConnection).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Connected through Main OMS. 1 datastores found.");
    expect(wrapper.findAllComponents({ name: "IonButton" }).find(button => button.text().includes("Next step"))!.props("disabled")).toBe(false);
  });

  it("confirms permanent deletion and clears the selected datastore", async () => {
    mocks.loadConfig.mockResolvedValue({ systemMessageRemoteId: "SIM_ROUTING_CONFIG", sendUrl: "http://localhost:8082/rest/s1", username: "simulation.service" });
    const datastore = { simDatastoreId: "SIM103", datastoreName: "m4sim_sim103", statusId: "SIMDS_CREATED" };
    mocks.listDatastores.mockResolvedValueOnce([datastore]).mockResolvedValueOnce([{ ...datastore, statusId: "SIMDS_REMOVED" }]);
    mocks.getDatastore.mockResolvedValue(datastore);
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();
    const click = async (label: string) => {
      await wrapper.findAllComponents({ name: "IonButton" }).find(button => button.text().includes(label))!.trigger("click");
      await flushPromises();
    };
    await click("Test connection");
    await click("Next step");
    await wrapper.find("select").setValue("SIM103");
    await flushPromises();

    await click("Delete selected datastore");
    const alert = wrapper.findComponent({ name: "IonAlert" });
    expect(alert.props("isOpen")).toBe(true);
    expect(mocks.deleteDatastore).not.toHaveBeenCalled();
    const confirm = (alert.props("buttons") as Array<{ role: string; handler?: () => void }>).find(button => button.role === "destructive")!;
    confirm.handler!();
    await flushPromises();
    expect(mocks.deleteDatastore).toHaveBeenCalledWith("SIM103");
    expect(wrapper.text()).not.toContain("m4sim_sim103");
  });

  it("opens a selected Created datastore before submitting its fill", async () => {
    mocks.loadConfig.mockResolvedValue({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    const datastore = { simDatastoreId: "SIM103", datastoreName: "m4sim_sim103", statusId: "SIMDS_CREATED" };
    mocks.listDatastores.mockResolvedValue([datastore]);
    mocks.getDatastore.mockResolvedValue(datastore);
    mocks.openDatastore.mockResolvedValue(datastore.datastoreName);
    mocks.startFill.mockResolvedValue({ fillId: "FILL3", taskCount: 1 });
    mocks.getFill.mockResolvedValue({ fillId: "FILL3", statusId: "SIMDSF_FAILED", taskCounts: {}, tasks: [] });
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();
    const button = (label: string) => wrapper.findAllComponents({ name: "IonButton" })
      .find(item => item.text().includes(label))!;
    const click = async (label: string) => {
      await button(label).trigger("click");
      await flushPromises();
    };

    await click("Test connection");
    await click("Next step");
    await wrapper.find("select").setValue("SIM103");
    await flushPromises();
    expect(mocks.openDatastore).not.toHaveBeenCalled();

    await click("Next step");
    expect(wrapper.findComponent({ name: "IonCardTitle" }).text()).toBe("Open datastore");
    expect(button("Next step").props("disabled")).toBe(true);
    await click("Open datastore");
    expect(mocks.openDatastore).toHaveBeenCalledWith("SIM103");
    await click("Next step");
    expect(wrapper.findComponent({ name: "IonCardTitle" }).text()).toBe("Copy source data");
    await click("Start data copy");
    expect(mocks.openDatastore).toHaveBeenCalledTimes(2);
    expect(mocks.startFill).toHaveBeenCalledWith("SIM103");
    expect(mocks.openDatastore.mock.invocationCallOrder[1]).toBeLessThan(mocks.startFill.mock.invocationCallOrder[0]);
  });

  it("runs a Ready datastore and real validated baseline without a fabricated variation", async () => {
    mocks.loadConfig.mockResolvedValue({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    const datastore = { simDatastoreId: "SIM100", datastoreName: "m4sim_sim100", displayName: "Local snapshot", statusId: "SIMDS_READY" };
    mocks.listDatastores.mockResolvedValue([datastore]);
    mocks.getDatastore.mockResolvedValue(datastore);
    mocks.openDatastore.mockResolvedValue(datastore.datastoreName);
    mocks.listGroups.mockResolvedValue({ groups: [{ routingGroupId: "GROUP1", groupName: "Morning orders" }], totalCount: 1 });
    mocks.validateGroup.mockResolvedValue({ verdict: "VALID", validCount: 3 });
    mocks.submitRun.mockResolvedValue({ simulationId: "RUN1" });
    mocks.getRun.mockResolvedValue({ simulation: { simulationId: "RUN1", statusId: "BRSIM_COMPLETE", attemptedItemCount: 10, brokeredItemCount: 8, queuedItemCount: 2 }, variants: [] });
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();
    const click = async (label: string) => {
      const button = wrapper.findAllComponents({ name: "IonButton" }).find(item => item.text().includes(label));
      expect(button, `button ${label}`).toBeDefined();
      await button!.trigger("click");
      await flushPromises();
    };

    await click("Test connection");
    await click("Next step");
    await wrapper.find("select").setValue("SIM100");
    await flushPromises();
    await click("Next step"); // Open before either filling or simulating.
    await click("Open datastore");
    expect(mocks.openDatastore).toHaveBeenCalledWith("SIM100");
    await click("Next step"); // Ready copy skips a new fill.
    await click("Next step"); // Readiness confirmed by datastore state.
    await click("Next step");
    await wrapper.find("select").setValue("GROUP1");
    await click("Validate selected group");
    await click("Next step");
    await click("Next step"); // Variation is optional.
    await click("Launch simulation");

    expect(mocks.submitRun).toHaveBeenCalledWith(["GROUP1"]);
    expect(mocks.getRun).toHaveBeenCalledWith("RUN1");
    expect(wrapper.text()).toContain("BRSIM_COMPLETE");
    expect(wrapper.text()).toContain("Brokered: 8");
    await click("View routing group");
    expect(mocks.routerPush).toHaveBeenCalledWith("/order-routing/GROUP1");
  });

  it("does not advance when the real fill run fails", async () => {
    mocks.loadConfig.mockResolvedValue({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    const datastore = { simDatastoreId: "SIM101", datastoreName: "m4sim_sim101", statusId: "SIMDS_CREATED" };
    mocks.listDatastores.mockResolvedValue([datastore]);
    mocks.getDatastore.mockResolvedValue(datastore);
    mocks.openDatastore.mockResolvedValue(datastore.datastoreName);
    mocks.startFill.mockResolvedValue({ fillId: "FILL1", taskCount: 31 });
    mocks.getFill.mockResolvedValue({
      fillId: "FILL1", statusId: "SIMDSF_FAILED",
      taskCounts: { SIMDSFS_COMPLETE: 1, SIMDSFS_FAILED: 1, SIMDSFS_PENDING: 1 },
      tasks: [
        { taskId: "TASK1", name: "Facilities", stepNum: 1, statusId: "SIMDSFS_COMPLETE", rowsWritten: 6 },
        { taskId: "TASK2", name: "Products", stepNum: 2, statusId: "SIMDSFS_FAILED", jobRunId: "JOB2", errorText: "Duplicate product reference" },
        { taskId: "TASK3", name: "Product associations", stepNum: 3, statusId: "SIMDSFS_PENDING" },
      ],
    });
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();
    const click = async (label: string) => {
      await wrapper.findAllComponents({ name: "IonButton" }).find(item => item.text().includes(label))!.trigger("click");
      await flushPromises();
    };

    await click("Test connection");
    await click("Next step");
    await wrapper.find("select").setValue("SIM101");
    await flushPromises();
    await click("Next step");
    await click("Open datastore");
    await click("Next step");
    await click("Start data copy");
    expect(mocks.getFill).toHaveBeenCalledWith("SIM101", "FILL1");
    const taskItem = (name: string) => wrapper.findAllComponents({ name: "IonItem" })
      .find(item => item.text().includes(name));
    const accordion = (value: string) => wrapper.findAllComponents({ name: "IonAccordion" })
      .find(item => item.attributes("data-accordion") === value)!;
    expect(taskItem("Products")!.findComponent({ name: "IonBadge" }).attributes()).toMatchObject({ slot: "end", color: "danger" });
    expect(taskItem("Products")!.text()).toContain("Duplicate product reference");
    expect(accordion("complete").find(".accordion-header").text()).toContain("1");
    expect(accordion("pending").find(".accordion-header").text()).toContain("1");
    expect(taskItem("Facilities")).toBeUndefined();
    expect(taskItem("Product associations")).toBeUndefined();
    await accordion("complete").find(".accordion-header").trigger("click");
    expect(taskItem("Facilities")!.findComponent({ name: "IonIcon" }).attributes()).toMatchObject({ slot: "end", icon: "done" });
    await accordion("pending").find(".accordion-header").trigger("click");
    expect(taskItem("Product associations")!.findComponent({ name: "IonBadge" }).attributes()).toMatchObject({ slot: "end", color: "medium" });
    expect(wrapper.text()).toContain("Data copy stopped. Review the failed task below.");
    expect(wrapper.findAllComponents({ name: "IonButton" }).find(button => button.text().includes("Next step"))!.props("disabled")).toBe(true);
  });

  it("shows a running task with an end-slot spinner when resuming a fill", async () => {
    mocks.loadConfig.mockResolvedValue({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    const datastore = { simDatastoreId: "SIM102", datastoreName: "m4sim_sim102", statusId: "SIMDS_CREATED" };
    mocks.listDatastores.mockResolvedValue([datastore]);
    mocks.getDatastore.mockResolvedValue(datastore);
    mocks.openDatastore.mockResolvedValue(datastore.datastoreName);
    mocks.getFill.mockResolvedValue({
      fillId: "FILL2", statusId: "SIMDSF_RUNNING",
      taskCounts: { SIMDSFS_RUNNING: 1, SIMDSFS_PENDING: 1 },
      tasks: [
        { taskId: "TASK4", name: "Inventory", stepNum: 4, statusId: "SIMDSFS_RUNNING" },
        { taskId: "TASK5", name: "Routing rules", stepNum: 5, statusId: "SIMDSFS_PENDING" },
      ],
    });
    sessionStorage.setItem("simulation-setup-run", JSON.stringify({ datastoreId: "SIM102", fillId: "FILL2" }));
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();

    await wrapper.findAllComponents({ name: "IonButton" }).find(button => button.text().includes("Test connection"))!.trigger("click");
    await flushPromises();
    const nextButton = () => wrapper.findAllComponents({ name: "IonButton" })
      .find(button => button.text().includes("Next step"))!;
    await nextButton().trigger("click");
    await flushPromises();
    await nextButton().trigger("click");
    await flushPromises();
    await wrapper.findAllComponents({ name: "IonButton" }).find(button => button.text().includes("Open datastore"))!.trigger("click");
    await flushPromises();
    await nextButton().trigger("click");
    await flushPromises();

    const runningTask = wrapper.findAllComponents({ name: "IonItem" }).find(item => item.text().includes("Inventory"))!;
    expect(runningTask.findComponent({ name: "IonSpinner" }).attributes("slot")).toBe("end");
    expect(runningTask.findComponent({ name: "IonBadge" }).exists()).toBe(false);
    expect(wrapper.findAllComponents({ name: "IonAccordion" }).map(item => item.attributes("data-accordion"))).toEqual(["pending"]);
  });

  it("collects username and password without exposing the removed API-key generator", async () => {
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();

    const inputLabels = wrapper.findAllComponents({ name: "IonInput" }).map((input) => input.props("label"));
    expect(inputLabels).toContain("Sim Routing Username");
    expect(inputLabels).toContain("Sim Routing Password");
    expect(inputLabels).not.toContain("Sim Routing User API Key");
    expect(wrapper.text()).toContain("Save in OMS");
    expect(wrapper.text()).not.toContain("Generate API Key in Sim Routing");
  });

  it("loads an existing remote and saves replacement credentials through the config service", async () => {
    mocks.loadConfig.mockResolvedValue({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    const wrapper = mount(SimulationSetupWizard);
    await flushPromises();

    expect(wrapper.text()).toContain("Configured");
    const passwordInput = wrapper.findAllComponents({ name: "IonInput" })
      .find((input) => input.props("label") === "Sim Routing Password");
    await passwordInput!.find("input").setValue("replacement-password");
    const saveButton = wrapper.findAllComponents({ name: "IonButton" })
      .find((button) => button.text().includes("Save in OMS"));
    await saveButton!.trigger("click");
    await flushPromises();

    expect(mocks.saveConfig).toHaveBeenCalledWith({
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
      password: "replacement-password",
    }, true);
  });
});
