import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";

describe("ChannelSwitcherModal", () => {
  const modalDismiss = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    modalDismiss.mockReset();

    vi.doMock("@common", () => ({ translate: (label: string) => label }));
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
      IonNote: defineComponent({ name: "IonNote", template: "<small><slot /></small>" }),
      IonRadio: defineComponent({ name: "IonRadio", props: ["value"], template: "<label><slot /></label>" }),
      IonRadioGroup: defineComponent({ name: "IonRadioGroup", props: ["value"], template: "<div><slot /></div>" }),
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

  async function mountModal() {
    const { default: ChannelSwitcherModal } = await import("../src/components/ChannelSwitcherModal.vue");
    const wrapper = mount(ChannelSwitcherModal, {
      props: {
        currentChannelId: "AMAZON_FAC_GRP",
        channels: [
          { facilityGroupId: "AMAZON_FAC_GRP", facilityGroupName: "Amazon", selectedConfigFacility: { facilityId: "CONFIGURATION" } },
          { facilityGroupId: "FAC_GRP", facilityGroupName: "Online Facility Group" },
        ],
      },
    });
    await nextTick();

    return wrapper;
  }

  it("keeps channels without a configuration facility selectable", async () => {
    const wrapper = await mountModal();
    const missingConfigRow = wrapper.findAll(".ion-item").find((row) => row.text().includes("Online Facility Group"));

    expect(missingConfigRow?.text()).toContain("No configuration facility");
    await missingConfigRow?.trigger("click");

    expect(modalDismiss).toHaveBeenCalledWith({ channelId: "FAC_GRP" });
  });

  it("filters by channel name or id", async () => {
    const wrapper = await mountModal();
    await wrapper.find("input").setValue("amazon");
    await nextTick();

    expect(wrapper.text()).toContain("Amazon");
    expect(wrapper.text()).not.toContain("Online Facility Group");
  });
});
