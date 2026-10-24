import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { reactive, markRaw } from "vue";
const mocks = vi.hoisted(() => ({ user: null as any, route: { value: { name: "Settings" } }, modal: vi.fn(), loading: vi.fn(), register: vi.fn(), toast: vi.fn(), reload: vi.fn() }));
vi.mock("@/store/userStore", () => ({ useUserStore: () => mocks.user }));
vi.mock("@/router", () => ({ default: { currentRoute: mocks.route } }));
vi.mock("@common", () => ({ translate: (v: string) => v, commonUtil: { showToast: mocks.toast } }));
vi.mock("register-service-worker", () => ({ register: mocks.register }));
vi.mock("@ionic/vue", () => ({
  modalController: { getTop: mocks.modal }, loadingController: { getTop: mocks.loading },
  IonButton: { props: ["disabled"], template: '<button :disabled="disabled"><slot /></button>' }
}));
import AppVersion from "@/components/DxpAppVersionInfo.vue";
import { registerAppServiceWorker } from "@/registerServiceWorker";
let wrapper: ReturnType<typeof mount>;
beforeEach(() => {
  vi.clearAllMocks(); mocks.modal.mockResolvedValue(undefined); mocks.loading.mockResolvedValue(undefined);
  mocks.route.value.name = "Settings";
  mocks.user = reactive({ pwaState: { updateExists: true, registration: null }, get getPwaState() { return this.pwaState; }, updatePwaState(v: any) { Object.assign(this.pwaState, v); } });
  vi.stubGlobal("window", { Event: window.Event, MouseEvent: window.MouseEvent, location: { reload: mocks.reload } });
  wrapper = mount(AppVersion);
});
afterEach(() => { wrapper.unmount(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const clickUpdate = async () => { await wrapper.get("button").trigger("click"); await flushPromises(); };
const waitingWorker = () => {
  const worker = Object.assign(new EventTarget(), { state: "installed", postMessage: vi.fn() });
  mocks.user.pwaState.registration = markRaw({ waiting: worker });
  return worker;
};
it("reuses PWA state and Settings Update after another tab has activated", async () => {
  await clickUpdate(); expect(mocks.reload).toHaveBeenCalledOnce();
  mocks.user.pwaState.updateExists = false; await flushPromises(); expect(wrapper.find("button").exists()).toBe(false);
});
it("waits for activation and ignores duplicate Update clicks", async () => {
  const worker = waitingWorker(); await clickUpdate(); await clickUpdate();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  expect(mocks.reload).not.toHaveBeenCalled();
  worker.state = "activated"; worker.dispatchEvent(new Event("statechange")); await flushPromises();
  expect(mocks.reload).toHaveBeenCalledOnce();
});
it("refuses updates outside Settings and through open editors or loaders", async () => {
  mocks.route.value.name = "OrderRoutingDetail"; await clickUpdate();
  mocks.route.value.name = "Settings"; mocks.modal.mockResolvedValue({}); await clickUpdate();
  mocks.modal.mockResolvedValue(undefined); mocks.loading.mockResolvedValue({}); await clickUpdate();
  expect(mocks.reload).not.toHaveBeenCalled();
});
it("does not reload a draft opened while the worker activates", async () => {
  const worker = waitingWorker(); await clickUpdate(); mocks.route.value.name = "OrderRoutingDetail";
  worker.state = "activated"; worker.dispatchEvent(new Event("statechange")); await flushPromises();
  expect(mocks.reload).not.toHaveBeenCalled();
});
it("does not reload when worker installation fails", async () => {
  const worker = waitingWorker(); await clickUpdate();
  worker.state = "redundant"; worker.dispatchEvent(new Event("statechange")); await flushPromises();
  expect(mocks.reload).not.toHaveBeenCalled(); expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
});
it("worker notifications update existing PWA state without reloading other tabs", () => {
  vi.stubEnv("PROD", true); const events = new EventTarget(); vi.stubGlobal("navigator", { serviceWorker: events });
  mocks.user.pwaState.updateExists = false; registerAppServiceWorker(); const hooks = mocks.register.mock.calls[0][1];
  const registration = { waiting: {}, update: vi.fn() }; hooks.registered(registration); hooks.updated(registration);
  expect(mocks.user.pwaState.registration).toBe(registration);
  events.dispatchEvent(new Event("controllerchange")); expect(mocks.user.pwaState.updateExists).toBe(true);
  expect(mocks.reload).not.toHaveBeenCalled();
});
