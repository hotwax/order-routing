import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("AddProductFiltersModal", () => {
  const fetchProductFilters = vi.fn();
  const facetOptions = [
    { id: "Size/L", label: "Size/L", value: "Size/L" },
    { id: "Size/XL", label: "Size/XL", value: "Size/XL" },
    { id: "Color/Blue", label: "Color/Blue", value: "Color/Blue" },
  ];

  beforeEach(() => {
    vi.resetModules();
    fetchProductFilters.mockReset();
    fetchProductFilters.mockResolvedValue(undefined);

    vi.doMock("@common", () => ({
      translate: (label: string, params?: { label?: string }) => params?.label ? `${label} ${params.label}` : label,
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({
        fetchProductFilters,
        getAppliedFilters: {
          included: { tags: [], productFeatures: [] },
          excluded: { tags: [], productFeatures: [] },
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

  it("filters loaded feature options without refetching from Solr", async () => {
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

    expect(fetchProductFilters).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Size/L");
    expect(wrapper.text()).toContain("Size/XL");

    const searchbar = wrapper.find("input");
    await searchbar.setValue("Size/XL");
    await searchbar.trigger("keyup", { key: "Enter" });
    await nextTick();

    expect(fetchProductFilters).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Size/XL");
    expect(wrapper.text()).not.toContain("Size/L");
    expect(wrapper.text()).not.toContain("Color/Blue");
  });
});
