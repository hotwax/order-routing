import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  preview: vi.fn(),
  reject: vi.fn(),
  save: vi.fn(),
  discard: vi.fn(),
  storage: {
    getThreads: vi.fn(), getMessages: vi.fn(), saveThread: vi.fn(), saveMessage: vi.fn(),
    saveDraftFeedback: vi.fn(), deleteThread: vi.fn(),
  },
  working: { manual: "unsaved name", proximity: false },
}));

vi.mock("@/services/CircuitStorageService", () => ({ CircuitStorageService: mocks.storage }));
vi.mock("@/utils/simConfig", () => ({ isFeatureEnabled: () => true }));
vi.mock("@common", () => ({ translate: (message: string) => message, commonUtil: { showToast: vi.fn() } }));
vi.mock("@/store/preferences", () => ({ usePreferencesStore: () => ({ isDevModeEnabled: false }) }));
vi.mock("@/store/orderRoutingStore", () => ({ orderRoutingStore: () => ({ currentGroup: { routingGroupId: "G1" } }) }));
vi.mock("@/store/simulationStore", () => ({ simulationStore: () => ({ routingGroupId: "G1", activeVariationId: "" }) }));
vi.mock("vue-router", () => ({ onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn() }));
vi.mock("@/components/circuit/RoutingGroupEditor.vue", () => ({ default: { name: "RoutingGroupEditor", template: "<div />" } }));
vi.mock("@/components/circuit/CircuitPromptArea.vue", () => ({ default: { name: "CircuitPromptArea", template: "<div />" } }));
vi.mock("@/components/circuit/CircuitFeedbackModal.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/simulation/VariationRail.vue", () => ({ default: { template: "<div />" } }));

vi.mock("@ionic/vue", async () => {
  const { defineComponent, h } = await import("vue");
  const passthrough = (name: string) => defineComponent({ name, setup: (_, { slots }) => () => h("div", slots.default?.()) });
  const actionable = (name: string) => defineComponent({
    name, props: { disabled: Boolean }, emits: ["click"],
    setup: (props, { emit, slots }) => () => h("button", { disabled: props.disabled, onClick: (event: MouseEvent) => emit("click", event) }, slots.default?.()),
  });
  return {
    alertController: { create: vi.fn() },
    ...Object.fromEntries(["IonBackButton", "IonButtons", "IonContent", "IonHeader", "IonIcon", "IonLabel", "IonList", "IonListHeader", "IonNote", "IonPage", "IonSegment", "IonSegmentButton", "IonSpinner", "IonText", "IonTitle", "IonToolbar"].map(name => [name, passthrough(name)])),
    IonButton: actionable("IonButton"), IonItem: actionable("IonItem"),
    IonModal: defineComponent({ name: "IonModal", props: { isOpen: Boolean }, setup: (props, { slots }) => () => props.isOpen ? h("div", { class: "thread-modal" }, slots.default?.()) : null }),
  };
});

import RoutingDetailCanvas from "../src/components/circuit/RoutingDetailCanvas.vue";
import { useCircuitStore } from "../src/store/circuit";

enableAutoUnmount(afterEach);

const Prompt = defineComponent({
  name: "CircuitPromptArea", props: { modelValue: String, disabled: Boolean }, emits: ["update:modelValue", "send"],
  setup: (props, { emit, expose }) => {
    expose({ focus: vi.fn() });
    return () => h("div", [
      h("textarea", { value: props.modelValue, disabled: props.disabled, onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLTextAreaElement).value) }),
      h("button", { "data-send": "", disabled: props.disabled, onClick: () => emit("send") }, "Send"),
    ]);
  },
});
const Editor = defineComponent({
  name: "RoutingGroupEditor",
  setup: (_, { expose }) => {
    let snapshot: typeof mocks.working | null = null;
    mocks.preview.mockImplementation(async () => {
      snapshot ||= { ...mocks.working };
      mocks.working.proximity = true;
    });
    mocks.reject.mockImplementation(() => {
      if (snapshot) mocks.working = { ...snapshot };
      snapshot = null;
    });
    expose({
      prepareDraftProposal: mocks.prepare, previewDraftProposal: mocks.preview, rejectDraftProposal: mocks.reject,
      save: mocks.save, discardChanges: mocks.discard, activateForVisibleGroup: vi.fn(), deactivateWorkingFlushHook: vi.fn(),
    });
    return () => h("div");
  },
});

function proposalResult() {
  return {
    intent: "edit", message: "Proposed proximity sort",
    proposal: {
      id: "P1", sourcePrompt: "prioritize nearby stores", createdAt: 1, summary: "Proximity", providerSummary: "Proximity", unansweredQuestions: [],
      operations: [{ op: "set", target: "selectedRule.inventorySorts.PROXIMITY", value: true, ruleKey: "R1" }],
    },
  };
}

async function canvas() {
  const store = useCircuitStore();
  store.currentThreadId = "T1";
  store.activeContext = { routingGroupId: "G1" };
  const wrapper = mount(RoutingDetailCanvas, {
    props: { routingGroupId: "G1", simulationEnabled: false },
    global: { stubs: { RoutingGroupEditor: Editor, CircuitPromptArea: Prompt, RoutingConfigSectionCard: true } },
  });
  await flushPromises();
  return { wrapper, store };
}
async function send(wrapper: ReturnType<typeof mount>, prompt: string) {
  await wrapper.get("textarea").setValue(prompt);
  await wrapper.get("[data-send]").trigger("click");
  await flushPromises();
}
async function reject(wrapper: ReturnType<typeof mount>) {
  await send(wrapper, "prioritize nearby stores");
  const button = wrapper.findAll("button").find(button => button.text() === "Reject all");
  expect(button).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}
async function selectThread(wrapper: ReturnType<typeof mount>, name: string) {
  await wrapper.get('[aria-label="Threads"]').trigger("click");
  const thread = wrapper.findAll(".thread-modal button").find(button => button.text().includes(name));
  expect(thread).toBeDefined();
  await thread!.trigger("click");
  await flushPromises();
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mocks.working = { manual: "unsaved name", proximity: false };
  mocks.prepare.mockResolvedValue(proposalResult());
  mocks.storage.getThreads.mockResolvedValue([
    { id: "T1", name: "Original conversation", createdAt: 1 },
    { id: "T2", name: "Other conversation", createdAt: 2 },
  ]);
  mocks.storage.getMessages.mockImplementation(async () => []);
});

describe("Circuit conversation boundaries", () => {
  it("starts a plain request after rejection then New chat, without old feedback or prompt text", async () => {
    const { wrapper, store } = await canvas();
    await reject(wrapper);
    await wrapper.get("textarea").setValue("Unsent old feedback");
    await wrapper.get('[aria-label="New chat"]').trigger("click");
    await flushPromises();
    expect(store.currentThreadId).toBeNull();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe("");
    await send(wrapper, "prioritize nearby stores");
    expect(mocks.prepare.mock.lastCall?.[0]).toBe("prioritize nearby stores");
    expect(mocks.prepare.mock.lastCall?.[1]).toEqual([{ role: "user", content: "prioritize nearby stores" }]);
    expect(mocks.storage.saveDraftFeedback).not.toHaveBeenCalled();
  });

  it("does not carry rejection feedback into a different existing conversation", async () => {
    const { wrapper, store } = await canvas();
    await reject(wrapper);
    await selectThread(wrapper, "Other conversation");
    expect(store.currentThreadId).toBe("T2");
    await send(wrapper, "sort by inventory");
    expect(mocks.prepare.mock.lastCall?.[0]).toBe("sort by inventory");
    expect(mocks.storage.saveDraftFeedback).not.toHaveBeenCalled();
  });

  it("keeps same-conversation rejection feedback when reselecting the current thread", async () => {
    const { wrapper } = await canvas();
    await reject(wrapper);
    await selectThread(wrapper, "Original conversation");
    await send(wrapper, "only change the sort");
    expect(mocks.prepare.mock.lastCall?.[0]).toContain("only change the sort");
    expect(mocks.prepare.mock.lastCall?.[0]).toContain("prioritize nearby stores");
    expect(mocks.storage.saveDraftFeedback).toHaveBeenCalledWith(expect.objectContaining({ type: "rejected", threadId: "T1" }));
  });

  it.each(["new", "existing"])("rolls back a pending preview on %s conversation while retaining manual edits", async (destination) => {
    const { wrapper } = await canvas();
    await send(wrapper, "prioritize nearby stores");
    expect(mocks.working.proximity).toBe(true);
    if (destination === "new") await wrapper.get('[aria-label="New chat"]').trigger("click");
    else await selectThread(wrapper, "Other conversation");
    await flushPromises();
    expect(mocks.working).toEqual({ manual: "unsaved name", proximity: false });
    expect(wrapper.find(".proposal-review").exists()).toBe(false);
    expect(mocks.reject).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.discard).not.toHaveBeenCalled();
  });

  it("blocks new/existing thread switches while the assistant request is in flight", async () => {
    const { wrapper, store } = await canvas();
    await wrapper.get('[aria-label="Threads"]').trigger("click");
    const otherThread = wrapper.findAllComponents({ name: "IonItem" }).find(item => item.text().includes("Other conversation"))!;
    let resolve!: (value: ReturnType<typeof proposalResult>) => void;
    mocks.prepare.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await send(wrapper, "prioritize nearby stores");
    expect(wrapper.get('[aria-label="New chat"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[aria-label="Threads"]').attributes("disabled")).toBeDefined();
    expect(otherThread.props("disabled")).toBe(true);
    // Events can still arrive programmatically; handlers must protect the active request too.
    wrapper.findAllComponents({ name: "IonButton" }).find(button => button.attributes("aria-label") === "New chat")!.vm.$emit("click");
    otherThread.vm.$emit("click");
    await flushPromises();
    expect(store.currentThreadId).toBe("T1");
    expect(mocks.reject).not.toHaveBeenCalled();
    resolve(proposalResult());
    await flushPromises();
    expect(wrapper.find(".proposal-review").exists()).toBe(true);
  });

  it("clears feedback when deleting the current conversation", async () => {
    const { wrapper, store } = await canvas();
    await reject(wrapper);
    await wrapper.get('[aria-label="Threads"]').trigger("click");
    const currentThread = wrapper.findAllComponents({ name: "IonItem" }).find(item => item.text().includes("Original conversation"))!;
    await currentThread.findComponent({ name: "IonButton" }).trigger("click");
    await flushPromises();
    expect(store.currentThreadId).toBeNull();
    expect(mocks.storage.deleteThread).toHaveBeenCalledWith("T1");
    await send(wrapper, "sort by inventory");
    expect(mocks.prepare.mock.lastCall?.[0]).toBe("sort by inventory");
    expect(mocks.storage.saveDraftFeedback).not.toHaveBeenCalled();
  });

  it("clears rejection feedback when an Ionic cached page leaves and returns", async () => {
    const { wrapper } = await canvas();
    await (wrapper.vm as any).activateForVisiblePage();
    await reject(wrapper);
    (wrapper.vm as any).deactivateForHiddenPage();
    await (wrapper.vm as any).activateForVisiblePage();
    await send(wrapper, "sort by inventory");
    expect(mocks.prepare.mock.lastCall?.[0]).toBe("sort by inventory");
    expect(mocks.storage.saveDraftFeedback).not.toHaveBeenCalled();
  });
});
