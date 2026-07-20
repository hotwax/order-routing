import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Inventory product selection", () => {
  const products = ref<any[]>([]);
  const modalCreate = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    products.value = [
      { productId: "M102977", parentProductName: "Gift card" },
      { productId: "M101833", parentProductName: "Teton Pullover Hoodie" },
    ];
    modalCreate.mockReset();
    modalCreate.mockResolvedValue({
      onDidDismiss: vi.fn(() => Promise.resolve({ data: { updated: false } })),
      present: vi.fn(() => Promise.resolve()),
    });

    vi.doMock("@common", () => ({
      DxpShopifyImg: defineComponent({ name: "DxpShopifyImg", template: "<img />" }),
      commonUtil: {
        getProductIdentificationValue: (identifier: string, product: any) => product?.[identifier] || "",
      },
      emitter: { on: vi.fn(), off: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("../src/router", () => ({
      default: { push: vi.fn() },
    }));
    vi.doMock("../src/router/index", () => ({
      default: { push: vi.fn() },
    }));
    vi.doMock("@/components/ProductFacilityConfigEditModal.vue", () => ({
      default: defineComponent({ name: "ProductFacilityConfigEditModal", template: "<div />" }),
    }));
    vi.doMock("@/components/ProductInventoryEdit.vue", () => ({
      default: defineComponent({ name: "ProductInventoryEdit", template: "<div />" }),
    }));
    vi.doMock("@/composables/useProductFacility", () => ({
      useProductFacility: () => ({
        fetchProductFacility: vi.fn(() => Promise.resolve(products.value.length)),
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
        productStoreFacilities: [{ facilityId: "BROOKLYN", facilityName: "Brooklyn" }],
        selectedInventoryFacilityId: "BROOKLYN",
        setEcomStore: vi.fn(),
        setSelectedInventoryFacilityId: vi.fn(),
      }),
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({ currentProductStore: { productStoreId: "STORE" } }),
    }));
    vi.doMock("@ionic/vue", () => ({
      IonButton: defineComponent({ name: "IonButton", template: "<button><slot /></button>" }),
      IonButtons: defineComponent({ name: "IonButtons", template: "<div><slot /></div>" }),
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
      IonList: defineComponent({ name: "IonList", template: "<div><slot /></div>" }),
      IonNote: defineComponent({ name: "IonNote", template: "<span><slot /></span>" }),
      IonPage: defineComponent({ name: "IonPage", template: "<section><slot /></section>" }),
      IonSearchbar: defineComponent({ name: "IonSearchbar", template: "<input />" }),
      IonSelect: defineComponent({ name: "IonSelect", template: "<select><slot /></select>" }),
      IonSelectOption: defineComponent({ name: "IonSelectOption", template: "<option><slot /></option>" }),
      IonSkeletonText: defineComponent({ name: "IonSkeletonText", template: "<span />" }),
      IonThumbnail: defineComponent({ name: "IonThumbnail", template: "<div><slot /></div>" }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: { create: modalCreate },
      onIonViewDidEnter: vi.fn(),
      onIonViewDidLeave: vi.fn(),
    }));
  });

  it("passes only currently checked products into the bulk inventory edit modal", async () => {
    const { default: Inventory } = await import("../src/views/Inventory.vue");
    const wrapper = mount(Inventory);

    const selectButton = wrapper.findAllComponents({ name: "IonButton" }).find((button) => button.text() === "Select");
    await selectButton?.trigger("click");
    await nextTick();

    const rowCheckboxes = wrapper.findAllComponents({ name: "IonCheckbox" }).slice(1);
    await rowCheckboxes[1].trigger("click");
    await nextTick();

    const adjustInventoryButton = wrapper.findAllComponents({ name: "IonButton" }).find((button) => button.text() === "Adjust inventory");
    expect(adjustInventoryButton).toBeTruthy();
    await adjustInventoryButton?.trigger("click");

    expect(modalCreate).toHaveBeenCalledTimes(1);
    const selectedProducts = modalCreate.mock.calls[0][0].componentProps.selectedProducts;

    expect(selectedProducts).toHaveLength(1);
    expect(selectedProducts[0].productId).toBe("M101833");
  });
});
