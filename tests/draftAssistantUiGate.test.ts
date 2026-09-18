import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assistantEnabled: false,
  fetchRoutingEditorEnums: vi.fn(),
  fetchGroupDetails: vi.fn(),
  loadAllThreads: vi.fn(),
  switchThread: vi.fn(),
  messages: [] as any[],
  threads: [] as any[],
  requestRouteDraft: vi.fn(),
  requestListInquiry: vi.fn(),
}));

vi.mock("@/utils/simConfig", () => ({
  isFeatureEnabled: vi.fn((flag: string) => flag === "draftAssistant" && mocks.assistantEnabled),
}));

vi.mock("@common", () => ({
  commonUtil: {
    getRelativeTime: (value: unknown) => String(value ?? ""),
    showToast: vi.fn(),
  },
  emitter: { on: vi.fn(), off: vi.fn() },
  logger: { error: vi.fn() },
  translate: (message: string) => message,
}));

vi.mock("@ionic/vue", () => {
  const passthrough = (name: string) => ({ name, template: "<div><slot /></div>" });
  return {
    alertController: { create: vi.fn() },
    popoverController: { create: vi.fn() },
    onIonViewDidEnter: vi.fn(),
    onIonViewWillEnter: vi.fn(),
    onIonViewWillLeave: vi.fn(),
    IonBackButton: passthrough("IonBackButton"),
    IonBadge: passthrough("IonBadge"),
    IonButton: {
      name: "IonButton",
      props: { disabled: Boolean },
      emits: ["click"],
      template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    },
    IonButtons: passthrough("IonButtons"),
    IonCard: passthrough("IonCard"),
    IonCardContent: passthrough("IonCardContent"),
    IonCardHeader: passthrough("IonCardHeader"),
    IonCardTitle: passthrough("IonCardTitle"),
    IonContent: passthrough("IonContent"),
    IonHeader: passthrough("IonHeader"),
    IonIcon: { name: "IonIcon", template: "<span />" },
    IonItem: passthrough("IonItem"),
    IonItemDivider: passthrough("IonItemDivider"),
    IonLabel: passthrough("IonLabel"),
    IonList: passthrough("IonList"),
    IonListHeader: passthrough("IonListHeader"),
    IonMenuButton: passthrough("IonMenuButton"),
    IonModal: {
      name: "IonModal",
      props: { isOpen: Boolean },
      emits: ["didDismiss"],
      template: '<div class="ion-modal" :data-open="String(isOpen)"><slot /></div>',
    },
    IonNote: passthrough("IonNote"),
    IonPage: passthrough("IonPage"),
    IonSearchbar: passthrough("IonSearchbar"),
    IonSegment: passthrough("IonSegment"),
    IonSegmentButton: passthrough("IonSegmentButton"),
    IonSkeletonText: passthrough("IonSkeletonText"),
    IonSpinner: passthrough("IonSpinner"),
    IonTextarea: {
      name: "IonTextarea",
      props: { modelValue: String, disabled: Boolean },
      emits: ["update:modelValue", "keydown"],
      template: '<textarea class="ion-textarea" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    IonText: passthrough("IonText"),
    IonTitle: passthrough("IonTitle"),
    IonToolbar: passthrough("IonToolbar"),
  };
});

vi.mock("vue-router", () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}));

vi.mock("@/router", () => ({ default: {} }));

vi.mock("ionicons/icons", () => ({
  addOutline: "add",
  addCircleOutline: "add-circle",
  archiveOutline: "archive",
  arrowUndoOutline: "undo",
  bookmarkOutline: "bookmark",
  bulbOutline: "bulb",
  chatboxEllipsesOutline: "chat",
  chatbubblesOutline: "threads",
  checkmarkCircleOutline: "accept",
  closeOutline: "close",
  closeCircleOutline: "reject",
  copyOutline: "copy",
  ellipsisVerticalOutline: "more",
  filterOutline: "filter",
  flashOutline: "flash",
  gitNetworkOutline: "routing",
  golfOutline: "golf",
  listOutline: "list",
  optionsOutline: "options",
  pencilOutline: "pencil",
  playForwardOutline: "play-forward",
  pulseOutline: "pulse",
  reorderTwoOutline: "reorder",
  refreshOutline: "refresh",
  saveOutline: "save",
  sendOutline: "send",
  sparklesOutline: "sparkles",
  speedometerOutline: "speedometer",
  swapVerticalOutline: "swap",
  terminalOutline: "terminal",
  timeOutline: "time",
  timerOutline: "timer",
  trashOutline: "trash",
}));

vi.mock("pinia", async (importOriginal) => {
  const original = await importOriginal<typeof import("pinia")>();
  return {
    ...original,
    storeToRefs: (store: any) => store.__refs,
  };
});

vi.mock("@/store/orderRoutingStore", () => ({
  orderRoutingStore: () => ({
    currentGroup: null,
    getRoutingGroups: [],
    fetchOrderRoutingGroupsDetails: mocks.fetchGroupDetails,
  }),
}));

vi.mock("@/store/productStore", () => ({
  productStore: () => ({ getCurrentEComStore: { productStoreId: "STORE" } }),
}));

vi.mock("@/store/utilStore", () => ({
  useUtilStore: () => ({
    fetchRoutingEditorEnums: mocks.fetchRoutingEditorEnums,
    getEnums: [],
  }),
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: () => ({ getUserProfile: { timeZone: "UTC" } }),
}));

vi.mock("@/store/preferences", () => ({
  usePreferencesStore: () => ({ isDevModeEnabled: true }),
}));

vi.mock("@/store/circuit", () => ({
  useCircuitStore: () => {
    const currentThreadId = ref<string | null>(null);

    return {
      __refs: {
      messages: ref(mocks.messages),
      threads: ref(mocks.threads),
      currentThreadId,
      lastPrompt: ref(null),
      activeContext: ref(null),
      isChatStarted: ref(false),
      },
      loadAllThreads: mocks.loadAllThreads,
      addLocalMessage: vi.fn(),
      saveDraftFeedback: vi.fn(),
      setChatStarted: vi.fn(),
      switchThread: async (threadId: string | null) => {
        currentThreadId.value = threadId;
        return mocks.switchThread(threadId);
      },
      clearCurrentChatHistory: vi.fn(),
      deleteThread: vi.fn(),
    };
  },
}));

vi.mock("@/store/simulationStore", () => ({
  registerWorkingFlushHook: vi.fn(() => vi.fn()),
  simulationStore: () => ({
    routingGroupId: "",
    activeVariationId: "",
    isDirty: false,
    loadGroup: vi.fn(),
  }),
}));

vi.mock("@/store/simReferenceStore", () => ({
  useSimReferenceStore: () => ({
    getVirtualFacilities: {},
    getFacilityGroups: {},
    getShippingMethods: {},
    getSalesChannels: {},
    loadState: "idle",
    loadError: null,
    fetchReferenceData: vi.fn(),
  }),
}));

vi.mock("@/composables/useRoutingGroups", () => ({
  useRoutingGroups: () => ({
    isLoading: ref(false),
    routingGroups: ref([]),
    selectedFilter: ref("all"),
    displayedGroups: ref([]),
    isActive: vi.fn(() => false),
    getScheduleFrequency: vi.fn(() => ""),
    refreshRoutingGroups: vi.fn(),
    addRoutingGroup: vi.fn(),
    redirect: vi.fn(),
  }),
}));

vi.mock("@/composables/useRoutingAgentSnapshot", () => ({
  buildRoutingAgentSnapshot: () => ({
    facilities: [],
    shippingMethods: [],
    salesChannels: [],
    facilityGroups: [],
  }),
}));

vi.mock("@/utils/routingGroupsManifest", () => ({
  buildRoutingGroupsListManifest: () => ({ visibleEntities: { brokeringRuns: [] } }),
}));

vi.mock("@/services/DraftAssistantService", () => ({
  DraftAssistantService: {
    requestBrokeringRouteDraftOperations: mocks.requestRouteDraft,
    requestBrokeringRunsListInquiry: mocks.requestListInquiry,
  },
}));

import RoutingAssistantModal from "../src/components/RoutingAssistantModal.vue";
import RoutingDetailCanvas from "../src/components/circuit/RoutingDetailCanvas.vue";
import RoutingGroupEditor from "../src/components/circuit/RoutingGroupEditor.vue";
import OrderRoutingList from "../src/views/OrderRoutingList.vue";

describe("draft assistant production UI gate", () => {
  beforeEach(() => {
    mocks.assistantEnabled = false;
    mocks.messages = [];
    mocks.threads = [];
    vi.clearAllMocks();
    mocks.fetchRoutingEditorEnums.mockResolvedValue(undefined);
    mocks.fetchGroupDetails.mockResolvedValue(undefined);
    mocks.requestListInquiry.mockResolvedValue({ message: "Answer", questions: [] });
  });

  it("keeps the list and list assistant completely inert when disabled by default", async () => {
    const list = mount(OrderRoutingList, {
      global: {
        stubs: {
          EmptyState: true,
          GroupActionsPopover: true,
          RoutingAssistantModal: true,
        },
      },
    });

    expect(list.find('[aria-label="Open Circuit"]').exists()).toBe(false);
    expect(list.find("routing-assistant-modal-stub").exists()).toBe(false);

    const modal = mount(RoutingAssistantModal, { props: { isOpen: false } });
    await modal.setProps({ isOpen: true });
    await flushPromises();

    expect(modal.find(".ion-modal").exists()).toBe(false);
    expect(modal.emitted("close")).toHaveLength(1);
    expect(mocks.fetchRoutingEditorEnums).not.toHaveBeenCalled();
    expect(mocks.fetchGroupDetails).not.toHaveBeenCalled();
    expect(mocks.requestListInquiry).not.toHaveBeenCalled();
  });

  it("guards the editor's exposed draft action as well as its empty-state prompt", async () => {
    const editor = mount(RoutingGroupEditor, {
      props: { routingGroupId: "G1", sandbox: false },
      global: {
        stubs: {
          AddInventoryFilterOptionsModal: true,
          AddOrderRouteFilterOptions: true,
          ArchivedRoutingModal: true,
          ArchivedRuleModal: true,
          GroupHistoryModal: true,
          IonTextarea: true,
          PromiseFilterPopover: true,
          RoutingHistoryModal: true,
          ScheduleModal: true,
        },
      },
    });

    expect(editor.find(".action-prompt").exists()).toBe(false);
    const result = await (editor.vm as any).prepareDraftProposal("Change the queue");
    expect(result).toEqual({
      proposal: null,
      message: "Draft assistant is unavailable for this deployment.",
    });
    expect(mocks.requestRouteDraft).not.toHaveBeenCalled();

    mocks.assistantEnabled = true;
    const enabledEditor = mount(RoutingGroupEditor, {
      // This assertion targets the no-selection assistant prompt. A routed group now deliberately
      // starts with its structural loading skeleton until the visible-page activation fetch resolves.
      props: { routingGroupId: "", sandbox: false },
      global: {
        stubs: {
          AddInventoryFilterOptionsModal: true,
          AddOrderRouteFilterOptions: true,
          ArchivedRoutingModal: true,
          ArchivedRuleModal: true,
          GroupHistoryModal: true,
          IonTextarea: true,
          PromiseFilterPopover: true,
          RoutingHistoryModal: true,
          ScheduleModal: true,
        },
      },
    });
    expect(enabledEditor.find(".action-prompt").exists()).toBe(true);
  });

  it("shows the list entry point and permits assistant context and inquiry requests when enabled", async () => {
    mocks.assistantEnabled = true;
    const list = mount(OrderRoutingList, {
      global: {
        stubs: {
          EmptyState: true,
          GroupActionsPopover: true,
          RoutingAssistantModal: true,
        },
      },
    });

    const launch = list.get('[aria-label="Open Circuit"]');
    expect(list.find("routing-assistant-modal-stub").exists()).toBe(true);
    await launch.trigger("click");
    expect(list.get("routing-assistant-modal-stub").attributes("isopen")).toBe("true");

    const modal = mount(RoutingAssistantModal, { props: { isOpen: false } });
    expect(mocks.fetchRoutingEditorEnums).toHaveBeenCalledOnce();
    await modal.setProps({ isOpen: true });
    await flushPromises();

    expect(modal.get(".ion-modal").attributes("data-open")).toBe("true");
    expect(mocks.fetchGroupDetails).toHaveBeenCalledOnce();

    await modal.get(".ion-textarea").setValue("How does this run work?");
    await modal.get(".prompt-area button").trigger("click");
    await flushPromises();
    expect(mocks.requestListInquiry).toHaveBeenCalledOnce();
  });

  it("removes every detail-page assistant control and storage action when disabled", () => {
    const detail = mount(RoutingDetailCanvas, {
      props: { routingGroupId: "G1", simulationEnabled: false },
      global: {
        stubs: {
          CircuitFeedbackModal: true,
          CircuitPromptArea: true,
          RoutingGroupEditor: true,
          VariationRail: true,
        },
      },
    });

    expect(detail.find('[aria-label="Show chat"]').exists()).toBe(false);
    expect(detail.find('[aria-label="Hide chat"]').exists()).toBe(false);
    expect(detail.find(".chat-section").exists()).toBe(false);
    expect(detail.find("circuit-prompt-area-stub").exists()).toBe(false);
    expect(detail.find("circuit-feedback-modal-stub").exists()).toBe(false);
    expect(detail.text()).not.toContain("Threads");
    expect(mocks.loadAllThreads).not.toHaveBeenCalled();
  });

  it("restores the detail-page assistant controls and thread loading when enabled", async () => {
    mocks.assistantEnabled = true;
    mocks.messages = [{ id: "existing", role: "circuit", content: "Existing response" }];
    const detail = mount(RoutingDetailCanvas, {
      props: { routingGroupId: "G1", simulationEnabled: false },
      global: {
        stubs: {
          CircuitFeedbackModal: true,
          CircuitPromptArea: true,
          RoutingGroupEditor: true,
          VariationRail: true,
        },
      },
    });

    expect(detail.find('[aria-label="Hide chat"]').exists()).toBe(true);
    expect(detail.find(".chat-section").exists()).toBe(true);
    expect(detail.find("circuit-prompt-area-stub").exists()).toBe(true);
    expect(detail.find('[aria-label="Send feedback to improve Circuit"]').exists()).toBe(false);
    expect(detail.find("circuit-feedback-modal-stub").exists()).toBe(false);
    expect(detail.text()).toContain("Start a conversation");
    expect(detail.text()).toContain("Ask Circuit a question about this routing or describe a change you want to make.");
    expect(detail.text()).toContain("Threads");
    expect(detail.get(".chat-actions").text()).toContain("Threads");
    expect(detail.find('[aria-label="New chat"]').exists()).toBe(false);
    expect(detail.find('[aria-label="Clear chat history"]').exists()).toBe(false);
    const threadModal = detail.findAll(".ion-modal").find((modal) => modal.text().includes("Chat Threads"));
    expect(threadModal?.attributes("data-open")).toBe("false");
    await detail.get('[aria-label="Threads"]').trigger("click");
    expect(threadModal?.attributes("data-open")).toBe("true");
    expect(mocks.loadAllThreads).toHaveBeenCalledOnce();
  });

  it("shows the three newest conversations and focuses the prompt when an empty thread opens", async () => {
    mocks.assistantEnabled = true;
    mocks.threads = [
      { id: "oldest", name: "Old routing question", createdAt: 100 },
      { id: "newest", name: "Holiday routing review", createdAt: 400 },
      { id: "third", name: "Warehouse proximity", createdAt: 200 },
      { id: "second", name: "Standard order filters", createdAt: 300 },
    ];

    const detail = mount(RoutingDetailCanvas, {
      props: { routingGroupId: "G1", simulationEnabled: false },
      global: {
        stubs: {
          CircuitFeedbackModal: true,
          RoutingGroupEditor: true,
          VariationRail: true,
        },
      },
      attachTo: document.body,
    });

    const recentThreads = detail.findAll(".recent-thread-item");
    const recentThreadText = recentThreads.map((thread) => thread.text());
    expect(recentThreadText).toEqual([
      expect.stringContaining("Holiday routing review"),
      expect.stringContaining("Standard order filters"),
      expect.stringContaining("Warehouse proximity"),
    ]);
    expect(recentThreadText.join(" ")).not.toContain("Old routing question");

    await recentThreads[1].trigger("click");
    await flushPromises();
    expect(mocks.switchThread).toHaveBeenCalledWith("second");
    expect(detail.text()).not.toContain("Start a conversation");
    expect(detail.get(".chat-actions").text()).toContain("New chat");
    expect(detail.get(".chat-actions").text()).toContain("Threads");
    expect(document.activeElement).toBe(detail.get(".ion-textarea").element);

    await detail.get('[aria-label="New chat"]').trigger("click");
    await flushPromises();
    expect(mocks.switchThread).toHaveBeenLastCalledWith(null);
    expect(detail.text()).toContain("Start a conversation");
    expect(detail.find('[aria-label="New chat"]').exists()).toBe(false);
    expect(document.activeElement).toBe(detail.get(".ion-textarea").element);

    detail.unmount();
  });
});
