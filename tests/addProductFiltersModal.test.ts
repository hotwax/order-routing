import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("AddProductFiltersModal", () => {
  const fetchProductFilters = vi.fn();
  const fetchProductFacetCounts = vi.fn();
  const previewProducts = vi.fn();
  const facetOptions = [
    { id: "Size/L", label: "Size/L", value: "Size/L" },
    { id: "Size/XL", label: "Size/XL", value: "Size/XL" },
    { id: "Color/Blue", label: "Color/Blue", value: "Color/Blue" },
  ];

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    fetchProductFilters.mockReset();
    fetchProductFilters.mockImplementation(async ({ queryString }: { queryString: string }) => (
      facetOptions.filter((option) => option.label.includes(queryString))
    ));
    fetchProductFacetCounts.mockReset();
    fetchProductFacetCounts.mockResolvedValue({ "Size/L": 4, "Size/XL": 2 });
    previewProducts.mockReset();
    previewProducts.mockResolvedValue({ total: 6 });

    vi.doMock("@common", () => ({
      translate: (label: string, params?: { label?: string }) => params?.label ? `${label} ${params.label}` : label,
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({
        fetchProductFilters,
        fetchProductFacetCounts,
        previewProducts,
        getAppliedFilters: {
          included: { tags: [], productFeatures: [] },
          excluded: { tags: [], productFeatures: [] },
        },
        getAppliedFiltersOperator: {
          included: { tags: "", productFeatures: "" },
          excluded: { tags: "", productFeatures: "" },
        },
        getFacetOptions: () => facetOptions,
        updateAppliedFilters: vi.fn(),
      }),
    }));
    vi.doMock("@ionic/vue", () => ({
      IonButton: defineComponent({ name: "IonButton", template: "<button><slot /></button>" }),
      IonButtons: defineComponent({ name: "IonButtons", template: "<div><slot /></div>" }),
      IonCheckbox: defineComponent({ name: "IonCheckbox", template: "<label><slot /></label>" }),
      IonChip: defineComponent({ name: "IonChip", template: "<span><slot /></span>" }),
      IonContent: defineComponent({ name: "IonContent", template: "<main><slot /></main>" }),
      IonFab: defineComponent({ name: "IonFab", template: "<div><slot /></div>" }),
      IonFabButton: defineComponent({ name: "IonFabButton", template: "<button><slot /></button>" }),
      IonHeader: defineComponent({ name: "IonHeader", template: "<header><slot /></header>" }),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<span><slot /></span>" }),
      IonList: defineComponent({ name: "IonList", template: "<div><slot /></div>" }),
      IonNote: defineComponent({ name: "IonNote", template: "<span><slot /></span>" }),
      IonRow: defineComponent({ name: "IonRow", template: "<div><slot /></div>" }),
      IonSearchbar: defineComponent({
        name: "IonSearchbar",
        props: ["modelValue"],
        emits: ["keyup", "update:modelValue"],
        template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" @keyup="$emit('keyup', $event)" />`,
      }),
      IonSpinner: defineComponent({ name: "IonSpinner", template: "<span />" }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: { dismiss: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens without prefetching facets and searches the server after typing", async () => {
    const { default: AddProductFiltersModal } = await import("../src/components/AddProductFiltersModal.vue");
    const wrapper = mount(AddProductFiltersModal, {
      props: {
        facetToSelect: "productFeaturesFacet",
        label: "product features",
        searchfield: "productFeatures",
        type: "included",
      },
    });

    await flushPromises();
    await nextTick();

    expect(fetchProductFilters).not.toHaveBeenCalled();
    expect(fetchProductFacetCounts).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("Size/L");

    const searchbar = wrapper.find("input");
    await searchbar.setValue("Size/XL");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(fetchProductFilters).toHaveBeenCalledTimes(1);
    expect(fetchProductFilters).toHaveBeenCalledWith({
      facetToSelect: "productFeaturesFacet",
      searchfield: "productFeatures",
      queryString: "Size/XL",
      limit: 100,
      maxResults: 100,
    });
    expect(fetchProductFacetCounts).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Size/XL");
    expect(wrapper.text()).not.toContain("Size/L");
    expect(wrapper.text()).not.toContain("Color/Blue");
  });

  it("discards an in-flight search response once the query changes again", async () => {
    // Regression guard for the stale-response window: the queryString watcher must invalidate the
    // active request as soon as the user types, not 300ms later when the replacement search fires.
    // Without that invalidation a slow response for the previous query renders over the new one.
    const pending: Array<{ queryString: string; resolve: (options: unknown[]) => void }> = [];
    fetchProductFilters.mockImplementation(({ queryString }: { queryString: string }) => (
      new Promise((resolve) => { pending.push({ queryString, resolve }); })
    ));

    const { default: AddProductFiltersModal } = await import("../src/components/AddProductFiltersModal.vue");
    const wrapper = mount(AddProductFiltersModal, {
      props: {
        facetToSelect: "productFeaturesFacet",
        label: "product features",
        searchfield: "productFeatures",
        type: "included",
      },
    });

    await flushPromises();
    await nextTick();

    const searchbar = wrapper.find("input");

    // First query reaches the server and stays in flight.
    await searchbar.setValue("Size/L");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(pending).toHaveLength(1);
    expect(pending[0].queryString).toBe("Size/L");

    // The user types again while that request is still outstanding.
    await searchbar.setValue("Color/Blue");
    await nextTick();

    // The earlier request now lands, inside the debounce window of the replacement search.
    pending[0].resolve([{ id: "Size/L", label: "Size/L", value: "Size/L" }]);
    await flushPromises();
    await nextTick();

    expect(wrapper.text()).not.toContain("Size/L");

    // The replacement search still resolves and renders normally.
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(pending).toHaveLength(2);
    expect(pending[1].queryString).toBe("Color/Blue");

    pending[1].resolve([{ id: "Color/Blue", label: "Color/Blue", value: "Color/Blue" }]);
    await flushPromises();
    await nextTick();

    expect(wrapper.text()).toContain("Color/Blue");
    expect(wrapper.text()).not.toContain("Size/L");
  });
});
