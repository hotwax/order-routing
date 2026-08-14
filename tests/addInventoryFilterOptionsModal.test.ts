import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dismiss: vi.fn() }));

vi.mock("@common", () => ({
  translate: (label: string) => label,
}));

vi.mock("@/store/utilStore", () => ({
  useUtilStore: () => ({
    getEnums: {
      INV_FILTER_PRM_TYPE: {
        IFP_IGNORE_ORD_FAC_LIMIT: {
          enumId: "IFP_IGNORE_ORD_FAC_LIMIT",
          enumCode: "ignoreFacilityOrderLimit",
          description: "Override facility order limit",
        },
      },
    },
  }),
}));

vi.mock("@ionic/vue", () => ({
  IonButton: defineComponent({ template: "<button><slot /></button>" }),
  IonButtons: defineComponent({ template: "<div><slot /></div>" }),
  IonCheckbox: defineComponent({
    emits: ["ionChange"],
    template: '<button class="condition" @click="$emit(\'ionChange\')"><slot /></button>',
  }),
  IonContent: defineComponent({ template: "<main><slot /></main>" }),
  IonFab: defineComponent({ template: "<div><slot /></div>" }),
  IonFabButton: defineComponent({ template: '<button class="save"><slot /></button>' }),
  IonHeader: defineComponent({ template: "<header><slot /></header>" }),
  IonIcon: defineComponent({ template: "<span />" }),
  IonItem: defineComponent({ template: "<div><slot /></div>" }),
  IonLabel: defineComponent({ template: "<span><slot /></span>" }),
  IonList: defineComponent({ template: "<div><slot /></div>" }),
  IonNote: defineComponent({ template: "<span><slot /></span>" }),
  IonPage: defineComponent({ template: "<div><slot /></div>" }),
  IonTitle: defineComponent({ template: "<h1><slot /></h1>" }),
  IonToolbar: defineComponent({ template: "<div><slot /></div>" }),
  modalController: { dismiss: mocks.dismiss },
}));

import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";

describe("AddInventoryFilterOptionsModal", () => {
  beforeEach(() => {
    mocks.dismiss.mockReset();
  });

  it("stores the facility order limit override as a fixed true condition", async () => {
    const wrapper = mount(AddInventoryFilterOptionsModal, {
      props: {
        routingRuleId: "RULE-1",
        ruleConditions: {},
        parentEnumId: "INV_FILTER_PRM_TYPE",
        conditionTypeEnumId: "ENTCT_FILTER",
        label: "Filters",
        filterOptions: {},
      },
    });
    await flushPromises();

    await wrapper.get("button.condition").trigger("click");
    await wrapper.get("button.save").trigger("click");

    expect(mocks.dismiss).toHaveBeenCalledWith({
      dismissed: true,
      filters: {
        ignoreFacilityOrderLimit: expect.objectContaining({
          routingRuleId: "RULE-1",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "ignoreFacilityOrderLimit",
          fieldValue: "Y",
          operator: "equals",
        }),
      },
    }, "save");
  });

  it("normalizes a legacy false row to the presence-based override when selected", async () => {
    const wrapper = mount(AddInventoryFilterOptionsModal, {
      props: {
        routingRuleId: "RULE-1",
        ruleConditions: {
          ignoreFacilityOrderLimit: {
            routingRuleId: "RULE-1",
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "ignoreFacilityOrderLimit",
            fieldValue: "N",
            operator: "equals",
          },
        },
        parentEnumId: "INV_FILTER_PRM_TYPE",
        conditionTypeEnumId: "ENTCT_FILTER",
        label: "Filters",
        filterOptions: {},
      },
    });
    await flushPromises();

    await wrapper.get("button.condition").trigger("click");
    await wrapper.get("button.save").trigger("click");

    expect(mocks.dismiss).toHaveBeenCalledWith(expect.objectContaining({
      filters: {
        ignoreFacilityOrderLimit: expect.objectContaining({ fieldValue: "Y" }),
      },
    }), "save");
  });
});
