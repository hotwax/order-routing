import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";

const passthrough = (name: string) => defineComponent({
  name,
  template: "<div><slot name='start' /><slot name='header' /><slot /><slot name='end' /><slot name='content' /></div>",
});

// Regression coverage for issue #469: the oms/inventoryItem/detail API never returns
// lastAvailableToPromise/lastQuantityOnHand, so the ATP/QOH delta pills must show the
// signed change only, never a fabricated "0 -> diff" total built from a fake 0 baseline.
describe("InventoryDetail movement deltas (location scope)", () => {
  const fetchProductFacility = vi.fn();
  const fetchInventoryLogs = vi.fn();
  const clearInventoryLogs = vi.fn();
  const routerReplace = vi.fn();
  const productFacility = ref<any[]>([]);
  const inventoryLogs = ref<any[]>([]);
  const currentRoute = ref({ params: { productId: "SKU_1" }, query: { facilityId: "CENTRAL_WAREHOUSE" } });

  const rolloverRow = {
    inventoryItemId: "II_1",
    inventoryItemDetailSeqId: "00001",
    productId: "SKU_1",
    facilityId: "CENTRAL_WAREHOUSE",
    effectiveDate: 1700000000000,
    availableToPromiseDiff: -100,
    quantityOnHandDiff: -100,
    availableToPromiseTotal: 0,
    quantityOnHandTotal: 0,
    reasonEnumId: "INV_ROLLOVER",
  };

  beforeEach(() => {
    vi.resetModules();
    fetchProductFacility.mockReset();
    fetchInventoryLogs.mockReset();
    clearInventoryLogs.mockReset();
    routerReplace.mockReset();
    productFacility.value = [];
    inventoryLogs.value = [];
    currentRoute.value = { params: { productId: "SKU_1" }, query: { facilityId: "CENTRAL_WAREHOUSE" } };

    fetchProductFacility.mockImplementation(async (params: any) => {
      productFacility.value = [{
        productId: "SKU_1",
        facilityId: params.facilityId,
        inventoryConfig: { allowBrokering: "Y", allowPickup: "N", minimumStock: 3, atp: 100, qoh: 120 },
      }];

      return 1;
    });
    fetchInventoryLogs.mockImplementation(async () => {
      inventoryLogs.value = [rolloverRow];
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
      commonUtil: { getOmsURL: vi.fn(), hasError: vi.fn(() => false) },
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
        modalController: { create: vi.fn() },
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
        getInventoryChannels: [],
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
    vi.doMock("@/composables/useProductFacility", () => ({
      useProductFacility: () => ({ productFacility, inventoryLogs, fetchProductFacility, fetchInventoryLogs, clearInventoryLogs }),
    }));
    vi.doMock("@/composables/useInventory", () => ({ useInventory: () => ({}) }));
    vi.doMock("@/composables/useSalesOrder", () => ({ useSalesOrder: () => ({}) }));
    vi.doMock("@/utils/productIdentifier", () => ({
      getPrimaryProductIdentifier: () => "SKU_1",
      getSecondaryProductIdentifier: () => "Test Product",
    }));
    vi.doMock("@/utils/inventoryMovement", () => ({
      classifyMovement: vi.fn((row: any) => ({
        raw: row,
        icon: "icon",
        color: "medium",
        label: "Inventory rollover",
        referenceLabel: "Rollover",
        typeKey: "INV_ROLLOVER",
        searchText: "rollover",
      })),
      MOVEMENT_TYPE_ORDER: ["INV_ROLLOVER"],
      movementTypeLabel: () => "Inventory rollover",
      movementTypeIcon: () => "icon",
      movementTypeColor: () => "medium",
    }));
  });

  it("shows the signed ATP/QOH change only, never a fabricated 0 -> diff total", async () => {
    const { default: InventoryDetail } = await import("../src/views/InventoryDetail.vue");
    const wrapper = mount(InventoryDetail);
    await flushPromises();

    expect(fetchInventoryLogs).toHaveBeenCalled();

    const headerDeltas = wrapper.find(".header-deltas");
    expect(headerDeltas.exists()).toBe(true);
    expect(headerDeltas.text()).toContain("-100");
    // The old bug rendered `runningTotal(undefined, -100)` === -100 as a fake "new total"
    // immediately followed by a redundant "(-100)" delta. Guard against that shape
    // resurfacing: exactly one occurrence of "-100" per pill, not a repeated/doubled value.
    expect(headerDeltas.text().match(/-100/g)?.length).toBe(2); // one for ATP, one for QOH
    expect(headerDeltas.text()).not.toContain("undefined");
  });
});
