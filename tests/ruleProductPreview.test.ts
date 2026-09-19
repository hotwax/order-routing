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

  it("shows current ATP, QOH, and the allow-pickup transition", async () => {
    api.mockResolvedValue({
      data: [{
        productId: "SKU_1",
        facilityId: "FACILITY",
        availableToPromise: 7,
        quantityOnHand: 12,
        computedInventoryCount: 3,
        computedLastInventoryCount: 2,
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

    const inventoryValues = wrapper.findAll(".tablet");
    expect(inventoryValues[0].text()).toMatch(/7\s*ATP/);
    expect(inventoryValues[1].text()).toMatch(/12\s*QOH/);
    expect(wrapper.text()).toContain("N");
    expect(wrapper.text()).toContain("Y");
  });
});
