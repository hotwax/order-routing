import { flushPromises, mount } from "@vue/test-utils";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, reactive, ref } from "vue";

const passthrough = (name: string) => defineComponent({
  name,
  template: "<div><slot name='start' /><slot name='header' /><slot /><slot name='end' /><slot name='content' /></div>",
});

describe("InventoryDetail Channel scope", () => {
  const fetchProductFacility = vi.fn();
  const fetchInventoryLogs = vi.fn();
  const clearInventoryLogs = vi.fn();
  const updateProductFacility = vi.fn();
  const refreshReplenishmentMetrics = vi.fn();
  const resetReplenishmentMetrics = vi.fn();
  const showToast = vi.fn();
  const replenishmentMetrics = reactive({
    loading: false,
    incomingLoading: false,
    incomingUnavailable: false,
    incomingUnits: 0,
    salesVelocityUnitsPerDay: 0,
    trendPoints: [],
  });
  const routerReplace = vi.fn();
  const modalCreate = vi.fn();
  const modalPresent = vi.fn();
  const modalOnDidDismiss = vi.fn();
  const productFacility = ref<any[]>([]);
  const inventoryLogs = ref<any[]>([]);
  const currentRoute = ref({ params: { productId: "SKU_1" }, query: { channelId: "FAC_GRP" } });

  beforeEach(() => {
    vi.resetModules();
    fetchProductFacility.mockReset();
    fetchInventoryLogs.mockReset();
    clearInventoryLogs.mockReset();
    updateProductFacility.mockReset();
    refreshReplenishmentMetrics.mockReset();
    resetReplenishmentMetrics.mockReset();
    showToast.mockReset();
    routerReplace.mockReset();
    modalCreate.mockReset();
    modalPresent.mockReset();
    modalOnDidDismiss.mockReset();
    modalOnDidDismiss.mockResolvedValue({});
    modalCreate.mockResolvedValue({ present: modalPresent, onDidDismiss: modalOnDidDismiss });
    productFacility.value = [];
    inventoryLogs.value = [];
    currentRoute.value = { params: { productId: "SKU_1" }, query: { channelId: "FAC_GRP" } };

    fetchProductFacility.mockImplementation(async (params: any) => {
      productFacility.value = [{
        productId: "SKU_1",
        facilityId: params.facilityId,
        inventoryItemId: "INV_1",
        allowBrokering: "Y",
        allowPickup: "N",
        minimumStock: 3,
        daysToShip: 2,
        availableToPromise: 100,
        quantityOnHand: 120,
      }];

      return 1;
    });
    clearInventoryLogs.mockImplementation(() => { inventoryLogs.value = []; });

    vi.doMock("../src/router", () => ({
      default: {
        currentRoute,
        replace: routerReplace,
        resolve: ({ params, query }: any) => ({
          href: `/inventory/${params?.productId || ""}?${new URLSearchParams(query || {}).toString()}`,
        }),
      },
    }));
    vi.doMock("@common", () => ({
      api: vi.fn(),
      commonUtil: { getOmsURL: vi.fn(), hasError: vi.fn(() => false), showToast },
      cookieHelper: () => ({ get: () => "" }),
      DxpShopifyImg: passthrough("DxpShopifyImg"),
      emitter: { on: vi.fn(), off: vi.fn() },
      logger: { error: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("@ionic/vue", () => {
      const components = [
        "IonAccordion", "IonAccordionGroup", "IonButton", "IonButtons", "IonCard", "IonCardHeader",
        "IonCardTitle", "IonChip", "IonContent", "IonDatetime", "IonDatetimeButton", "IonHeader", "IonIcon",
        "IonItem", "IonItemDivider", "IonLabel", "IonList", "IonListHeader", "IonModal", "IonPage", "IonRow",
        "IonSearchbar", "IonSegment", "IonSegmentButton", "IonSkeletonText", "IonTitle", "IonToolbar",
      ];

      return {
        ...Object.fromEntries(components.map((name) => [name, passthrough(name)])),
        IonBackButton: defineComponent({
          name: "IonBackButton",
          props: ["defaultHref"],
          template: "<a class='back-button' :data-href='defaultHref' />",
        }),
        modalController: { create: modalCreate, dismiss: vi.fn() },
        onIonViewDidEnter: (callback: () => any) => Promise.resolve().then(callback),
        onIonViewDidLeave: vi.fn(),
      };
    });
    vi.doMock("@/store/productStore", () => ({
      productStore: () => ({
        productStoreFacilities: [{ facilityId: "CENTRAL_WAREHOUSE", facilityName: "Central Warehouse" }],
        selectedInventoryFacilityId: "CENTRAL_WAREHOUSE",
        fetchProductStoreFacilities: vi.fn(),
        getProductIdentificationPref: "productId",
        setSelectedInventoryFacilityId: vi.fn(),
      }),
    }));
    vi.doMock("@/store/product", () => ({
      productStore: () => ({
        products: { SKU_1: { productId: "SKU_1", internalName: "Test Product", productFeatures: [] } },
        getProductById: () => ({ productId: "SKU_1", internalName: "Test Product", productFeatures: [] }),
        fetchProducts: vi.fn(),
      }),
    }));
    vi.doMock("@/store/channel", () => ({
      useChannelStore: () => ({
        getInventoryChannels: [{
          facilityGroupId: "FAC_GRP",
          facilityGroupName: "Online Facility Group",
          facilityGroupTypeId: "CHANNEL_FAC_GROUP",
          facilityMembershipLoadState: "loaded",
          selectedConfigFacility: { facilityId: "CONFIGURATION" },
        }],
        fetchInventoryChannels: vi.fn(),
        fetchGroupFacilities: vi.fn(),
      }),
    }));
    vi.doMock("@/store/atpProductStore", () => ({ useAtpProductStore: () => ({ fetchConfigFacilities: vi.fn() }) }));
    vi.doMock("@/store/orderRoutingStore", () => ({ orderRoutingStore: () => ({ fetchOrderSummaries: vi.fn() }) }));
    [
      "@/components/ProductFacilityConfigEditModal.vue",
      "@/components/ProductInventoryEdit.vue",
      "@/components/FacilitySwitcherModal.vue",
      "@/components/ChannelSwitcherModal.vue",
      "@/components/LinkThresholdFacilitiesToGroupModal.vue",
    ].forEach((path) => vi.doMock(path, () => ({ default: passthrough("MockModal") })));
    vi.doMock("@/components/ReplenishmentCard.vue", () => ({
      default: defineComponent({
        name: "ReplenishmentCard",
        props: ["productId", "facilityId", "minimumStock"],
        emits: ["save"],
        template: '<section data-testid="replenishment-card"><button data-testid="save-replenishment" @click="$emit(\'save\', { minimumStock: 6 })">Save Replenishment</button></section>',
      }),
    }));
    vi.doMock("@/composables/useProductFacility", () => ({
      useProductFacility: () => ({ productFacility, inventoryLogs, fetchProductFacility, fetchInventoryLogs, clearInventoryLogs, updateProductFacility }),
    }));
    vi.doMock("@/composables/useReplenishmentMetrics", () => ({
      useReplenishmentMetrics: () => ({ metrics: replenishmentMetrics, refreshReplenishmentMetrics, resetReplenishmentMetrics }),
    }));
    vi.doMock("@/composables/useInventory", () => ({ useInventory: () => ({}) }));
    vi.doMock("@/composables/useSalesOrder", () => ({ useSalesOrder: () => ({}) }));
    vi.doMock("@/utils/productIdentifier", () => ({
      getPrimaryProductIdentifier: () => "SKU_1",
      getSecondaryProductIdentifier: () => "Test Product",
    }));
    vi.doMock("@/utils/inventoryMovement", () => ({
      movementBalance: vi.fn(() => ({ atp: null, qoh: null })),
      classifyMovement: (raw: any) => ({ raw, typeKey: "ADJUSTMENT", label: "Adjustment", referenceLabel: raw.description, searchText: raw.description }),
      MOVEMENT_TYPE_ORDER: [],
      movementTypeLabel: vi.fn(),
      movementTypeIcon: vi.fn(),
      movementTypeColor: vi.fn(),
    }));
  });

  it("uses the configuration facility for policy without exposing physical inventory behavior", async () => {
    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    expect(fetchProductFacility).toHaveBeenCalledWith({ productId: "SKU_1", facilityId: "CONFIGURATION" });
    expect(fetchInventoryLogs).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Online Facility Group");
    expect(wrapper.text()).toContain("Online ATP");
    expect(wrapper.text()).toContain("Threshold");
    // Channel scope defaults to the Computation tab, whose "Safety stock" walkthrough row is
    // channel-scoped and legitimate — the location-only affordances are Days to Ship and Adjust.
    expect(wrapper.text()).not.toContain("QOH");
    expect(wrapper.text()).not.toContain("Days to Ship");
    expect(wrapper.text()).not.toContain("Adjust");
    expect(wrapper.find(".back-button").attributes("data-href")).toBe("/inventory/?channelId=FAC_GRP");
    expect(routerReplace).toHaveBeenCalledWith({
      name: "Inventory detail",
      params: { productId: "SKU_1" },
      query: { channelId: "FAC_GRP" },
    });
  });

  it("renders current location inventory and passes it to adjustment flows", async () => {
    currentRoute.value = { params: { productId: "SKU_1" }, query: { facilityId: "CENTRAL_WAREHOUSE" } };

    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    const itemText = wrapper.findAllComponents({ name: "IonItem" }).map((item) => item.text());
    expect(itemText).toEqual(expect.arrayContaining([
      expect.stringContaining("QOH120"),
      expect.stringContaining("ATP100"),
      expect.stringContaining("Safety stock3"),
      expect.stringContaining("Days to Ship2"),
    ]));

    const adjustButton = wrapper.findAllComponents({ name: "IonButton" }).find((button) => button.text() === "Adjust");
    await adjustButton!.trigger("click");
    await flushPromises();

    expect(modalCreate).toHaveBeenCalledWith(expect.objectContaining({
      componentProps: expect.objectContaining({
        currentConfig: expect.objectContaining({
          inventoryItemId: "INV_1",
          availableToPromise: 100,
          quantityOnHand: 120,
        }),
      }),
    }));

    const editButton = wrapper.findAllComponents({ name: "IonButton" }).find((button) => button.text() === "Edit");
    await editButton!.trigger("click");
    await flushPromises();

    expect(modalCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      componentProps: expect.objectContaining({
        currentConfig: expect.objectContaining({ daysToShip: 2, minimumStock: 3 }),
      }),
    }));
  });

  it("saves replenishment changes directly and refreshes the metrics for the displayed location", async () => {
    currentRoute.value = { params: { productId: "SKU_1" }, query: { facilityId: "CENTRAL_WAREHOUSE" } };

    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    const card = wrapper.findComponent({ name: "ReplenishmentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props()).toMatchObject({ minimumStock: 3 });

    await wrapper.find('[data-testid="save-replenishment"]').trigger("click");
    await flushPromises();

    expect(updateProductFacility).toHaveBeenCalledWith([{
      productId: "SKU_1",
      facilityId: "CENTRAL_WAREHOUSE",
      minimumStock: 6,
    }]);
    expect(fetchProductFacility).toHaveBeenCalledTimes(2);
    expect(refreshReplenishmentMetrics).toHaveBeenLastCalledWith({
      productId: "SKU_1",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: inventoryLogs.value,
    });
  });

  it("keeps the current card state and explains when a replenishment save fails", async () => {
    currentRoute.value = { params: { productId: "SKU_1" }, query: { facilityId: "CENTRAL_WAREHOUSE" } };
    updateProductFacility.mockRejectedValueOnce(new Error("write failed"));

    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    await wrapper.find('[data-testid="save-replenishment"]').trigger("click");
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith("Replenishment settings could not be saved");
    expect(fetchProductFacility).toHaveBeenCalledTimes(1);
  });

  it("treats an explicit but unavailable facility as a scope error instead of substituting one", async () => {
    currentRoute.value = { params: { productId: "SKU_1" }, query: { facilityId: "GONE_FACILITY" } };

    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    // A deep link to a facility that isn't in this product store must not silently fall back to
    // another facility and load its data — that would show/adjust inventory the link never asked for.
    expect(wrapper.text()).toContain("The selected facility is not available for this product store.");
    expect(fetchProductFacility).not.toHaveBeenCalled();
    expect(fetchInventoryLogs).not.toHaveBeenCalled();
  });

  it("prefers creation time and falls back to effective time for history display and filtering", async () => {
    currentRoute.value = { params: { productId: "SKU_1" }, query: { facilityId: "CENTRAL_WAREHOUSE" } };
    const recent = DateTime.now().minus({ days: 1 });
    const old = recent.minus({ days: 30 });
    fetchInventoryLogs.mockImplementation(async () => {
      inventoryLogs.value = [
        { inventoryItemDetailSeqId: "5", description: "Created without effective", createdStamp: recent.toMillis(), effectiveDate: null },
        { inventoryItemDetailSeqId: "4", description: "Created over backdated", createdStamp: recent.toISO(), effectiveDate: old.toMillis() },
        { inventoryItemDetailSeqId: "3", description: "Effective fallback", createdStamp: null, effectiveDate: recent.toMillis() },
        { inventoryItemDetailSeqId: "2", description: "Old effective fallback", createdStamp: null, effectiveDate: old.toMillis() },
        { inventoryItemDetailSeqId: "1", description: "Old creation", createdStamp: old.toMillis(), effectiveDate: recent.toMillis() },
      ];
    });

    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    const recentDisplay = recent.toLocaleString({ ...DateTime.DATETIME_MED, hourCycle: "h12" });
    const oldDisplay = old.toLocaleString({ ...DateTime.DATETIME_MED, hourCycle: "h12" });
    expect(wrapper.findAll(".movement-sub").map((node) => node.text())).toEqual([
      recentDisplay, recentDisplay, recentDisplay, oldDisplay, oldDisplay,
    ]);

    await wrapper.findAll(".date-filters > div").find((chip) => chip.text() === "Last 7 days")!.trigger("click");
    expect(wrapper.text()).toContain("Created without effective");
    expect(wrapper.text()).toContain("Created over backdated");
    expect(wrapper.text()).toContain("Effective fallback");
    expect(wrapper.text()).not.toContain("Old effective fallback");
    expect(wrapper.text()).not.toContain("Old creation");
    wrapper.unmount();
  });
});
