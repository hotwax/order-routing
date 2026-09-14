import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";

// ATP/QOH/safety stock are per-facility, so the rows on screen when a facility switch starts belong
// to the facility the user just left. The list must fall back to the skeleton for the duration of the
// switch instead of presenting the previous facility's numbers as the newly selected facility's.
describe("Inventory facility switch loading state", () => {
  const products = ref<any[]>([]);
  let resolveFetch: ((rows: any[], total?: number) => void) | null = null;
  let fetchProductFacility: ReturnType<typeof vi.fn>;

  const AUSTIN_ROWS = [
    { productId: "M102977", inventoryConfig: { atp: "12", qoh: "12" } },
    { productId: "M101833", inventoryConfig: { atp: "8", qoh: "8" } },
  ];
  const BROOKLYN_ROWS = [{ productId: "M900001", inventoryConfig: { atp: "3", qoh: "3" } }];

  const rowIds = (wrapper: any) => wrapper
    .findAll("[data-testid='assigned-detail-product-primary-id']")
    .map((node: any) => node.text());
  const skeletonCount = (wrapper: any) => wrapper.findAllComponents({ name: "IonSkeletonText" }).length;

  // Resolve the in-flight request and let the component apply it. The view awaits Solr enrichment
  // after the rows land, so a couple of nextTicks are not enough — drain the microtask queue.
  async function settleFetch(rows: any[], total?: number) {
    resolveFetch?.(rows, total);
    resolveFetch = null;
    await flush();
  }

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
      await nextTick();
    }
  }

  async function switchFacilityTo(wrapper: any, facilityId: string) {
    const select = wrapper.findAllComponents({ name: "IonSelect" })[0];
    select.vm.$emit("update:modelValue", facilityId);
    await nextTick();
    await nextTick();
  }

  const nextPageButton = (wrapper: any) => wrapper.find('[data-testid="inventory-next-page"]');

  beforeEach(() => {
    vi.resetModules();
    products.value = [];
    resolveFetch = null;
    // Hand back a promise the test controls, so assertions can run while the request is in flight.
    // Entity-first shape: the fetcher resolves { rows, total } rather than a bare count.
    fetchProductFacility = vi.fn(() => new Promise<{ rows: any[]; total: number }>((resolve) => {
      resolveFetch = (rows: any[], total?: number) => {
        products.value = rows;
        resolve({ rows, total: total ?? rows.length });
      };
    }));

    vi.doMock("@common", () => ({
      DxpShopifyImg: defineComponent({ name: "DxpShopifyImg", template: "<img />" }),
      commonUtil: {
        getProductIdentificationValue: (identifier: string, product: any) => product?.[identifier] || "",
      },
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
    // Mocked so the real module (and its @common useSolrSearch import) never loads in tests.
    vi.doMock("@/composables/useProductSearch", () => ({
      useProductSearch: () => ({
        fetchProductSummaries: vi.fn(() => Promise.resolve({})),
        fetchVariants: vi.fn(() => Promise.resolve({ variants: [], total: 0 })),
        searchStyles: vi.fn(() => Promise.resolve({ styles: [], total: 0 })),
      }),
    }));
    vi.doMock("@/components/ProductSearchModal.vue", () => ({
      default: defineComponent({ name: "ProductSearchModal", template: "<div />" }),
    }));
    vi.doMock("@/composables/useProductFacility", () => ({
      useProductFacility: () => ({
        clearProductFacility: vi.fn(() => { products.value = []; }),
        fetchProductFacility,
        fetchProductFacilityRows: fetchProductFacility,
        productFacility: products,
      }),
    }));
    vi.doMock("@/store/product", () => ({
      productStore: () => ({
        fetchProducts: vi.fn(),
        getProductById: () => ({ mainImageUrl: "" }),
      }),
    }));
    vi.doMock("@/store/productStore", () => ({
      productStore: () => ({
        fetchProductStoreFacilities: vi.fn(() => Promise.resolve()),
        getProductIdentificationPref: { primaryId: "productId", secondaryId: "SKU" },
        productStoreFacilities: [
          { facilityId: "AUSTIN", facilityName: "Austin" },
          { facilityId: "BROOKLYN", facilityName: "Brooklyn" },
        ],
        selectedInventoryFacilityId: "AUSTIN",
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
        getInventoryChannels: [],
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
      IonCheckbox: defineComponent({
        name: "IonCheckbox",
        props: ["checked", "indeterminate", "modelValue"],
        emits: ["ionChange", "update:modelValue"],
        template: "<button><slot /></button>",
      }),
      IonContent: defineComponent({ name: "IonContent", template: "<main><slot /></main>" }),
      IonFooter: defineComponent({ name: "IonFooter", template: "<footer><slot /></footer>" }),
      IonHeader: defineComponent({ name: "IonHeader", template: "<header><slot /></header>" }),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<label><slot /></label>" }),
      IonNote: defineComponent({ name: "IonNote", template: "<span><slot /></span>" }),
      IonPage: defineComponent({ name: "IonPage", template: "<section><slot /></section>" }),
      IonSearchbar: defineComponent({ name: "IonSearchbar", template: "<input />" }),
      IonSegment: defineComponent({ name: "IonSegment", template: "<div><slot /></div>" }),
      IonSegmentButton: defineComponent({ name: "IonSegmentButton", template: "<button><slot /></button>" }),
      // v-model aware: the facility switch under test is driven through this control.
      IonSelect: defineComponent({
        name: "IonSelect",
        props: ["modelValue"],
        emits: ["update:modelValue"],
        template: "<select><slot /></select>",
      }),
      IonSelectOption: defineComponent({ name: "IonSelectOption", template: "<option><slot /></option>" }),
      IonSkeletonText: defineComponent({ name: "IonSkeletonText", template: "<span />" }),
      IonThumbnail: defineComponent({ name: "IonThumbnail", template: "<div><slot /></div>" }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: { create: vi.fn() },
      onIonViewDidEnter: vi.fn(),
      onIonViewDidLeave: vi.fn(),
    }));
  });

  it("replaces the previous facility's rows with the skeleton while the next facility loads", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);

    await switchFacilityTo(wrapper, "AUSTIN");
    await settleFetch(AUSTIN_ROWS);
    expect(rowIds(wrapper)).toEqual(["M102977", "M101833"]);
    expect(skeletonCount(wrapper)).toBe(0);

    await switchFacilityTo(wrapper, "BROOKLYN");

    // The regression: Austin's rows used to stay on screen for the whole request because the
    // skeleton was gated on the list being empty.
    expect(rowIds(wrapper)).toEqual([]);
    expect(skeletonCount(wrapper)).toBeGreaterThan(0);

    await settleFetch(BROOKLYN_ROWS);
    expect(rowIds(wrapper)).toEqual(["M900001"]);
    expect(skeletonCount(wrapper)).toBe(0);
  });

  it("does not show the previous facility's product count or page position while switching", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);

    await switchFacilityTo(wrapper, "AUSTIN");
    await settleFetch(AUSTIN_ROWS);
    expect(wrapper.text()).toContain("products found");

    await switchFacilityTo(wrapper, "BROOKLYN");
    expect(wrapper.text()).not.toContain("products found");

    await settleFetch(BROOKLYN_ROWS);
    expect(wrapper.text()).toContain("products found");
  });

  it("keeps rows visible during a same-scope refetch so paging does not blank the list", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);

    await switchFacilityTo(wrapper, "AUSTIN");
    // A total above the page size makes a second page reachable, enabling the next-page control.
    await settleFetch(AUSTIN_ROWS, 120);
    fetchProductFacility.mockClear();

    const next = nextPageButton(wrapper);
    expect(next.exists()).toBe(true);
    await next.trigger("click");
    await nextTick();

    // Same facility, so the previous page's rows stay put rather than flashing to the skeleton.
    expect(fetchProductFacility).toHaveBeenCalled();
    expect(rowIds(wrapper)).toEqual(["M102977", "M101833"]);
    expect(skeletonCount(wrapper)).toBe(0);

    await settleFetch(AUSTIN_ROWS, 120);
  });
});
