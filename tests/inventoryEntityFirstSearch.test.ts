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
  let fetchConfiguredProductIds: ReturnType<typeof vi.fn>;
  let lastModalProps: any;
  let modalDismissData: any;
  let routerMock: any;

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

  const sortSelect = (wrapper: any) => wrapper.findAllComponents({ name: "IonSelect" })
    .find((component: any) => component.attributes("data-testid") === "inventory-sort-select");

  // The facility control opens the multi-facility selector and takes facilityIds off its dismiss payload.
  async function selectFacility(wrapper: any, facilityId: string) {
    const previous = modalDismissData;
    modalDismissData = { facilityIds: [facilityId] };
    await wrapper.find('[data-testid="inventory-facility-switcher"]').trigger("click");
    await flush();
    modalDismissData = previous;
  }

  beforeEach(() => {
    vi.resetModules();
    products.value = [];
    modalDismissData = undefined;
    lastModalProps = undefined;
    routerMock = { push: vi.fn(), replace: vi.fn(), currentRoute: { value: { query: {} } } };

    fetchProductFacilityRows = vi.fn((_params: any) => {
      products.value = ROWS;

      return Promise.resolve({ rows: ROWS, total: 1738 });
    });
    fetchProductSummaries = vi.fn(() => Promise.resolve({
      "10001": {
        productId: "10001",
        productName: "XS / Blue",
        parentProductName: "Abominable Hoodie",
        groupId: "STYLE-1",
        sku: "MH09-XS-Blue",
        SKU: "MH09-XS-Blue",
      },
    }));
    fetchConfiguredProductIds = vi.fn(() => Promise.resolve(new Set(["10001", "10002"])));

    vi.doMock("@common", () => ({
      DxpShopifyImg: defineComponent({ name: "DxpShopifyImg", template: "<img />" }),
      commonUtil: { getProductIdentificationValue: (id: string, p: any) => p?.[id] || "" },
      emitter: { on: vi.fn(), off: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("../src/router", () => ({ default: routerMock }));
    vi.doMock("../src/router/index", () => ({ default: routerMock }));
    vi.doMock("@/components/LinkThresholdFacilitiesToGroupModal.vue", () => ({
      default: defineComponent({ name: "LinkThresholdFacilitiesToGroupModal", template: "<div />" }),
    }));
    vi.doMock("@/components/ProductFacilityConfigEditModal.vue", () => ({
      default: defineComponent({ name: "ProductFacilityConfigEditModal", template: "<div />" }),
    }));
    vi.doMock("@/components/ProductInventoryEdit.vue", () => ({
      default: defineComponent({ name: "ProductInventoryEdit", template: "<div />" }),
    }));
    vi.doMock("@/components/FacilitySelectModal.vue", () => ({
      default: defineComponent({ name: "FacilitySelectModal", template: "<div />" }),
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
        fetchConfiguredProductIds,
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
        }, {
          facilityGroupId: "CHANNEL_EMPTY",
          facilityGroupTypeId: "CHANNEL_FAC_GROUP",
          facilityMembershipLoadState: "loaded",
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
      IonInput: defineComponent({ name: "IonInput", props: ["modelValue", "readonly"], emits: ["update:modelValue", "ionChange"], template: "<div @ion-change=\"$emit('ionChange', $event)\"><slot /></div>" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<label><slot /></label>" }),
      IonList: defineComponent({ name: "IonList", template: "<div><slot /></div>" }),
      IonNote: defineComponent({ name: "IonNote", template: "<span><slot /></span>" }),
      IonPage: defineComponent({ name: "IonPage", template: "<section><slot /></section>" }),
      IonSegment: defineComponent({ name: "IonSegment", template: "<div><slot /></div>" }),
      IonSegmentButton: defineComponent({ name: "IonSegmentButton", template: "<button><slot /></button>" }),
      IonSelect: defineComponent({ name: "IonSelect", props: ["interfaceOptions", "modelValue", "value"], emits: ["update:modelValue", "ionChange"], template: "<select @ion-change=\"$emit('ionChange', $event)\"><slot /></select>" }),
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

  it("keeps Add Config available when every selected product is unconfigured", async () => {
    fetchProductFacilityRows.mockImplementation(() => {
      products.value = [];
      return Promise.resolve({ rows: [], total: 0 });
    });
    fetchConfiguredProductIds.mockResolvedValue(new Set());
    routerMock.currentRoute.value.query = { facilityId: "BROOKLYN", productId: "10001" };
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    const ionic = await import("@ionic/vue");
    await ionic.onIonViewDidEnter.mock.calls[0][0]();
    await flush();
    const add = wrapper.findAllComponents({ name: "IonButton" }).find((button) => button.text() === "Add Config");
    expect(add).toBeDefined();
    await add!.trigger("click");
    await flush();
    expect(lastModalProps).toMatchObject({ selectedFacility: "BROOKLYN", selectedProducts: [expect.objectContaining({ productId: "10001" })] });
  });

  it("does not label stocked products as unconfigured when filters hide them", async () => {
    fetchProductFacilityRows.mockImplementation(() => {
      products.value = [ROWS[0]];
      return Promise.resolve({ rows: [ROWS[0]], total: 1 });
    });
    routerMock.currentRoute.value.query = { facilityId: "BROOKLYN", productId: "10001,10002", allowPickup: "Y" };
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    const ionic = await import("@ionic/vue");
    await ionic.onIonViewDidEnter.mock.calls[0][0]();
    await flush();
    expect(wrapper.text()).not.toContain("Not stocked at this facility");
  });

  it("queries the facility's own rows and reports the facility total, not a catalogue total", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    expect(lastParams()).toMatchObject({ facilityId: "BROOKLYN", pageIndex: 0, orderByField: "-availableToPromise" });
    // The old service sent a free-text keyword; product filtering is by id now.
    expect(lastParams().keyword).toBeUndefined();
    // 1738 comes from the entity count for this facility, not from Solr's product count.
    expect(wrapper.text()).toContain("products found");
    expect(wrapper.vm.total).toBe(1738);
  });

  it("shows retry instead of no products when the inventory request fails", async () => {
    fetchProductFacilityRows.mockRejectedValueOnce(new Error("Unavailable"));
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");
    expect(wrapper.find('[role="alert"]').text()).toContain("Unable to load inventory");
    expect(wrapper.find('[data-testid="closed-empty-state"]').exists()).toBe(false);
    await wrapper.find('[role="alert"] button').trigger("click");
    await flush();
    expect(wrapper.findAll('.list-item')).toHaveLength(2);
  });

  it("queries multiple facilities with an IN filter and keeps rows identifiable by facility", async () => {
    fetchProductFacilityRows.mockImplementation((_params: any) => {
      const rows = [
        { productId: "10001", facilityId: "BROOKLYN", availableToPromise: 72, quantityOnHand: 100 },
        { productId: "10001", facilityId: "AUSTIN", availableToPromise: 12, quantityOnHand: 20 },
      ];
      products.value = rows;

      return Promise.resolve({ rows, total: 2 });
    });
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    modalDismissData = { facilityIds: ["BROOKLYN", "AUSTIN"] };
    await wrapper.find('[data-testid="inventory-facility-switcher"]').trigger("click");
    await flush();

    expect(lastParams()).toMatchObject({ facilityId: "BROOKLYN,AUSTIN", facilityId_op: "in" });
    expect(wrapper.findAll('[data-testid="inventory-row-facility"]')).toHaveLength(2);
    expect(wrapper.findAll(".list-item")).toHaveLength(2);
    expect(wrapper.text()).toContain("2 facilities selected");
  });

  it("hydrates the facility list query from the URL and keeps changes shareable", async () => {
    routerMock.currentRoute.value.query = {
      facilityId: "BROOKLYN",
      productId: "10001,10002",
      orderByField: "availableToPromise",
      allowBrokering: "Y",
      allowPickup: "N",
      pageIndex: "2",
    };
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    const ionic = await import("@ionic/vue");
    await ionic.onIonViewDidEnter.mock.calls[0][0]();
    await flush();

    expect(lastParams()).toMatchObject({
      facilityId: "BROOKLYN",
      productId: "10001,10002",
      orderByField: "availableToPromise",
      allowBrokering: "Y",
      allowPickup: "N",
      pageIndex: 2,
    });

    sortSelect(wrapper).vm.$emit("ionChange", { detail: { value: "-minimumStock" } });
    await flush();
    expect(routerMock.replace).toHaveBeenLastCalledWith({
      path: "/inventory",
      query: expect.objectContaining({
        facilityId: "BROOKLYN",
        productId: "10001,10002",
        orderByField: "-minimumStock",
        allowBrokering: "Y",
        allowPickup: "N",
      }),
    });
  });

  it("hydrates multiple facilities from a shareable URL", async () => {
    routerMock.currentRoute.value.query = {
      facilityId: "BROOKLYN,AUSTIN",
      facilityId_op: "in",
    };
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    const ionic = await import("@ionic/vue");
    await ionic.onIonViewDidEnter.mock.calls[0][0]();
    await flush();

    expect(lastParams()).toMatchObject({
      facilityId: "BROOKLYN,AUSTIN",
      facilityId_op: "in",
    });
    expect(wrapper.text()).toContain("2 facilities selected");
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

  it("reopens the product selector from the active filter card", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    modalDismissData = { productIds: ["10001", "10002"] };
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();

    expect(lastModalProps).toMatchObject({ selectedProductIds: ["10001", "10002"] });
  });

  it("shows selected parent products in the inventory filter card", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    modalDismissData = { productIds: ["10001"] };
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();

    const summary = wrapper.find('[data-testid="product-filter-summary"]');
    const parent = wrapper.find('[data-testid="product-filter-parent"]');
    expect(summary.exists()).toBe(true);
    expect(summary.text()).toContain("Abominable Hoodie");
    expect(summary.text()).not.toContain("MH09-XS-Blue");
    expect(wrapper.findAll('[data-testid="product-filter-parent"]')).toHaveLength(1);
    expect(parent.attributes("fill")).toBe("outline");
    expect(parent.attributes("lines")).toBe("none");
    expect(parent.find("p").text()).toContain("1 variants selected");

    await wrapper.find('[data-testid="clear-product-filter"]').trigger("click");
    await flush();
    expect(lastParams().productId).toBeUndefined();
    expect(wrapper.find('[data-testid="product-filter-summary"]').exists()).toBe(false);
  });

  it("keeps parent grouping when an inventory filter removes all matching rows", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    modalDismissData = { productIds: ["10001"] };
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();

    fetchProductFacilityRows.mockImplementation(() => {
      products.value = [];
      return Promise.resolve({ rows: [], total: 0 });
    });
    const allowPickup = wrapper.findAllComponents({ name: "IonSelect" })
      .find((select: any) => select.attributes("label") === "Allow Pickup");
    allowPickup.vm.$emit("ionChange", { detail: { value: "Y" } });
    await flush();

    expect(wrapper.findAll('[data-testid="product-filter-parent"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="product-filter-summary"]').text()).toContain("Abominable Hoodie");
    expect(wrapper.find('[data-testid="product-filter-summary"]').text()).not.toContain("10001");
  });

  it("keeps standalone filters outlined without double-outlining composite controls or the header sort", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    const card = wrapper.findComponent({ name: "IonCard" });
    const standaloneSelects = card.findAllComponents({ name: "IonSelect" })
      .filter((select: any) => select.attributes("data-testid") !== "inventory-safety-stock-operator");
    expect(standaloneSelects.every((select: any) => select.attributes("fill") === "outline")).toBe(true);
    expect(card.findComponent('[data-testid="inventory-safety-stock-value"]').attributes("fill")).toBe("outline");
    expect(card.findComponent('[data-testid="inventory-safety-stock-operator"]').attributes("fill")).toBeUndefined();
    expect(sortSelect(wrapper).attributes("fill")).toBeUndefined();
  });

  it("keeps the safety-stock operator inside the input and unlocks the value for comparisons", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    const card = wrapper.findComponent({ name: "IonCard" });
    const safetyValue = card.findComponent('[data-testid="inventory-safety-stock-value"]');

    expect(safetyValue.findComponent('[data-testid="inventory-safety-stock-operator"]').attributes("slot")).toBe("end");
    expect(safetyValue.props("readonly")).toBe(true);

    const safetyOperator = safetyValue.findComponent('[data-testid="inventory-safety-stock-operator"]');
    safetyOperator.vm.$emit("update:modelValue", "less-than");
    await flush();
    expect(card.findComponent('[data-testid="inventory-safety-stock-value"]').props("readonly")).toBe(false);
  });

  it("does not query inventory while the safety-stock operator changes without a value", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");
    fetchProductFacilityRows.mockClear();

    const safetyOperator = wrapper.findComponent('[data-testid="inventory-safety-stock-operator"]');
    safetyOperator.vm.$emit("update:modelValue", "less-than");
    safetyOperator.element.dispatchEvent(new CustomEvent("ion-change", {
      bubbles: true,
      detail: { value: "less-than" },
    }));
    await flush();

    safetyOperator.vm.$emit("update:modelValue", "");
    safetyOperator.element.dispatchEvent(new CustomEvent("ion-change", {
      bubbles: true,
      detail: { value: "" },
    }));
    await flush();

    expect(fetchProductFacilityRows).not.toHaveBeenCalled();
  });

  it("groups related filters in the card and keeps sorting in the results header", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    const card = wrapper.findComponent({ name: "IonCard" });
    const scopeControls = card.find('[data-testid="inventory-scope-controls"]');
    const levelControls = card.find('[data-testid="inventory-level-controls"]');
    const configurationControls = card.find('[data-testid="inventory-configuration-controls"]');
    const listHeader = wrapper.find('[data-testid="inventory-list-header"]');

    expect(scopeControls.find('[data-testid="inventory-facility-switcher"]').exists()).toBe(true);
    expect(scopeControls.find('[data-testid="open-product-search"]').exists()).toBe(true);
    expect(levelControls.find('[data-testid="inventory-atp-filter"]').exists()).toBe(true);
    expect(levelControls.find('[data-testid="inventory-qoh-filter"]').exists()).toBe(true);
    expect(configurationControls.find('[data-testid="inventory-safety-stock-operator"]').exists()).toBe(true);
    expect(configurationControls.find('[data-testid="inventory-allow-brokering-filter"]').exists()).toBe(true);
    expect(configurationControls.find('[data-testid="inventory-allow-pickup-filter"]').exists()).toBe(true);
    expect(card.find('[data-testid="inventory-sort-select"]').exists()).toBe(false);
    expect(listHeader.exists()).toBe(true);
    expect(listHeader.find('[data-testid="inventory-sort-select"]').exists()).toBe(true);
    expect(sortSelect(wrapper)?.props("interfaceOptions")).toEqual({
      cssClass: "inventory-sort-popover",
      size: "auto",
    });
    expect(card.find('[data-testid="inventory-filter-actions"]').exists()).toBe(true);
  });

  it("maps ATP, QOH, and safety-stock filters to server-side range parameters", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    const atp = wrapper.findComponent('[data-testid="inventory-atp-filter"]');
    atp.vm.$emit("update:modelValue", "negative");
    atp.vm.$emit("ionChange", { detail: { value: "negative" } });
    await flush();

    const qoh = wrapper.findComponent('[data-testid="inventory-qoh-filter"]');
    qoh.vm.$emit("update:modelValue", "positive");
    qoh.vm.$emit("ionChange", { detail: { value: "positive" } });
    await flush();

    const safetyOperator = wrapper.findComponent('[data-testid="inventory-safety-stock-operator"]');
    safetyOperator.vm.$emit("update:modelValue", "greater-than");
    await flush();
    const safetyValue = wrapper.findComponent('[data-testid="inventory-safety-stock-value"]');
    safetyValue.vm.$emit("update:modelValue", "5");
    safetyValue.vm.$emit("ionChange", { detail: { value: "5" } });
    await flush();

    expect(lastParams()).toMatchObject({
      availableToPromise_thru: "-1",
      quantityOnHand_from: "1",
      minimumStock_from: "6",
      pageIndex: 0,
    });
    expect(lastParams().availableToPromise_from).toBeUndefined();
    expect(lastParams().quantityOnHand_thru).toBeUndefined();
    expect(routerMock.replace).toHaveBeenLastCalledWith({
      path: "/inventory",
      query: expect.objectContaining({
        facilityId: "BROOKLYN",
        availableToPromise_thru: "-1",
        quantityOnHand_from: "1",
        minimumStock_from: "5",
      }),
    });
  });

  it("clears a stale safety-stock value when its operator returns to Any", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    const safetyOperator = wrapper.findComponent('[data-testid="inventory-safety-stock-operator"]');
    safetyOperator.vm.$emit("update:modelValue", "less-than");
    await flush();
    const safetyValue = wrapper.findComponent('[data-testid="inventory-safety-stock-value"]');
    safetyValue.vm.$emit("update:modelValue", "5");
    safetyValue.vm.$emit("ionChange", { detail: { value: "5" } });
    await flush();

    safetyOperator.vm.$emit("update:modelValue", "");
    safetyOperator.element.dispatchEvent(new CustomEvent("ion-change", {
      bubbles: true,
      detail: { value: "" },
    }));
    await flush();

    expect(lastParams().minimumStock_from).toBeUndefined();
    expect(lastParams().minimumStock_thru).toBeUndefined();
    expect(wrapper.find('[data-testid="inventory-clear-filters"]').attributes("disabled")).toBeDefined();
  });

  it("clears product and operational filters without changing the facility scope", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    modalDismissData = { productIds: ["10001"] };
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();
    const atp = wrapper.findComponent('[data-testid="inventory-atp-filter"]');
    atp.vm.$emit("update:modelValue", "positive");
    atp.vm.$emit("ionChange", { detail: { value: "positive" } });
    await flush();

    await wrapper.find('[data-testid="inventory-clear-filters"]').trigger("click");
    await flush();

    expect(lastParams()).toMatchObject({ facilityId: "BROOKLYN", orderByField: "-availableToPromise", pageIndex: 0 });
    expect(lastParams().productId).toBeUndefined();
    expect(lastParams().availableToPromise_from).toBeUndefined();
    expect(wrapper.find('[data-testid="product-filter-summary"]').exists()).toBe(false);
  });

  it("groups selected variants under one parent product", async () => {
    fetchProductSummaries.mockResolvedValue({
      "10001": { productId: "10001", productName: "XS / Blue", parentProductName: "Abominable Hoodie", groupId: "STYLE-1", SKU: "SKU-1" },
      "10002": { productId: "10002", productName: "S / Blue", parentProductName: "Abominable Hoodie", groupId: "STYLE-1", SKU: "SKU-2" },
    });
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    modalDismissData = { productIds: ["10001", "10002"] };
    await wrapper.find('[data-testid="open-product-search"]').trigger("click");
    await flush();

    expect(wrapper.findAll('[data-testid="product-filter-parent"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="product-filter-summary"]').text()).toContain("2 variants selected");
  });

  it("sorts by any view alias, including inventory levels", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    sortSelect(wrapper).vm.$emit("ionChange", { detail: { value: "-availableToPromise" } });
    await flush();

    expect(lastParams().orderByField).toBe("-availableToPromise");
  });

  it("supports server-side product name sorting for location inventory rows", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    await selectFacility(wrapper, "BROOKLYN");

    sortSelect(wrapper).vm.$emit("ionChange", { detail: { value: "productName" } });
    await flush();

    expect(lastParams().orderByField).toBe("productName");
    expect(routerMock.replace).toHaveBeenLastCalledWith({
      path: "/inventory",
      query: expect.objectContaining({ orderByField: "productName" }),
    });
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

  it("does not borrow a physical facility for a channel with no config facility", async () => {
    routerMock.currentRoute.value.query = { channelId: "CHANNEL_EMPTY" };
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    const ionic = await import("@ionic/vue");
    await ionic.onIonViewDidEnter.mock.calls[0][0]();
    await flush();
    expect(wrapper.text()).toContain("Add Config");
    expect(fetchProductFacilityRows).not.toHaveBeenCalled();
  });

  it("refetches the last valid page when a shared page index is out of range", async () => {
    fetchProductFacilityRows.mockImplementation((params: any) => {
      const rows = params.pageIndex ? [] : ROWS;
      products.value = rows;
      return Promise.resolve({ rows, total: 2 });
    });
    routerMock.currentRoute.value.query = { facilityId: "BROOKLYN", pageIndex: "10" };
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);
    const ionic = await import("@ionic/vue");
    await ionic.onIonViewDidEnter.mock.calls[0][0]();
    await flush();
    expect(fetchProductFacilityRows.mock.calls.map(([params]) => params.pageIndex)).toEqual([10, 0]);
    expect(wrapper.findAll('.list-item')).toHaveLength(2);
  });
});
