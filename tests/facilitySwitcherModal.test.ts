import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ObserverCallback = IntersectionObserverCallback;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  observed: Element[] = [];
  private callback: ObserverCallback;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn((element: Element) => {
    this.observed.push(element);
  });

  unobserve = vi.fn((element: Element) => {
    this.observed = this.observed.filter((observedElement) => observedElement !== element);
  });

  disconnect = vi.fn(() => {
    this.observed = [];
  });

  takeRecords = vi.fn(() => []);

  trigger(element: Element) {
    this.callback([{ target: element, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

describe("FacilitySwitcherModal", () => {
  const api = vi.fn();
  const modalDismiss = vi.fn();
  const facilities = [
    { facilityId: "BROADWAY", facilityName: "Broadway Store" },
    { facilityId: "BROOKLYN", facilityName: "Brooklyn Store" },
  ];

  beforeEach(() => {
    vi.resetModules();
    api.mockReset();
    modalDismiss.mockReset();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    vi.doMock("@common", () => ({
      api,
      commonUtil: { hasError: vi.fn(() => false) },
      logger: { error: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("@/components/EmptyState.vue", () => ({
      default: defineComponent({ name: "EmptyState", template: "<div><slot /></div>" }),
    }));
    vi.doMock("@ionic/vue", () => ({
      IonButton: defineComponent({ name: "IonButton", template: "<button><slot /></button>" }),
      IonButtons: defineComponent({ name: "IonButtons", template: "<div><slot /></div>" }),
      IonContent: defineComponent({ name: "IonContent", template: "<main><slot /></main>" }),
      IonHeader: defineComponent({ name: "IonHeader", template: "<header><slot /></header>" }),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div class='ion-item'><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<span><slot /></span>" }),
      IonList: defineComponent({ name: "IonList", template: "<div><slot /></div>" }),
      IonRadio: defineComponent({
        name: "IonRadio",
        props: ["value"],
        template: "<label><input type='radio' :value='value' /><slot /></label>",
      }),
      IonRadioGroup: defineComponent({
        name: "IonRadioGroup",
        props: ["value"],
        template: "<div><slot /></div>",
      }),
      IonSearchbar: defineComponent({
        name: "IonSearchbar",
        props: ["modelValue"],
        emits: ["update:modelValue"],
        template: "<input :value='modelValue' @input='$emit(\"update:modelValue\", $event.target.value)' />",
      }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: { dismiss: modalDismiss },
    }));
  });

  async function mountModal(props = {}) {
    const { default: FacilitySwitcherModal } = await import("../src/components/FacilitySwitcherModal.vue");

    const wrapper = mount(FacilitySwitcherModal, {
      props: {
        productId: "PROD_1",
        currentFacilityId: "BROOKLYN",
        facilities,
        ...props,
      },
    });
    await flushPromises();
    await nextTick();

    return wrapper;
  }

  function getObservedRow(observer: MockIntersectionObserver, facilityId: string) {
    const row = observer.observed.find((element) => element.textContent?.includes(facilityId));
    expect(row).toBeTruthy();
    return row as Element;
  }

  it("renders facilities immediately and lazily fetches inventory for intersecting rows", async () => {
    api.mockResolvedValue({
      data: {
        products: [
          {
            inventoryConfig: { qoh: 12, atp: 7 },
          },
        ],
      },
    });

    const wrapper = await mountModal();

    expect(wrapper.text()).toContain("Broadway Store");
    expect(wrapper.text()).toContain("Brooklyn Store");
    expect(wrapper.text()).not.toContain("Fetching facilities");
    expect(api).not.toHaveBeenCalled();

    const observer = MockIntersectionObserver.instances[0];
    const broadwayRow = getObservedRow(observer, "BROADWAY");

    observer.trigger(broadwayRow);
    await flushPromises();
    await nextTick();

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith({
      url: "oms/productFacilities/search",
      method: "GET",
      params: { productId: "PROD_1", facilityId: "BROADWAY", pageSize: 1 },
    });
    expect(broadwayRow.textContent).toContain("12");
    expect(broadwayRow.textContent).toContain("7");

    const brooklynRow = wrapper.findAll(".ion-item").find((row) => row.text().includes("BROOKLYN"));
    expect(brooklynRow?.text()).toContain("-");
    expect(brooklynRow?.text()).not.toContain("12");
    expect(brooklynRow?.text()).not.toContain("7");
  });

  it("does not duplicate pending row fetches and cleans up observer state", async () => {
    let resolveInventory!: (value: any) => void;
    api.mockImplementation(() => new Promise((resolve) => {
      resolveInventory = resolve;
    }));

    const wrapper = await mountModal();
    const observer = MockIntersectionObserver.instances[0];
    const broadwayRow = getObservedRow(observer, "BROADWAY");

    observer.trigger(broadwayRow);
    observer.trigger(broadwayRow);

    expect(api).toHaveBeenCalledTimes(1);
    expect(observer.unobserve).toHaveBeenCalledWith(broadwayRow);
    expect(observer.observed).not.toContain(broadwayRow);

    resolveInventory({
      data: {
        products: [
          {
            inventoryConfig: { qoh: 4, atp: 3 },
          },
        ],
      },
    });
    await flushPromises();

    wrapper.unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fetches mounted rows immediately when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    api.mockResolvedValue({ data: { products: [] } });

    await mountModal();

    expect(api).toHaveBeenCalledTimes(2);
    expect(api).toHaveBeenCalledWith({
      url: "oms/productFacilities/search",
      method: "GET",
      params: { productId: "PROD_1", facilityId: "BROADWAY", pageSize: 1 },
    });
    expect(api).toHaveBeenCalledWith({
      url: "oms/productFacilities/search",
      method: "GET",
      params: { productId: "PROD_1", facilityId: "BROOKLYN", pageSize: 1 },
    });
  });

  it("dismisses with the clicked facility id", async () => {
    api.mockResolvedValue({ data: { products: [] } });
    const wrapper = await mountModal();

    const broadwayRow = wrapper.findAll(".ion-item").find((row) => row.text().includes("BROADWAY"));
    await broadwayRow?.trigger("click");

    expect(modalDismiss).toHaveBeenCalledWith({ facilityId: "BROADWAY" });
  });
});
