import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const passthrough = (name: string) => defineComponent({
  name,
  props: ["modelValue", "value"],
  emits: ["update:modelValue", "ionInput"],
  template: "<div><slot /></div>",
});

describe("RuleProductPreview", () => {
  const api = vi.fn();
  const previewProducts = vi.fn();
  const selectedFacility = { facilityId: "FACILITY", facilityName: "Central" };

  beforeEach(() => {
    vi.resetModules();
    api.mockReset();
    previewProducts.mockReset();
    previewProducts.mockResolvedValue({
      products: [{ productId: "SKU_1", productCode: "SKU_1", mainImageUrl: "" }],
      total: 1,
    });

    vi.doMock("@common", () => ({
      api,
      commonUtil: { dedupeFacilities: (facilities: any[]) => facilities },
      DxpShopifyImg: passthrough("DxpShopifyImg"),
      translate: (label: string) => label,
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({
        getConfigFacilities: [selectedFacility],
        getFacilities: [selectedFacility],
        getAppliedFilters: { included: {} },
        getAppliedFiltersOperator: {},
        previewProducts,
        fetchFacilitiesForGroup: vi.fn(),
      }),
    }));
    vi.doMock("@/store/productStore", () => ({
      productStore: () => ({ getProductIdentificationPref: "productId" }),
    }));
    vi.doMock("@/utils/productIdentifier", () => ({
      getPrimaryProductIdentifier: (product: any) => product.productId,
      getSecondaryProductIdentifier: () => "",
    }));
    vi.doMock("@ionic/vue", () => Object.fromEntries([
      "IonButton", "IonCard", "IonChip", "IonIcon", "IonItem", "IonLabel", "IonNote",
      "IonSearchbar", "IonSelect", "IonSelectOption", "IonSpinner", "IonRow", "IonThumbnail",
    ].map((name) => [name, passthrough(name)])));
    vi.doMock("ionicons/icons", () => ({
      arrowForwardOutline: "arrowForwardOutline",
      caretBackOutline: "caretBackOutline",
      caretForwardOutline: "caretForwardOutline",
      cubeOutline: "cubeOutline",
      optionsOutline: "optionsOutline",
      pricetagOutline: "pricetagOutline",
    }));
  });

  it("loads ATP, QOH, and allow-pickup transition values from the direct inventory view", async () => {
    api.mockResolvedValue({
      data: [{
        productId: "SKU_1",
        facilityId: "FACILITY",
        availableToPromise: 7,
        quantityOnHand: 12,
        allowPickup: "N",
      }],
    });

    const { default: RuleProductPreview } = await import("../src/components/RuleProductPreview.vue");
    const wrapper = mount(RuleProductPreview, {
      props: {
        selectedSegment: "RG_PICKUP_FACILITY",
        areAllSelected: true,
        isPickupAllowed: true,
      },
    });
    await flushPromises();
    await nextTick();

    const select = wrapper.findComponent({ name: "IonSelect" });
    select.vm.$emit("update:modelValue", "FACILITY");
    await flushPromises();
    await nextTick();

    expect(api).toHaveBeenCalledWith({
      url: "oms/productFacilities/inventory",
      method: "GET",
      params: { productId: "SKU_1", facilityId: "FACILITY" },
    });
    expect(wrapper.text()).toContain("7");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("N");
    expect(wrapper.text()).toContain("Y");
  });
});
