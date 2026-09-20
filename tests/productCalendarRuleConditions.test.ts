import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@common", () => ({
  translate: (label: string) => label,
}));

vi.mock("@ionic/vue", () => ({
  IonButton: defineComponent({ template: "<button><slot /></button>" }),
  IonCard: defineComponent({ template: "<section><slot /></section>" }),
  IonCardContent: defineComponent({ template: "<div><slot /></div>" }),
  IonCardHeader: defineComponent({ template: "<header><slot /></header>" }),
  IonCardSubtitle: defineComponent({ template: "<p><slot /></p>" }),
  IonCardTitle: defineComponent({ template: "<h2><slot /></h2>" }),
  IonIcon: defineComponent({ template: "<i />" }),
  IonItem: defineComponent({ template: "<div><slot /></div>" }),
  IonLabel: defineComponent({ template: "<label><slot /></label>" }),
  IonList: defineComponent({ template: "<div><slot /></div>" }),
  IonNote: defineComponent({ template: "<small><slot /></small>" }),
  IonInput: defineComponent({
    props: ["value"],
    emits: ["ionInput"],
    template: '<input :value="value" @input="$emit(\'ionInput\', { detail: { value: $event.target.value } })" />',
  }),
  IonSelect: defineComponent({
    props: ["value"],
    emits: ["ionChange"],
    template: '<select :value="value" @change="$emit(\'ionChange\', { detail: { value: $event.target.value } })"><slot /></select>',
  }),
  IonSelectOption: defineComponent({
    props: ["value"],
    template: '<option :value="value"><slot /></option>',
  }),
  modalController: { create: vi.fn() },
}));

import ProductCalendarRuleConditions from "../src/components/ProductCalendarRuleConditions.vue";

const condition = {
  conditionSeqId: "02",
  conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
  fieldName: "releaseDate",
  operator: "less-than-equal-to",
  fieldValue: "14",
};

describe("ProductCalendarRuleConditions", () => {
  it("edits a calendar condition inline as a left-to-right sentence", async () => {
    const wrapper = mount(ProductCalendarRuleConditions, {
      props: { conditions: [condition] },
    });

    expect(wrapper.findAll("select")).toHaveLength(3);
    expect(wrapper.find("input").element.value).toBe("14");

    await wrapper.findAll("select")[2].setValue("greater-than");

    expect(wrapper.emitted("update:conditions")?.at(-1)).toEqual([[
      { ...condition, operator: "greater-than" },
    ]]);
  });

  it("appends another inline condition row without opening a modal", async () => {
    const wrapper = mount(ProductCalendarRuleConditions, {
      props: { conditions: [condition] },
    });

    const addCondition = wrapper.findAll("button").find((button) => button.text() === "Add condition");
    expect(addCondition).toBeDefined();
    await addCondition?.trigger("click");

    expect(wrapper.emitted("update:conditions")?.at(-1)).toEqual([[
      condition,
      {
        conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
        fieldName: "releaseDate",
        operator: "less-than",
        fieldValue: "14",
      },
    ]]);
  });
});
