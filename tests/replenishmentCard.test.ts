import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@common", () => ({
  translate: (message: string, values: Record<string, string | number> = {}) => message.replace("{value}", String(values.value ?? "")),
}));

vi.mock("@ionic/vue", () => {
  const passthrough = (name: string, tag = "div") => defineComponent({
    name,
    inheritAttrs: false,
    template: `<${tag} v-bind="$attrs"><slot /></${tag}>`,
  });

  return {
    IonButton: defineComponent({
      name: "IonButton",
      inheritAttrs: false,
      props: { disabled: Boolean, href: String },
      emits: ["click"],
      template: '<button :disabled="disabled" :href="href" @click="$emit(\'click\')"><slot /></button>',
    }),
    IonCard: passthrough("IonCard", "article"),
    IonCardContent: passthrough("IonCardContent"),
    IonCardHeader: passthrough("IonCardHeader", "header"),
    IonCardTitle: passthrough("IonCardTitle", "h2"),
    IonChip: passthrough("IonChip"),
    IonInput: defineComponent({
      name: "IonInput",
      inheritAttrs: false,
      props: { disabled: Boolean, label: String, value: [String, Number] },
      emits: ["ionInput"],
      template: '<label><span>{{ label }}</span><input :aria-label="label" :disabled="disabled" :value="value ?? \'\'" @input="$emit(\'ionInput\', { detail: { value: $event.target.value } })" /></label>',
    }),
    IonItem: passthrough("IonItem"),
    IonLabel: passthrough("IonLabel", "span"),
    IonNote: passthrough("IonNote", "span"),
    IonSkeletonText: passthrough("IonSkeletonText"),
  };
});

import ReplenishmentCard from "../src/components/ReplenishmentCard.vue";

const defaultProps = {
  minimumStock: 4,
  salesVelocityUnitsPerDay: 1.5,
  incomingUnits: 8,
  incomingUnavailable: false,
  trendPoints: [],
  isLoading: false,
  isSaving: false,
  restockHref: null,
};

function mountCard(props: Record<string, unknown> = {}) {
  return mount(ReplenishmentCard, { props: { ...defaultProps, ...props } });
}

describe("ReplenishmentCard", () => {
  it("keeps nullable replenishment fields editable so a product facility can be completed", () => {
    const wrapper = mountCard({ incomingUnavailable: true });

    expect(wrapper.text()).toContain("Sales velocity: 1.5 units / day");
    expect(wrapper.text()).toContain("Incoming unavailable");
    expect(wrapper.text()).toContain("No ATP trend data available");
    expect(wrapper.text()).toContain("Restock setup is unavailable for this environment.");
    expect(wrapper.find('input[aria-label="Maximum stock"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.find('input[aria-label="Reorder quantity"]').attributes("disabled")).toBeUndefined();
  });

  it("saves only changed replenishment fields", async () => {
    const wrapper = mountCard({ maximumStock: null, reorderQuantity: 10 });

    await wrapper.find('input[aria-label="Reorder point"]').setValue("6");
    await wrapper.find('input[aria-label="Maximum stock"]').setValue("20");
    await wrapper.find('input[aria-label="Reorder quantity"]').setValue("12");
    await nextTick();

    const saveButton = wrapper.findAll("button").find((button) => button.text() === "Save changes");
    expect(saveButton?.attributes("disabled")).toBeUndefined();
    await saveButton?.trigger("click");

    expect(wrapper.emitted("save")).toEqual([[
      { minimumStock: 6, maximumStock: 20, reorderQuantity: 12 },
    ]]);
  });

  it("renders the ATP trend when inventory movements exist", () => {
    const wrapper = mountCard({
      trendPoints: [
        { timestamp: 1, atp: 5 },
        { timestamp: 2, atp: 9 },
      ],
    });

    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("No ATP trend data available");
  });
});
