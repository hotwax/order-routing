import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dismiss = vi.hoisted(() => vi.fn());

vi.mock("@common", () => ({
  translate: (label: string) => label,
}));

vi.mock("@ionic/vue", () => ({
  IonButton: defineComponent({
    props: ["disabled"],
    template: '<button :disabled="disabled"><slot /></button>',
  }),
  IonButtons: defineComponent({ template: "<div><slot /></div>" }),
  IonContent: defineComponent({ template: "<main><slot /></main>" }),
  IonHeader: defineComponent({ template: "<header><slot /></header>" }),
  IonInput: defineComponent({ template: "<input />" }),
  IonItem: defineComponent({ template: "<div><slot /></div>" }),
  IonList: defineComponent({ template: "<div><slot /></div>" }),
  IonPage: defineComponent({ template: "<div><slot /></div>" }),
  IonSelect: defineComponent({ template: "<select><slot /></select>" }),
  IonSelectOption: defineComponent({ template: "<option><slot /></option>" }),
  IonTitle: defineComponent({ template: "<h1><slot /></h1>" }),
  IonToolbar: defineComponent({ template: "<div><slot /></div>" }),
  modalController: { dismiss },
}));

import ProductCalendarConditionModal from "../src/components/ProductCalendarConditionModal.vue";

describe("ProductCalendarConditionModal", () => {
  beforeEach(() => dismiss.mockReset());

  it("rejects the retired composite date-distance operators", async () => {
    const wrapper = mount(ProductCalendarConditionModal, {
      props: {
        condition: {
          conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
          fieldName: "releaseDate",
          operator: "days-since-less-than-equal-to",
          fieldValue: "14",
        },
      },
    });

    const apply = wrapper.findAll("button").find((button) => button.text() === "Apply condition");
    expect(apply?.attributes("disabled")).toBeDefined();
    await apply?.trigger("click");

    expect(dismiss).not.toHaveBeenCalled();
  });

  it("returns the PSP date direction with a standard comparison operator and integer threshold", async () => {
    const wrapper = mount(ProductCalendarConditionModal, {
      props: {
        condition: {
          conditionTypeEnumId: "ENTCT_PSP_DATE_TILL",
          fieldName: "salesDiscontinuationDate",
          operator: "greater-than-equal-to",
          fieldValue: 30,
        },
      },
    });

    const apply = wrapper.findAll("button").find((button) => button.text() === "Apply condition");
    expect(apply?.attributes("disabled")).toBeUndefined();
    await apply?.trigger("click");

    expect(dismiss).toHaveBeenCalledWith({
      dismissed: true,
      condition: {
        conditionTypeEnumId: "ENTCT_PSP_DATE_TILL",
        fieldName: "salesDiscontinuationDate",
        operator: "greater-than-equal-to",
        fieldValue: "30",
      },
    }, "save");
  });
});
