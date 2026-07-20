import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("FacilityGroups view", () => {
  const fetchGroups = vi.fn();
  const groups = [
    {
      facilityGroupId: "OnlineFacilityGroup",
      facilityGroupName: "Online Facility Group",
      facilityGroupTypeId: "BROKERING_GROUP",
    },
    {
      facilityGroupId: "FULFILLMENT_TEST",
      facilityGroupName: "Fulfillment Test",
      facilityGroupTypeId: "FULFILLMENT",
    },
  ];

  beforeEach(() => {
    vi.resetModules();
    fetchGroups.mockReset();
    fetchGroups.mockResolvedValue(undefined);

    vi.doMock("@common", () => ({
      commonUtil: { showToast: vi.fn() },
      logger: { error: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("@/components/CreateUpdateFacilityGroupModal.vue", () => ({
      default: defineComponent({ name: "CreateUpdateFacilityGroupModal", template: "<div />" }),
    }));
    vi.doMock("@/components/EmptyState.vue", () => ({
      default: defineComponent({ name: "EmptyState", template: "<div><slot /><slot name='actions' /></div>" }),
    }));
    vi.doMock("@/components/ManageFacilityGroupFacilitiesModal.vue", () => ({
      default: defineComponent({ name: "ManageFacilityGroupFacilitiesModal", template: "<div />" }),
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({
        getCurrentProductStore: { productStoreId: "STORE" },
      }),
    }));
    vi.doMock("@/store/facilityGroupStore", () => ({
      useFacilityGroupStore: () => ({
        $patch: vi.fn(),
        archiveGroup: vi.fn(),
        fetchGroups,
        getGroupFacilities: () => [],
        getGroupTypes: [
          { facilityGroupTypeId: "BROKERING_GROUP", description: "Brokering" },
          { facilityGroupTypeId: "FULFILLMENT", description: "Fulfillment" },
        ],
        getGroups: groups,
      }),
    }));
    vi.doMock("@ionic/vue", () => ({
      alertController: { create: vi.fn() },
      IonButton: defineComponent({ name: "IonButton", template: "<button><slot /></button>" }),
      IonButtons: defineComponent({ name: "IonButtons", template: "<div><slot /></div>" }),
      IonCard: defineComponent({ name: "IonCard", template: "<article><slot /></article>" }),
      IonCardHeader: defineComponent({ name: "IonCardHeader", template: "<header><slot /></header>" }),
      IonCardSubtitle: defineComponent({ name: "IonCardSubtitle", template: "<p><slot /></p>" }),
      IonCardTitle: defineComponent({ name: "IonCardTitle", template: "<h2><slot /></h2>" }),
      IonChip: defineComponent({ name: "IonChip", template: "<span><slot /></span>" }),
      IonContent: defineComponent({ name: "IonContent", template: "<main><slot /></main>" }),
      IonFab: defineComponent({ name: "IonFab", template: "<div><slot /></div>" }),
      IonFabButton: defineComponent({ name: "IonFabButton", template: "<button><slot /></button>" }),
      IonHeader: defineComponent({ name: "IonHeader", template: "<header><slot /></header>" }),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: defineComponent({ name: "IonItem", template: "<div><slot /></div>" }),
      IonLabel: defineComponent({ name: "IonLabel", template: "<span><slot /></span>" }),
      IonMenuButton: defineComponent({ name: "IonMenuButton", template: "<button />" }),
      IonPage: defineComponent({ name: "IonPage", template: "<section><slot /></section>" }),
      IonSearchbar: defineComponent({ name: "IonSearchbar", template: "<input />" }),
      IonTitle: defineComponent({ name: "IonTitle", template: "<h1><slot /></h1>" }),
      IonToolbar: defineComponent({ name: "IonToolbar", template: "<div><slot /></div>" }),
      modalController: { create: vi.fn() },
    }));
  });

  it("loads and renders all product-store facility group types", async () => {
    const { default: FacilityGroups } = await import("../src/views/FacilityGroups.vue");

    const wrapper = mount(FacilityGroups);
    await flushPromises();
    await nextTick();

    expect(fetchGroups).toHaveBeenCalledWith({ productStoreId: "STORE" });
    expect(fetchGroups).not.toHaveBeenCalledWith(expect.objectContaining({ facilityGroupTypeId: "BROKERING_GROUP" }));
    expect(wrapper.text()).toContain("Online Facility Group");
    expect(wrapper.text()).toContain("Fulfillment Test");
  });
});
