import { flushPromises, shallowMount } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestDraft: vi.fn(),
  setLastPrompt: vi.fn(),
  fetchReferences: vi.fn(),
  registerFlushHook: vi.fn(() => vi.fn()),
  sim: null as any,
  live: null as any,
}));

vi.mock("@/utils/simConfig", () => ({
  isFeatureEnabled: vi.fn((flag: string) => flag === "draftAssistant"),
}));

vi.mock("@common", () => ({
  client: vi.fn(),
  translate: (message: string) => message,
  emitter: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  commonUtil: {
    getDateAndTime: (value: unknown) => String(value ?? ""),
    getDateAndTimeShort: (value: unknown) => String(value ?? ""),
    getRelativeTime: (value: unknown) => String(value ?? ""),
    showToast: vi.fn(),
    sortSequence: (values: any[]) => [...values].sort((a, b) => Number(a.sequenceNum || 0) - Number(b.sequenceNum || 0)),
  },
}));

vi.mock("@ionic/vue", () => {
  const passthrough = (name: string) => ({ name, template: "<div><slot /></div>" });
  return {
    alertController: { create: vi.fn() },
    modalController: { create: vi.fn() },
    popoverController: { create: vi.fn() },
    IonBadge: passthrough("IonBadge"),
    IonButton: passthrough("IonButton"),
    IonCard: passthrough("IonCard"),
    IonCardContent: passthrough("IonCardContent"),
    IonCardHeader: passthrough("IonCardHeader"),
    IonCardSubtitle: passthrough("IonCardSubtitle"),
    IonCardTitle: passthrough("IonCardTitle"),
    IonChip: passthrough("IonChip"),
    IonFab: passthrough("IonFab"),
    IonFabButton: passthrough("IonFabButton"),
    IonIcon: passthrough("IonIcon"),
    IonInput: passthrough("IonInput"),
    IonItem: passthrough("IonItem"),
    IonItemDivider: passthrough("IonItemDivider"),
    IonItemGroup: passthrough("IonItemGroup"),
    IonLabel: passthrough("IonLabel"),
    IonList: passthrough("IonList"),
    IonListHeader: passthrough("IonListHeader"),
    IonNote: passthrough("IonNote"),
    IonReorder: passthrough("IonReorder"),
    IonReorderGroup: passthrough("IonReorderGroup"),
    IonRippleEffect: passthrough("IonRippleEffect"),
    IonSelect: passthrough("IonSelect"),
    IonSelectOption: passthrough("IonSelectOption"),
    IonSpinner: passthrough("IonSpinner"),
    IonTextarea: passthrough("IonTextarea"),
    IonToggle: passthrough("IonToggle"),
  };
});

vi.mock("ionicons/icons", () => ({
  addCircleOutline: "add-circle",
  addOutline: "add",
  archiveOutline: "archive",
  bookmarkOutline: "bookmark",
  closeCircleOutline: "close",
  copyOutline: "copy",
  filterOutline: "filter",
  flashOutline: "flash",
  gitNetworkOutline: "routing",
  golfOutline: "golf",
  listOutline: "list",
  optionsOutline: "options",
  pencilOutline: "pencil",
  playForwardOutline: "play",
  pulseOutline: "pulse",
  reorderTwoOutline: "reorder",
  saveOutline: "save",
  speedometerOutline: "speedometer",
  sparklesOutline: "sparkles",
  swapVerticalOutline: "swap",
  timeOutline: "time",
  timerOutline: "timer",
}));

vi.mock("@/router", () => ({ default: { push: vi.fn(), replace: vi.fn() } }));

vi.mock("@/store/orderRoutingStore", () => ({
  orderRoutingStore: () => mocks.live,
}));

vi.mock("@/store/simulationStore", () => ({
  simulationStore: () => mocks.sim,
  registerWorkingFlushHook: mocks.registerFlushHook,
}));

vi.mock("@/store/productStore", () => ({
  productStore: () => ({
    getVirtualFacilities: {},
    getFacilityGroups: {},
    getShippingMethods: {},
    fetchRoutingReferenceData: vi.fn(),
  }),
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: () => ({
    getUserProfile: { timeZone: "UTC" },
    hasPermission: vi.fn(() => false),
  }),
}));

vi.mock("@/store/utilStore", () => ({
  useUtilStore: () => ({
    getEnums: {},
    getCatalogCategories: {},
    getStatusDesc: (id: string) => id,
    fetchCategories: vi.fn(),
    fetchRoutingEditorEnums: vi.fn().mockResolvedValue(undefined),
    fetchStatusInformation: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/store/simReferenceStore", () => ({
  useSimReferenceStore: () => ({
    getVirtualFacilities: {},
    getFacilityGroups: {},
    getShippingMethods: {},
    getSalesChannels: {},
    loadState: "ready",
    loadError: null,
    fetchReferenceData: mocks.fetchReferences,
  }),
}));

vi.mock("@/store/circuit", () => ({
  useCircuitStore: () => ({
    messages: ref([]),
    threads: ref([]),
    currentThreadId: ref(null),
    lastPrompt: ref(null),
    activeContext: ref(null),
    isChatStarted: ref(false),
    setLastPrompt: mocks.setLastPrompt,
  }),
}));

vi.mock("@/composables/useRoutingAgentSnapshot", () => ({
  buildRoutingAgentSnapshot: () => ({
    facilities: {},
    shippingMethods: {},
    salesChannels: {},
    facilityGroups: {},
    brokeringFacilityGroups: {},
  }),
}));

vi.mock("@/services/DraftAssistantService", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/services/DraftAssistantService")>();
  return {
    DraftAssistantService: {
      ...original.DraftAssistantService,
      requestBrokeringRouteDraftOperations: mocks.requestDraft,
    },
  };
});

import RoutingGroupEditor from "../src/components/circuit/RoutingGroupEditor.vue";

function variationWorking(variationId = "V1", statusId = "ROUTING_DRAFT") {
  return {
    routingGroupId: "G1",
    variationGroupId: variationId,
    productStoreId: "STORE",
    groupName: `${variationId} group`,
    description: "Simulation-only group",
    routings: [{
      orderRoutingId: `${variationId}_R1`,
      routingName: `${variationId} routing`,
      statusId,
      sequenceNum: 1,
      orderFilters: [],
      rules: [{
        routingRuleId: `${variationId}_RULE1`,
        ruleName: "Default rule",
        statusId: "RULE_DRAFT",
        sequenceNum: 1,
        assignmentEnumId: "ORA_SINGLE",
        inventoryFilters: [],
        actions: [],
      }],
    }],
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createLiveStore() {
  const store: any = {
    currentGroup: {
      routingGroupId: "LIVE",
      groupName: "Untouched live OMS group",
      routings: [{ orderRoutingId: "LIVE_R1", routingName: "Live", statusId: "ROUTING_ACTIVE", rules: [] }],
    },
    currentRoutingId: "LIVE_R1",
    routingHistory: {},
    getRoutingHistory: {},
    setCurrentGroup: vi.fn(),
    setCurrentOrderRouting: vi.fn(),
    setHasUnsavedChanges: vi.fn(),
    saveRoutingGroupRaw: vi.fn(),
    adoptCommittedSchedule: vi.fn(),
    cloneGroup: vi.fn(),
    runNow: vi.fn(),
    scheduleBrokering: vi.fn(),
    discardChanges: vi.fn(),
    fetchCurrentGroupSchedule: vi.fn(),
    fetchCurrentRoutingGroup: vi.fn(),
    fetchGroupHistory: vi.fn(),
    fetchRoutingHistory: vi.fn(),
  };
  Object.defineProperty(store, "getCurrentRoutingGroup", { get: () => store.currentGroup });
  return store;
}

function proposal(statusId: string) {
  return {
    id: `proposal-${statusId}`,
    sourcePrompt: `Set ${statusId}`,
    createdAt: Date.now(),
    operations: [{ op: "set", target: "route.statusId", value: statusId }],
    unansweredQuestions: [],
    summary: `Set route to ${statusId}`,
    providerSummary: `Set route to ${statusId}`,
    intent: "edit",
  };
}

function allLiveMutationSpies() {
  return [
    mocks.live.setCurrentGroup,
    mocks.live.setCurrentOrderRouting,
    mocks.live.setHasUnsavedChanges,
    mocks.live.saveRoutingGroupRaw,
    mocks.live.adoptCommittedSchedule,
    mocks.live.cloneGroup,
    mocks.live.runNow,
    mocks.live.scheduleBrokering,
  ];
}

async function mountSandbox() {
  const wrapper = shallowMount(RoutingGroupEditor, {
    props: { routingGroupId: "G1", sandbox: true },
    global: {
      stubs: {
        AddInventoryFilterOptionsModal: true,
        AddOrderRouteFilterOptions: true,
        ArchivedRoutingModal: true,
        ArchivedRuleModal: true,
        GroupHistoryModal: true,
        PromiseFilterPopover: true,
        RoutingConfigSectionCard: true,
        RoutingHistoryModal: true,
        ScheduleModal: true,
      },
    },
  });
  await (wrapper.vm as any).activateForVisibleGroup();
  await flushPromises();
  return wrapper;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Circuit simulation editor safety boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.live = createLiveStore();
    mocks.sim = reactive({
      routingGroupId: "G1",
      activeVariationId: "V1",
      tree: [{ id: "V1", variationGroupId: "V1" }],
      working: variationWorking("V1"),
      loadGroup: vi.fn().mockResolvedValue(undefined),
    });
    mocks.fetchReferences.mockResolvedValue(undefined);
  });

  it("previews, accepts, and revises only the active simulation working copy", async () => {
    const liveBefore = cloneJson(mocks.live.currentGroup);
    const wrapper = await mountSandbox();

    await expect((wrapper.vm as any).previewDraftProposal(proposal("ROUTING_ACTIVE"))).resolves.toMatchObject({ appliedCount: 1 });
    expect(mocks.sim.working.routings[0].statusId).toBe("ROUTING_ACTIVE");
    (wrapper.vm as any).acceptDraftProposal();
    (wrapper.vm as any).rejectDraftProposal();
    expect(mocks.sim.working.routings[0].statusId).toBe("ROUTING_ACTIVE");
    expect(wrapper.emitted("dirtyChange")?.some(([dirty]) => dirty === true)).toBe(true);

    await expect((wrapper.vm as any).previewDraftProposal(proposal("ROUTING_ARCHIVED"))).resolves.toMatchObject({ appliedCount: 1 });
    expect(mocks.sim.working.routings[0].statusId).toBe("ROUTING_ARCHIVED");
    (wrapper.vm as any).rejectDraftProposal();
    expect(mocks.sim.working.routings[0].statusId).toBe("ROUTING_ACTIVE");

    expect(mocks.live.currentGroup).toEqual(liveBefore);
    allLiveMutationSpies().forEach((spy) => expect(spy).not.toHaveBeenCalled());
    wrapper.unmount();
  });

  it("reject restores the exact pre-proposal variation in place and proposal revisions never stack", async () => {
    const wrapper = await mountSandbox();
    const workingIdentity = mocks.sim.working;
    const before = cloneJson(mocks.sim.working);

    await (wrapper.vm as any).previewDraftProposal(proposal("ROUTING_ACTIVE"));
    await (wrapper.vm as any).previewDraftProposal(proposal("ROUTING_ARCHIVED"));
    expect(mocks.sim.working.routings[0].statusId).toBe("ROUTING_ARCHIVED");

    (wrapper.vm as any).rejectDraftProposal();
    expect(mocks.sim.working).toBe(workingIdentity);
    expect(mocks.sim.working).toEqual(before);
    allLiveMutationSpies().forEach((spy) => expect(spy).not.toHaveBeenCalled());
    wrapper.unmount();
  });

  it("auto-rejects on unmount and never lets an old proposal snapshot overwrite a switched variation", async () => {
    const wrapper = await mountSandbox();
    const v1Before = cloneJson(mocks.sim.working);
    await (wrapper.vm as any).previewDraftProposal(proposal("ROUTING_ACTIVE"));
    wrapper.unmount();
    expect(mocks.sim.working).toEqual(v1Before);

    const second = await mountSandbox();
    await (second.vm as any).previewDraftProposal(proposal("ROUTING_ACTIVE"));
    (second.vm as any).deactivateWorkingFlushHook(false);
    const v2 = reactive(variationWorking("V2"));
    mocks.sim.activeVariationId = "V2";
    mocks.sim.working = v2;
    (second.vm as any).rejectDraftProposal();
    expect(mocks.sim.working).toBe(v2);
    expect(mocks.sim.working).toEqual(variationWorking("V2"));
    allLiveMutationSpies().forEach((spy) => expect(spy).not.toHaveBeenCalled());
    second.unmount();
  });

  it("aborts a stale assistant response after the variation context changes", async () => {
    const request = deferred<any>();
    mocks.requestDraft.mockReturnValueOnce(request.promise);
    const wrapper = await mountSandbox();
    const pending = (wrapper.vm as any).prepareDraftProposal("Activate this variation route");
    await vi.waitFor(() => expect(mocks.requestDraft).toHaveBeenCalledOnce());

    (wrapper.vm as any).deactivateWorkingFlushHook(false);
    const v2 = reactive(variationWorking("V2"));
    mocks.sim.activeVariationId = "V2";
    mocks.sim.working = v2;
    request.resolve({
      operations: [{ op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" }],
      unansweredQuestions: [],
      summary: "Activate route",
      intent: "edit",
    });

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.sim.working).toBe(v2);
    expect(mocks.sim.working.routings[0].statusId).toBe("ROUTING_DRAFT");
    allLiveMutationSpies().forEach((spy) => expect(spy).not.toHaveBeenCalled());
    wrapper.unmount();
  });

  it("sends both Circuit inquiry and edit requests with the active variation context", async () => {
    mocks.requestDraft
      .mockResolvedValueOnce({
        operations: [],
        unansweredQuestions: [],
        summary: "This route belongs to V1.",
        intent: "inquiry",
      })
      .mockResolvedValueOnce({
        operations: [{ op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" }],
        unansweredQuestions: [],
        summary: "Activate route",
        intent: "edit",
      });
    const wrapper = await mountSandbox();

    await expect((wrapper.vm as any).prepareDraftProposal("How is this variation configured?")).resolves.toMatchObject({
      proposal: null,
      intent: "inquiry",
    });
    await expect((wrapper.vm as any).prepareDraftProposal("Activate this variation route")).resolves.toMatchObject({
      proposal: expect.objectContaining({ intent: "edit" }),
      intent: "edit",
    });

    expect(mocks.requestDraft).toHaveBeenCalledTimes(2);
    for (const [, manifest] of mocks.requestDraft.mock.calls) {
      expect(manifest.context).toMatchObject({
        mode: "variation",
        variationId: "V1",
        routingGroupId: "G1",
      });
      expect(manifest.visibleEntities.route).toMatchObject({
        orderRoutingId: "V1_R1",
        routingName: "V1 routing",
      });
      expect(manifest.visibleEntities.brokeringRun.availableSiblingRoutings).toEqual([
        expect.objectContaining({ orderRoutingId: "V1_R1" }),
      ]);
    }
    allLiveMutationSpies().forEach((spy) => expect(spy).not.toHaveBeenCalled());
    wrapper.unmount();
  });
});
