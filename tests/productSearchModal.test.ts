import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";

/**
 * Product search moved off the inventory list and into this modal: users find a style (a virtual
 * product) and then choose among its variants, which are what ProductFacility rows are keyed by.
 */
describe("ProductSearchModal", () => {
  const dismiss = vi.fn();
  let searchStyles: ReturnType<typeof vi.fn>;
  let fetchVariants: ReturnType<typeof vi.fn>;

  const STYLE = { productId: "10000", productName: "Abominable Hoodie", sku: "V_abominable-hoodie" };
  const VARIANTS = [
    { productId: "10001", productName: "XS / Blue", sku: "MH09-XS-Blue", groupId: "10000" },
    { productId: "10002", productName: "XS / Green", sku: "MH09-XS-Green", groupId: "10000" },
  ];

  const flush = async () => {
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
      await nextTick();
    }
  };

  async function mountModal(props: any = {}) {
    vi.resetModules();
    dismiss.mockReset();
    searchStyles = vi.fn(() => Promise.resolve({ styles: [STYLE], total: 1 }));
    fetchVariants = vi.fn(() => Promise.resolve({ variants: VARIANTS, total: VARIANTS.length }));

    vi.doMock("@common", () => ({
      DxpShopifyImg: defineComponent({ name: "DxpShopifyImg", template: "<img />" }),
      translate: (label: string, params?: any) => (params ? `${label}:${JSON.stringify(params)}` : label),
    }));
    vi.doMock("@/composables/useProductSearch", () => ({
      useProductSearch: () => ({ searchStyles, fetchVariants, fetchProductSummaries: vi.fn() }),
    }));
    vi.doMock("@ionic/vue", () => ({
      IonButton: defineComponent({ name: "IonButton", props: ["disabled"], template: "<button><slot /></button>" }),
      IonButtons: defineComponent({ name: "IonButtons", template: "<div><slot /></div>" }),
      IonCheckbox: defineComponent({ name: "IonCheckbox", props: ["checked"], template: "<input type='checkbox' />" }),
      IonContent: defineComponent({ name: "IonContent", template: "<main><slot /></main>" }),
      IonFooter: defineComponent({ name: "IonFooter", template: "<footer><slot /></footer>" }),
      IonHeader: defineComponent({ name: "IonHeader", template: "<header><slot /></header>" }),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<label><slot /></label>" }),
      IonList: defineComponent({ name: "IonList", template: "<div><slot /></div>" }),
      IonSearchbar: defineComponent({ name: "IonSearchbar", emits: ["ionInput"], template: "<input />" }),
      IonSpinner: defineComponent({ name: "IonSpinner", template: "<span />" }),
      IonThumbnail: defineComponent({ name: "IonThumbnail", template: "<div><slot /></div>" }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: { dismiss },
    }));

    const { default: ProductSearchModal } = await import("../src/components/ProductSearchModal.vue");
    const wrapper = mount(ProductSearchModal, { props });
    await flush();

    return wrapper;
  }

  const styleRows = (wrapper: any) => wrapper.findAllComponents({ name: "IonItem" });
  const applyButton = (wrapper: any) => wrapper.find('[data-testid="apply-product-filter"]');

  beforeEach(() => {
    dismiss.mockReset();
  });

  it("lists styles on open, not variants", async () => {
    const wrapper = await mountModal();

    expect(searchStyles).toHaveBeenCalled();
    expect(fetchVariants).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Abominable Hoodie");
  });

  it("drills into a style to show its variants", async () => {
    const wrapper = await mountModal();

    await styleRows(wrapper)[0].trigger("click");
    await flush();

    expect(fetchVariants).toHaveBeenCalledWith("10000");
    expect(wrapper.text()).toContain("XS / Blue");
    expect(wrapper.text()).toContain("XS / Green");
  });

  it("returns the chosen variant ids", async () => {
    const wrapper = await mountModal();
    await styleRows(wrapper)[0].trigger("click");
    await flush();

    // First IonItem is the style header row; the variants follow it.
    await styleRows(wrapper)[1].trigger("click");
    await flush();
    await applyButton(wrapper).trigger("click");

    expect(dismiss).toHaveBeenCalledWith({ productIds: ["10001"] });
  });

  it("selects and clears every variant of a style at once", async () => {
    const wrapper = await mountModal();
    await styleRows(wrapper)[0].trigger("click");
    await flush();

    const selectAll = wrapper.findAllComponents({ name: "IonButton" })
      .find((button: any) => button.text().includes("Select all"));
    await selectAll.trigger("click");
    await flush();
    await applyButton(wrapper).trigger("click");

    expect(dismiss).toHaveBeenCalledWith({ productIds: ["10001", "10002"] });
  });

  it("seeds from the filter already applied to the list", async () => {
    const wrapper = await mountModal({ selectedProductIds: ["10002"] });
    await styleRows(wrapper)[0].trigger("click");
    await flush();
    await applyButton(wrapper).trigger("click");

    expect(dismiss).toHaveBeenCalledWith({ productIds: ["10002"] });
  });

  it("clearing the filter dismisses with an empty selection rather than no data", async () => {
    const wrapper = await mountModal({ selectedProductIds: ["10002"] });

    const clear = wrapper.findAllComponents({ name: "IonButton" })
      .find((button: any) => button.text().includes("Clear filter"));
    await clear.trigger("click");

    // An empty array means "show everything"; undefined would be read as "user cancelled".
    expect(dismiss).toHaveBeenCalledWith({ productIds: [] });
  });
});
