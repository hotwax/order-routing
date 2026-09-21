import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@common", () => ({
  translate: (label: string) => label,
}));

vi.mock("@ionic/vue", () => ({
  IonButton: defineComponent({ template: "<button v-bind=\"$attrs\"><slot /></button>" }),
  IonCard: defineComponent({ template: "<section><slot /></section>" }),
  IonCardContent: defineComponent({ template: "<div><slot /></div>" }),
  IonCardHeader: defineComponent({ template: "<header><slot /></header>" }),
  IonCardSubtitle: defineComponent({ template: "<p><slot /></p>" }),
  IonCardTitle: defineComponent({ template: "<h2><slot /></h2>" }),
  IonIcon: defineComponent({ template: "<i v-bind=\"$attrs\" />" }),
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

    expect(wrapper.get("h1").text()).toBe("Products by date");
    expect(wrapper.findAll("select")).toHaveLength(3);
    expect(wrapper.find("input").element.value).toBe("14");

    await wrapper.findAll("select")[2].setValue("greater-than");

    expect(wrapper.emitted("update:conditions")?.at(-1)).toEqual([[
      { ...condition, operator: "greater-than" },
    ]]);
  });

  it("adds an editable draft row without adding a condition to the save payload", async () => {
    const wrapper = mount(ProductCalendarRuleConditions, {
      props: { conditions: [condition] },
    });

    const addCondition = wrapper.findAll("button").find((button) => button.text() === "Add condition");
    expect(addCondition).toBeDefined();
    expect(addCondition?.attributes("fill")).toBe("clear");
    expect(addCondition?.find('i[slot="end"]').exists()).toBe(true);
    await addCondition?.trigger("click");

    expect(wrapper.findAll("select")).toHaveLength(6);
    expect(wrapper.emitted("update:conditions")).toBeUndefined();
  });

  it("returns to an empty base row after removing the last condition", async () => {
    const wrapper = mount(ProductCalendarRuleConditions, {
      props: { conditions: [condition] },
    });

    await wrapper.get('button[aria-label="Remove calendar date condition"]').trigger("click");
    expect(wrapper.emitted("update:conditions")?.at(-1)).toEqual([[]]);

    await wrapper.setProps({ conditions: [] });
    expect(wrapper.findAll("select")).toHaveLength(3);
  });
});
