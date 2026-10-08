import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  enter: null as null | (() => Promise<void>),
  updateRuleApi: vi.fn(),
}));

vi.mock("@common", () => ({
  commonUtil: { hasError: vi.fn(), showToast: vi.fn() },
  emitter: { emit: vi.fn(), off: vi.fn(), on: vi.fn() },
  logger: { error: vi.fn() },
  translate: (label: string) => label,
}));

vi.mock("@ionic/vue", () => ({
  ...(() => {
    const stub = (name: string, template = "<div><slot /></div>") => defineComponent({ name, template });
    return {
      IonBackButton: stub("IonBackButton"),
      IonButton: stub("IonButton", "<button><slot /></button>"),
      IonCard: stub("IonCard"),
      IonCardContent: stub("IonCardContent"),
      IonCardHeader: stub("IonCardHeader"),
      IonCardSubtitle: stub("IonCardSubtitle"),
      IonCardTitle: stub("IonCardTitle"),
      IonCheckbox: stub("IonCheckbox"),
      IonChip: stub("IonChip"),
      IonContent: stub("IonContent"),
      IonFab: stub("IonFab"),
      IonFabButton: defineComponent({ name: "IonFabButton", props: ["disabled"], template: "<button :disabled=\"disabled\"><slot /></button>" }),
      IonHeader: stub("IonHeader"),
      IonIcon: stub("IonIcon"),
      IonInput: stub("IonInput"),
      IonItem: stub("IonItem"),
      IonLabel: stub("IonLabel"),
      IonNote: stub("IonNote"),
      IonPage: stub("IonPage"),
      IonSpinner: stub("IonSpinner"),
      IonText: stub("IonText"),
      IonTitle: stub("IonTitle"),
      IonToggle: stub("IonToggle"),
      IonToolbar: stub("IonToolbar"),
    };
  })(),
  modalController: { create: vi.fn() },
  onIonViewDidEnter: vi.fn((callback) => { state.enter = callback; }),
  onIonViewWillLeave: vi.fn(),
}));

vi.mock("@/components/ProductFilters.vue", () => ({ default: defineComponent({ name: "ProductFilters", template: "<div />" }) }));
vi.mock("@/components/ProductCalendarRuleConditions.vue", () => ({ default: defineComponent({ name: "ProductCalendarRuleConditions", template: "<div />" }) }));
vi.mock("@/components/EmptyState.vue", () => ({ default: defineComponent({ name: "EmptyState", template: "<div />" }) }));
vi.mock("@/components/FacilityGroupImpactModal.vue", () => ({ default: defineComponent({ name: "FacilityGroupImpactModal", template: "<div />" }) }));
vi.mock("@/components/CreateGroupModal.vue", () => ({ default: defineComponent({ name: "CreateGroupModal", template: "<div />" }) }));
vi.mock("@/components/CreateUpdateFacilityGroupModal.vue", () => ({ default: defineComponent({ name: "CreateUpdateFacilityGroupModal", template: "<div />" }) }));
vi.mock("@/components/LinkExistingGroupModal.vue", () => ({ default: defineComponent({ name: "LinkExistingGroupModal", template: "<div />" }) }));
vi.mock("@/components/AddProductFacilityGroupModal.vue", () => ({ default: defineComponent({ name: "AddProductFacilityGroupModal", template: "<div />" }) }));

vi.mock("@/store/userStore", () => ({ useUserStore: () => ({}) }));
vi.mock("@/store/atpProductStore", () => ({
  useAtpProductStore: () => ({
    getAppliedFilters: { included: { tags: [], productFeatures: [] }, excluded: { tags: [], productFeatures: [] } },
    getConfigFacilities: [],
    getCurrentProductStore: { productStoreId: "SANDBOX_STORE" },
    getFacilityGroups: [],
    getSelectedSegment: "RG_SHIPPING_FACILITY",
    clearAppliedFilters: vi.fn(),
    fetchConfigFacilities: vi.fn(() => Promise.resolve()),
    fetchFacilityGroups: vi.fn(() => Promise.resolve()),
  }),
}));
vi.mock("@/store/rule", () => ({ useRuleStore: () => ({
  clearRuleState: vi.fn(),
  fetchRulesDirect: vi.fn(() => Promise.resolve({ data: [{
    ruleActions: [],
    ruleConditions: [{
      conditionSeqId: "01",
      conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
      fieldName: "releaseDate",
      operator: "less-than-equal-to",
      fieldValue: "14",
    }],
    ruleId: "CAL_TEST_RULE",
    ruleName: "Release date under fourteen days",
  }] })),
  getRules: [],
  getTotalRulesCount: 0,
  updateRuleApi: state.updateRuleApi,
}) }));
vi.mock("@/utils/ruleUtil", () => ({ ruleUtil: {
  generateRuleActions: vi.fn(() => []),
  generateRuleConditions: vi.fn(() => []),
} }));
vi.mock("@/utils/legacyRuleCalendarConditions", () => ({
  buildLegacyRuleConditions: vi.fn(() => []),
  getProductStoreProductDateConditions: vi.fn(() => []),
  getRuleConditionsToRemove: vi.fn(() => []),
}));
vi.mock("@/router", () => ({ default: { push: vi.fn() } }));
vi.mock("@/composables/useFacilityGroupNetOutcome", () => ({
  useFacilityGroupNetOutcome: () => ({ isCounting: ref(false), netFacilityCount: ref(0) }),
}));

import CreateUpdateShippingRule from "../src/views/CreateUpdateShippingRule.vue";

describe("Edit shipping rule save availability", () => {
  beforeEach(() => {
    state.enter = null;
    state.updateRuleApi.mockReset();
    state.updateRuleApi.mockResolvedValue({});
  });

  it("keeps Save enabled for an existing rule when no facility groups remain to configure", () => {
    const wrapper = mount(CreateUpdateShippingRule, { props: { ruleId: "CAL_TEST_RULE" } });

    expect(wrapper.getComponent({ name: "IonFabButton" }).props("disabled")).toBe(false);
  });

  it("saves an existing date-only rule after its last calendar condition is cleared", async () => {
    const wrapper = mount(CreateUpdateShippingRule, { props: { ruleId: "CAL_TEST_RULE" } });

    await state.enter?.();
    await nextTick();
    await wrapper.getComponent({ name: "IonFabButton" }).trigger("click");

    expect(state.updateRuleApi).toHaveBeenCalledWith(expect.objectContaining({ ruleConditions: [] }), "CAL_TEST_RULE");
  });
});
