import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GroupActionsPopover", () => {
  const alertCreate = vi.fn();
  const alertPresent = vi.fn();
  const popoverDismiss = vi.fn();
  const scheduleBrokering = vi.fn();
  const updateGroupStatus = vi.fn();
  const runNow = vi.fn();
  const showToast = vi.fn();

  const passthroughComponent = (name: string) => defineComponent({
    name,
    template: "<div><slot /></div>",
  });

  const ionItem = defineComponent({
    name: "IonItem",
    props: {
      button: Boolean,
      disabled: Boolean,
      lines: String,
    },
    emits: ["click"],
    // Keep emitting clicks while disabled so tests exercise the handler guard,
    // rather than relying only on the Ionic control to suppress the event.
    template: '<button class="ion-item" type="button" :data-disabled="String(disabled)" @click="$emit(\'click\')"><slot /></button>',
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    alertCreate.mockImplementation(async () => ({ present: alertPresent }));
    scheduleBrokering.mockResolvedValue({ data: { jobName: "job" } });
    updateGroupStatus.mockResolvedValue([]);
    runNow.mockResolvedValue({ data: { jobRunId: "run" } });

    vi.doMock("@common", () => ({
      commonUtil: {
        hasError: () => false,
        showToast,
      },
      logger: { error: vi.fn() },
      translate: (label: string) => label,
    }));
    vi.doMock("@/store/orderRoutingStore", () => ({
      orderRoutingStore: () => ({
        runNow,
        scheduleBrokering,
        updateGroupStatus,
      }),
    }));
    vi.doMock("ionicons/icons", () => ({
      flashOutline: "flash",
      pauseOutline: "pause",
      playOutline: "play",
    }));
    vi.doMock("@ionic/vue", () => ({
      alertController: { create: alertCreate },
      IonContent: passthroughComponent("IonContent"),
      IonIcon: defineComponent({ name: "IonIcon", template: "<span />" }),
      IonItem: ionItem,
      IonLabel: passthroughComponent("IonLabel"),
      IonList: passthroughComponent("IonList"),
      IonListHeader: passthroughComponent("IonListHeader"),
      popoverController: { dismiss: popoverDismiss },
    }));
  });

  async function mountPopover(group: Record<string, unknown>) {
    const { default: GroupActionsPopover } = await import("../src/components/GroupActionsPopover.vue");
    return mount(GroupActionsPopover, { props: { group } });
  }

  it.each([
    {
      group: {
        groupName: "New group",
        isNew: true,
        routingGroupId: "new-group",
        schedule: { paused: "N" },
      },
      statusAction: "Move to Draft",
      message: "Save this routing group before using quick actions.",
    },
    {
      group: {
        groupName: "Dirty group",
        hasUnsavedChanges: true,
        routingGroupId: "dirty-group",
        schedule: { paused: "Y" },
      },
      statusAction: "Activate",
      message: "Save or discard changes before using quick actions.",
    },
  ])("disables and guards Run Now and $statusAction for local or dirty groups", async ({ group, statusAction, message }) => {
    const wrapper = await mountPopover(group);
    const items = wrapper.findAll(".ion-item");
    const runItem = items.find((item) => item.text().includes("Run now"));
    const statusItem = items.find((item) => item.text().includes(statusAction));

    expect(wrapper.text()).toContain(message);
    expect(runItem?.attributes("data-disabled")).toBe("true");
    expect(statusItem?.attributes("data-disabled")).toBe("true");

    await runItem?.trigger("click");
    await statusItem?.trigger("click");
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith(message);
    expect(alertCreate).not.toHaveBeenCalled();
    expect(scheduleBrokering).not.toHaveBeenCalled();
    expect(updateGroupStatus).not.toHaveBeenCalled();
    expect(runNow).not.toHaveBeenCalled();
    expect(popoverDismiss).not.toHaveBeenCalled();
  });

  it("rechecks the group before executing a confirmed Run Now action", async () => {
    let alertOptions: any;
    alertCreate.mockImplementation(async (options) => {
      alertOptions = options;
      return { present: alertPresent };
    });

    const group = {
      groupName: "Saved group",
      routingGroupId: "saved-group",
      schedule: { jobName: "saved-job", paused: "N" },
    };
    const wrapper = await mountPopover(group);
    const runItem = wrapper.findAll(".ion-item").find((item) => item.text().includes("Run now"));

    expect(runItem?.attributes("data-disabled")).toBe("false");
    await runItem?.trigger("click");
    await flushPromises();
    expect(alertCreate).toHaveBeenCalledOnce();

    await wrapper.setProps({ group: { ...group, hasUnsavedChanges: true } });
    const result = await alertOptions.buttons[1].handler();

    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Save or discard changes before using quick actions.");
    expect(scheduleBrokering).not.toHaveBeenCalled();
    expect(runNow).not.toHaveBeenCalled();
    expect(popoverDismiss).not.toHaveBeenCalled();
  });
});
