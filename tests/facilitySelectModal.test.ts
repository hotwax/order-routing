import { shallowMount } from "@vue/test-utils";
import { IonCheckbox, IonLabel, IonSearchbar, modalController } from "@ionic/vue";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FacilitySelectModal from "../src/components/FacilitySelectModal.vue";

vi.mock("@common", () => ({ translate: (label: string) => label }));

describe("FacilitySelectModal", () => {
  beforeEach(() => {
    vi.spyOn(modalController, "dismiss").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountModal(currentFacilityIds = ["BROADWAY"]) {
    return shallowMount(FacilitySelectModal, {
      props: {
        currentFacilityIds,
        facilities: [
          { facilityId: "BROADWAY", facilityName: "Broadway Store" },
          { facilityId: "BROOKLYN", facilityName: "Brooklyn Store" },
        ],
      },
      global: { renderStubDefaultSlot: true },
    });
  }

  it("puts the facility label inside the checkbox instead of a separate clickable item", () => {
    const wrapper = mountModal();
    const checkbox = wrapper.findComponent(IonCheckbox);

    expect(checkbox.findComponent(IonLabel).text()).toContain("Broadway Store");
    expect(checkbox.findComponent(IonLabel).text()).toContain("BROADWAY");
    expect(checkbox.attributes("slot")).toBeUndefined();
    expect(checkbox.props("checked")).toBe(true);
    wrapper.unmount();
  });

  it("applies checkbox changes without toggling again when its click bubbles", async () => {
    const wrapper = mountModal();
    const checkbox = wrapper.findAllComponents(IonCheckbox)[1];

    checkbox.vm.$emit("ionChange", { detail: { checked: true } });
    await nextTick();
    expect(checkbox.props("checked")).toBe(true);
    await checkbox.trigger("click");
    await wrapper.get('[data-testid="multi-facility-apply"]').trigger("click");

    expect(modalController.dismiss).toHaveBeenCalledWith({ facilityIds: ["BROADWAY", "BROOKLYN"] });
    expect(wrapper.props("currentFacilityIds")).toEqual(["BROADWAY"]);
    wrapper.unmount();
  });

  it("disables Apply when the last checkbox is unchecked", async () => {
    const wrapper = mountModal();

    wrapper.findComponent(IonCheckbox).vm.$emit("ionChange", { detail: { checked: false } });
    await nextTick();
    const apply = wrapper.get('[data-testid="multi-facility-apply"]');
    expect(apply.attributes("disabled")).toBe("true");
    await apply.trigger("click");

    expect(modalController.dismiss).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("retains hidden selections while searching and cancels without applying", async () => {
    const wrapper = mountModal();

    wrapper.findComponent(IonSearchbar).vm.$emit("update:modelValue", "Brooklyn");
    await nextTick();
    expect(wrapper.findAllComponents(IonCheckbox)).toHaveLength(1);
    wrapper.findComponent(IonCheckbox).vm.$emit("ionChange", { detail: { checked: true } });
    await nextTick();
    await wrapper.get('[data-testid="multi-facility-apply"]').trigger("click");
    expect(modalController.dismiss).toHaveBeenCalledWith({ facilityIds: ["BROADWAY", "BROOKLYN"] });

    await wrapper.get('[data-testid="multi-facility-cancel"]').trigger("click");
    expect(modalController.dismiss).toHaveBeenLastCalledWith();
    wrapper.unmount();
  });
});
