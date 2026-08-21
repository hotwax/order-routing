import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";

/**
 * The inventory list queries the ProductFacility entity and then enriches with Solr, rather than
 * paging a Solr product search and left-joining ProductFacility onto it. These tests pin the parts
 * of that contract the UI depends on: which endpoint shape is asked for, that the total reflects the
 * facility rather than the catalogue, that product filtering happens by id, and that channel scope
 * never asks for the InventoryItem join.
 */
describe("Inventory entity-first search", () => {
  const products = ref<any[]>([]);
  let fetchProductFacilityRows: ReturnType<typeof vi.fn>;
  let fetchProductSummaries: ReturnType<typeof vi.fn>;
  let lastModalProps: any;
  let modalDismissData: any;

  const ROWS = [
    { productId: "10001", availableToPromise: 72, quantityOnHand: 100, minimumStock: 3, allowPickup: "N", allowBrokering: "Y" },
    { productId: "10002", availableToPromise: 100, quantityOnHand: 100, minimumStock: null, allowPickup: "Y", allowBrokering: "N" },
  ];

  const flush = async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
      await nextTick();
    }
  };

  const lastCall = () => fetchProductFacilityRows.mock.calls[fetchProductFacilityRows.mock.calls.length - 1];
  const lastParams = () => lastCall()[0];
  const lastOptions = () => lastCall()[1];

  // Location scope renders: facility, sort, allowBrokering, allowPickup.
  const sortSelect = (wrapper: any) => wrapper.findAllComponents({ name: "IonSelect" })[1];

  async function selectFacility(wrapper: any, facilityId: string) {
    wrapper.findAllComponents({ name: "IonSelect" })[0].vm.$emit("update:modelValue", facilityId);
    await flush();
  }

  beforeEach(() => {
    vi.resetModules();
    products.value = [];
    modalDismissData = undefined;
    lastModalProps = undefined;

    fetchProductFacilityRows = vi.fn((_params: any) => {
      products.value = ROWS;

      return Promise.resolve({ rows: ROWS, total: 1738 });
    });
    fetchProductSummaries = vi.fn(() => Promise.resolve({
      "10001": { productId: "10001", productName: "XS / Blue", sku: "MH09-XS-Blue" },
    }));

    vi.doMock("@common", () => ({
      DxpShopifyImg: defineComponent({ name: "DxpShopifyImg", template: "<img />" }),
      commonUtil: { getProductIdentificationValue: (id: string, p: any) => p?.[id] || "" },
      emitter: { on: vi.fn(), off: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("../src/router", () => ({ default: { push: vi.fn(), replace: vi.fn(), currentRoute: { value: { query: {} } } } }));
    vi.doMock("../src/router/index", () => ({ default: { push: vi.fn(), replace: vi.fn(), currentRoute: { value: { query: {} } } } }));
    vi.doMock("@/components/LinkThresholdFacilitiesToGroupModal.vue", () => ({
      default: defineComponent({ name: "LinkThresholdFacilitiesToGroupModal", template: "<div />" }),
    }));
    vi.doMock("@/components/ProductFacilityConfigEditModal.vue", () => ({
      default: defineComponent({ name: "ProductFacilityConfigEditModal", template: "<div />" }),
    }));
    vi.doMock("@/components/ProductInventoryEdit.vue", () => ({
      default: defineComponent({ name: "ProductInventoryEdit", template: "<div />" }),
    }));
    vi.doMock("@/components/ProductSearchModal.vue", () => ({
      default: defineComponent({ name: "ProductSearchModal", template: "<div />" }),
    }));
    vi.doMock("@/composables/useProductSearch", () => ({
      useProductSearch: () => ({
        fetchProductSummaries,
        fetchVariants: vi.fn(() => Promise.resolve({ variants: [], total: 0 })),
        searchStyles: vi.fn(() => Promise.resolve({ styles: [], total: 0 })),
      }),
    }));
    vi.doMock("@/composables/useProductFacility", () => ({
      useProductFacility: () => ({
        clearProductFacility: vi.fn(() => { products.value = []; }),
        fetchProductFacility: vi.fn(),
        fetchProductFacilityRows,
        productFacility: products,
      }),
    }));
    vi.doMock("@/store/product", () => ({
      productStore: () => ({ fetchProducts: vi.fn(), getProductById: () => ({ mainImageUrl: "" }) }),
    }));
    vi.doMock("@/store/productStore", () => ({
      productStore: () => ({
        fetchProductStoreFacilities: vi.fn(() => Promise.resolve()),
        getProductIdentificationPref: { primaryId: "productId", secondaryId: "SKU" },
        productStoreFacilities: [
          { facilityId: "BROOKLYN", facilityName: "Brooklyn" },
          { facilityId: "AUSTIN", facilityName: "Austin" },
        ],
        selectedInventoryFacilityId: "BROOKLYN",
        setEcomStore: vi.fn(),
        setSelectedInventoryFacilityId: vi.fn(),
      }),
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({ currentProductStore: { productStoreId: "STORE" }, fetchConfigFacilities: vi.fn() }),
    }));
    vi.doMock("@/store/channel", () => ({
      useChannelStore: () => ({
        fetchGroupFacilities: vi.fn(() => Promise.resolve()),
        fetchInventoryChannels: vi.fn(() => Promise.resolve()),
        getInventoryChannels: [{
          facilityGroupId: "CHANNEL_A",
          facilityGroupTypeId: "CHANNEL_FAC_GROUP",
          facilityGroupName: "Channel A",
          facilityMembershipLoadState: "loaded",
          selectedConfigFacility: { facilityId: "CONFIG_FAC" },
        }],
      }),
    }));
    vi.doMock("@/composables/useChannelInventory", () => ({
      fetchProductOnlineAtpMap: vi.fn(() => Promise.resolve({})),
      mergeOnlineAtpIntoRows: (rows: any[]) => rows,
    }));
    vi.doMock("@ionic/vue", () => ({
      IonButton: defineComponent({ name: "IonButton", template: "<button><slot /></button>" }),
      IonButtons: defineComponent({ name: "IonButtons", template: "<div><slot /></div>" }),
      IonCard: defineComponent({ name: "IonCard", template: "<article><slot /></article>" }),
      IonCardContent: defineComponent({ name: "IonCardContent", template: "<div><slot /></div>" }),
      IonCheckbox: defineComponent({ name: "IonCheckbox", props: ["checked", "indeterminate", "modelValue"], emits: ["ionChange", "update:modelValue"], template: "<button><slot /></button>" }),
      IonChip: defineComponent({ name: "IonChip", template: "<span><slot /></span>" }),
      IonContent: defineComponent({ name: "IonContent", template: "<main><slot /></main>" }),
      IonFooter: defineComponent({ name: "IonFooter", template: "<footer><slot /></footer>" }),
      IonHeader: defineComponent({ name: "IonHeader", template: "<header><slot /></header>" }),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<label><slot /></label>" }),
      IonNote: defineComponent({ name: "IonNote", template: "<span><slot /></span>" }),
      IonPage: defineComponent({ name: "IonPage", template: "<section><slot /></section>" }),
      IonSegment: defineComponent({ name: "IonSegment", template: "<div><slot /></div>" }),
      IonSegmentButton: defineComponent({ name: "IonSegmentButton", template: "<button><slot /></button>" }),
      IonSelect: defineComponent({ name: "IonSelect", props: ["modelValue", "value"], emits: ["update:modelValue", "ionChange"], template: "<select><slot /></select>" }),
      IonSelectOption: defineComponent({ name: "IonSelectOption", template: "<option><slot /></option>" }),
      IonSkeletonText: defineComponent({ name: "IonSkeletonText", template: "<span />" }),
      IonThumbnail: defineComponent({ name: "IonThumbnail", template: "<div><slot /></div>" }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: {
        create: vi.fn((options: any) => {
          lastModalProps = options.componentProps;

          return Promise.resolve({
            onDidDismiss: () => Promise.resolve({ data: modalDismissData }),
            present: vi.fn(() => Promise.resolve()),
          });
        }),
      },
      onIonViewDidEnter: vi.fn(),
      onIonViewDidLeave: vi.fn(),
    }));
  });

  it("queries the facility's own rows and reports the facility total, not a catalogue total", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    expect(lastParams()).toMatchObject({ facilityId: "BROOKLYN", pageIndex: 0, orderByField: "productId" });
    // The old service sent a free-text keyword; product filtering is by id now.
    expect(lastParams().keyword).toBeUndefined();
    // 1738 comes from the entity count for this facility, not from Solr's product count.
    expect(wrapper.text()).toContain("products found");
    expect(wrapper.vm.total).toBe(1738);
  });

  it("renders inventory straight off the entity row", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    const text = wrapper.text();
    expect(text).toContain("72");
    expect(text).toContain("100");
    expect(text).toContain("ATP");
    expect(text).toContain("QOH");
  });

  it("enriches the page's product ids from Solr", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    expect(fetchProductSummaries).toHaveBeenCalledWith(["10001", "10002"]);
    // Enriched row shows its Solr name; the unenriched one still renders from its entity data.
    expect(wrapper.text()).toContain("10002");
  });

  it("filters by product id when the search modal applies a selection", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    modalDismissData = { productIds: ["10001", "10002"] };
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();

    expect(lastModalProps).toMatchObject({ selectedProductIds: [] });
    expect(lastParams()).toMatchObject({ productId: "10001,10002", productId_op: "in" });
  });

  it("sorts by any view alias, including inventory levels", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    sortSelect(wrapper).vm.$emit("ionChange", { detail: { value: "-availableToPromise" } });
    await flush();

    expect(lastParams().orderByField).toBe("-availableToPromise");
  });

  it("asks for the InventoryItem join in location scope but never in channel scope", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");
    expect(lastOptions()).toEqual({ withInventory: true });

    const segment = wrapper.findComponent({ name: "IonSegment" });
    segment.vm.$emit("ionChange", { detail: { value: "channel" } });
    await flush();

    expect(lastOptions()).toEqual({ withInventory: false });
  });

  it("drops an inventory sort that channel scope cannot honour", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    sortSelect(wrapper).vm.$emit("ionChange", { detail: { value: "-availableToPromise" } });
    await flush();
    expect(lastParams().orderByField).toBe("-availableToPromise");

    wrapper.findComponent({ name: "IonSegment" }).vm.$emit("ionChange", { detail: { value: "channel" } });
    await flush();

    // The plain entity has no availableToPromise alias; EntityFind would silently ignore it.
    expect(lastParams().orderByField).toBe("productId");
  });
});
