import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@common", () => ({
  translate: (message: string, values: Record<string, string | number> = {}) => message.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")),
  buildAppUrl: (_app: string, path: string) => `https://transfers.hotwax.io${path}`,
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
    IonContent: passthrough("IonContent"),
    IonHeader: passthrough("IonHeader"),
    IonInput: defineComponent({
      name: "IonInput",
      inheritAttrs: false,
      props: { disabled: Boolean, label: String, value: [String, Number] },
      emits: ["ionInput"],
      template: '<label><span>{{ label }}</span><input :aria-label="label" :disabled="disabled" :value="value ?? \'\'" @input="$emit(\'ionInput\', { detail: { value: $event.target.value } })" /></label>',
    }),
    IonItemDivider: passthrough("IonItemDivider"),
    IonItem: passthrough("IonItem"),
    IonLabel: passthrough("IonLabel", "span"),
    IonList: passthrough("IonList"),
    IonModal: defineComponent({
      name: "IonModal",
      inheritAttrs: false,
      props: { isOpen: Boolean },
      template: '<div v-if="isOpen" v-bind="$attrs"><slot /></div>',
    }),
    IonNote: passthrough("IonNote", "span"),
    IonPopover: defineComponent({
      name: "IonPopover",
      inheritAttrs: false,
      props: { event: Event, isOpen: Boolean },
      template: '<div v-if="isOpen" v-bind="$attrs"><slot /></div>',
    }),
    IonSkeletonText: passthrough("IonSkeletonText"),
    IonTitle: passthrough("IonTitle"),
    IonToolbar: passthrough("IonToolbar"),
  };
});

import ReplenishmentCard from "../src/components/ReplenishmentCard.vue";

const defaultProps = {
  productId: "PRODUCT_A",
  facilityId: "FACILITY_A",
  minimumStock: 4,
  salesVelocityUnitsPerDay: 1.5,
  incomingUnits: 8,
  incomingUnavailable: false,
  trendPoints: [],
  isLoading: false,
  isSaving: false,
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
    expect(wrapper.find('input[aria-label="Maximum stock"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.find('input[aria-label="Reorder quantity"]').attributes("disabled")).toBeUndefined();
  });

  it("places the enabled save action below replenishment inputs without an unavailable restock action", async () => {
    const wrapper = mountCard();

    await wrapper.find('input[aria-label="Reorder point"]').setValue("6");
    await nextTick();

    const inputs = wrapper.get(".replenishment-inputs");
    const saveAction = wrapper.get("[data-testid='replenishment-save']");

    expect(wrapper.get("header").findAll("button")).toHaveLength(0);
    expect(inputs.element.compareDocumentPosition(saveAction.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(saveAction.text()).toBe("Save changes");
    expect(wrapper.text()).not.toContain("Restock Inventory");
    expect(wrapper.text()).not.toContain("Restock setup is unavailable for this environment.");
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
        { timestamp: Date.parse("2026-08-20T00:00:00Z"), atp: 5 },
        { timestamp: Date.parse("2026-09-18T00:00:00Z"), atp: 9 },
      ],
    });

    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.text()).toContain("ATP history");
    expect(wrapper.text()).toContain("Last 30 days");
    expect(wrapper.text()).toContain("Latest ATP: 9");
    expect(wrapper.text()).not.toContain("No ATP trend data available");
  });

  it("keeps replenishment controls separate from the trend pane", () => {
    const wrapper = mountCard({
      trendPoints: [
        { timestamp: Date.parse("2026-08-20T00:00:00Z"), atp: 5 },
        { timestamp: Date.parse("2026-09-18T00:00:00Z"), atp: 9 },
      ],
    });

    const controls = wrapper.get("[data-testid='replenishment-controls']");
    const trend = wrapper.get("[data-testid='replenishment-trend']");

    expect(controls.text()).toContain("Sales velocity: 1.5 units / day");
    expect(controls.text()).toContain("Reorder point");
    expect(controls.find("svg").exists()).toBe(false);
    expect(trend.find("svg").exists()).toBe(true);
  });

  it("opens the approved sales breakdown and transfer-only inbound drill-down", async () => {
    const wrapper = mountCard({
      salesVelocityBreakdown: {
        inStoreUnits: 3,
        inStoreShipToHomeUnits: 2,
        onlineUnits: 5,
        totalUnits: 10,
        unitsPerDay: 10 / 30,
      },
      incomingTransfers: [{
        orderId: "TO100",
        orderName: "TO-100",
        sourceFacilityId: "SOURCE_STORE",
        units: 5,
      }],
      requestedTransfers: [{
        inventoryTransferId: "IT100",
        sourceFacilityId: "SOURCE_STORE",
        sourceFacilityName: "Source Store",
        units: 3,
      }],
      facilityNames: { SOURCE_STORE: "Source Store" },
    });

    await wrapper.get("[data-testid='sales-velocity-trigger']").trigger("click", { clientX: 400, clientY: 300 });
    expect(wrapper.get("[data-testid='sales-velocity-popover']").text()).toContain("In Store");
    expect(wrapper.text()).toContain("In Store Ship to Home");
    expect(wrapper.text()).toContain("Online");
    expect(wrapper.findComponent({ name: "IonPopover" }).props("event")).toMatchObject({ type: "click" });

    await wrapper.get("[data-testid='incoming-transfers-trigger']").trigger("click");
    const transferModal = wrapper.get("[data-testid='incoming-transfers-modal']");
    expect(transferModal.text()).toContain("Transfer orders");
    expect(transferModal.text()).toContain("Requested transfers");
    expect(transferModal.findAllComponents({ name: "IonItemDivider" })).toHaveLength(2);
    expect(transferModal.text()).toContain("TO-100");
    expect(transferModal.text()).toContain("IT100");
    expect(transferModal.text()).toContain("5 units");
    expect(transferModal.text()).toContain("3 units");
    expect(transferModal.text()).toContain("Source Store");
    expect(transferModal.findComponent({ name: "IonContent" }).exists()).toBe(true);
    expect(transferModal.find("strong").exists()).toBe(false);
    const transferLinks = transferModal.findAll("button").filter((button) => button.text() === "Open in Transfers");
    expect(transferLinks.map((button) => button.attributes("href"))).toEqual([
      "https://transfers.hotwax.io/order-detail/TO100",
      "https://transfers.hotwax.io/tabs/inventory-transfers",
    ]);
  });

  it("anchors the ATP axis at zero rather than the lowest movement balance", () => {
    const wrapper = mountCard({
      trendPoints: [
        { timestamp: Date.parse("2026-08-20T00:00:00Z"), atp: 205 },
        { timestamp: Date.parse("2026-09-18T00:00:00Z"), atp: 209 },
      ],
    });

    expect(wrapper.findAll(".chart-axis-label").map((label) => label.text())).toContain("0");
  });

  it("keeps the ATP axis maximum at five units for low-stock products", () => {
    const wrapper = mountCard({
      trendPoints: [
        { timestamp: Date.parse("2026-08-20T00:00:00Z"), atp: 1 },
        { timestamp: Date.parse("2026-09-18T00:00:00Z"), atp: 1 },
      ],
    });

    expect(wrapper.findAll(".chart-axis-label").map((label) => label.text())).toContain("5");
  });

  it("updates stock guides from unsaved replenishment values", async () => {
    const wrapper = mountCard({
      maximumStock: 10,
      trendPoints: [
        { timestamp: Date.parse("2026-08-20T00:00:00Z"), atp: 5 },
        { timestamp: Date.parse("2026-09-18T00:00:00Z"), atp: 9 },
      ],
    });

    expect(wrapper.text()).toContain("Reorder point: 4");
    expect(wrapper.text()).toContain("Maximum stock: 10");

    await wrapper.find('input[aria-label="Reorder point"]').setValue("6");
    await wrapper.find('input[aria-label="Maximum stock"]').setValue("12");
    await nextTick();

    expect(wrapper.text()).toContain("Reorder point: 6");
    expect(wrapper.text()).toContain("Maximum stock: 12");
  });

  it("clears drafts until each product or facility configuration arrives", async () => {
    const wrapper = mountCard({
      productId: "PRODUCT_A",
      facilityId: "FACILITY_A",
      maximumStock: 10,
      reorderQuantity: 8,
    });

    const reorderPoint = wrapper.get('input[aria-label="Reorder point"]');
    const maximumStock = wrapper.get('input[aria-label="Maximum stock"]');
    const reorderQuantity = wrapper.get('input[aria-label="Reorder quantity"]');
    await reorderPoint.setValue("6");
    await maximumStock.setValue("12");
    await reorderQuantity.setValue("10");
    await wrapper.setProps({ productId: "PRODUCT_B" });

    expect((reorderPoint.element as HTMLInputElement).value).toBe("");
    expect((maximumStock.element as HTMLInputElement).value).toBe("");
    expect((reorderQuantity.element as HTMLInputElement).value).toBe("");

    await wrapper.setProps({ minimumStock: 3, maximumStock: 9, reorderQuantity: 6 });
    expect((reorderPoint.element as HTMLInputElement).value).toBe("3");
    expect((maximumStock.element as HTMLInputElement).value).toBe("9");
    expect((reorderQuantity.element as HTMLInputElement).value).toBe("6");

    await reorderPoint.setValue("7");
    await maximumStock.setValue("11");
    await reorderQuantity.setValue("8");
    await wrapper.setProps({ facilityId: "FACILITY_B" });

    expect((reorderPoint.element as HTMLInputElement).value).toBe("");
    expect((maximumStock.element as HTMLInputElement).value).toBe("");
    expect((reorderQuantity.element as HTMLInputElement).value).toBe("");
  });
});
