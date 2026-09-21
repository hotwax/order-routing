import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";
import { calendarOutline } from "ionicons/icons";

vi.mock("@common", () => ({
  commonUtil: { showToast: vi.fn() },
  emitter: { emit: vi.fn() },
  logger: { error: vi.fn() },
  translate: (label: string) => label,
}));

vi.mock("@/router", () => ({
  default: { currentRoute: { value: { path: "/shipping", name: "Shipping" } }, push: vi.fn() },
}));

vi.mock("@/store/rule", () => ({
  useRuleStore: () => ({ getTotalRulesCount: 1, isReorderActive: false }),
}));

vi.mock("@/store/atpProductStore", () => ({
  useAtpProductStore: () => ({
    getConfigFacilities: [],
    getCurrentProductStore: { productStoreId: "SANDBOX_STORE" },
    getFacilityGroups: [],
    getSelectedSegment: "",
  }),
}));

vi.mock("@/utils/productCalendarNavigation", () => ({ productCalendarHref: () => null }));

vi.mock("@ionic/vue", () => ({
  IonAccordion: defineComponent({ name: "IonAccordion", template: "<section><slot /></section>" }),
  IonAccordionGroup: defineComponent({ name: "IonAccordionGroup", template: "<section><slot /></section>" }),
  IonButton: defineComponent({ name: "IonButton", template: "<button><slot /></button>" }),
  IonCard: defineComponent({ name: "IonCard", template: "<article><slot /></article>" }),
  IonCardHeader: defineComponent({ name: "IonCardHeader", template: "<header><slot /></header>" }),
  IonCardSubtitle: defineComponent({ name: "IonCardSubtitle", template: "<p><slot /></p>" }),
  IonCardTitle: defineComponent({ name: "IonCardTitle", template: "<h2><slot /></h2>" }),
  IonChip: defineComponent({ name: "IonChip", template: "<span><slot /></span>" }),
  IonIcon: defineComponent({ name: "IonIcon", props: ["icon"], template: "<i />" }),
  IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
  IonItemDivider: defineComponent({ name: "IonItemDivider", template: "<div><slot /></div>" }),
  IonLabel: defineComponent({ name: "IonLabel", template: "<label><slot /></label>" }),
  IonReorder: defineComponent({ name: "IonReorder", template: "<span />" }),
  IonToggle: defineComponent({ name: "IonToggle", template: "<input type=\"checkbox\" />" }),
  alertController: { create: vi.fn() },
}));

import RuleItem from "../src/components/RuleItem.vue";

describe("RuleItem product calendar condition", () => {
  it("uses the calendar icon for a product calendar date", () => {
    const wrapper = mount(RuleItem, {
      props: {
        ruleIndex: 0,
        rule: {
          ruleId: "CAL_TEST_RULE",
          ruleName: "Release date under fourteen days",
          ruleActions: [{ fieldValue: "Y" }],
          ruleConditions: [{
            conditionSeqId: "01",
            conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
            fieldName: "releaseDate",
            operator: "less-than-equal-to",
            fieldValue: "14",
          }],
        },
      },
    });

    const calendarCondition = wrapper.findAllComponents({ name: "IonItem" })
      .find((item) => item.text().includes("Launch date"));

    expect(calendarCondition?.getComponent({ name: "IonIcon" }).props("icon")).toBe(calendarOutline);
  });
});
