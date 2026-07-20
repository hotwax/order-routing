import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";

const passthrough = (name: string) => defineComponent({
  name,
  template: "<div><slot name='start' /><slot name='header' /><slot /><slot name='end' /><slot name='content' /></div>",
});

describe("InventoryDetail Channel scope", () => {
  const fetchProductFacility = vi.fn();
  const fetchInventoryLogs = vi.fn();
  const clearInventoryLogs = vi.fn();
  const routerReplace = vi.fn();
  const productFacility = ref<any[]>([]);
  const inventoryLogs = ref<any[]>([]);
  const currentRoute = ref({ params: { productId: "SKU_1" }, query: { channelId: "FAC_GRP" } });

  beforeEach(() => {
    vi.resetModules();
    fetchProductFacility.mockReset();
    fetchInventoryLogs.mockReset();
    clearInventoryLogs.mockReset();
    routerReplace.mockReset();
    productFacility.value = [];
    inventoryLogs.value = [];
    currentRoute.value = { params: { productId: "SKU_1" }, query: { channelId: "FAC_GRP" } };

    fetchProductFacility.mockImplementation(async (params: any) => {
      productFacility.value = [{
        productId: "SKU_1",
        facilityId: params.facilityId,
        inventoryConfig: { allowBrokering: "Y", allowPickup: "N", minimumStock: 3, atp: 100, qoh: 120 },
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
      classifyMovement: vi.fn(),
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
});
