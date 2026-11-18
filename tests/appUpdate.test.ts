import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { reactive, markRaw } from "vue";

const mocks = vi.hoisted(() => ({
  user: null as any,
  register: vi.fn(),
  reload: vi.fn()
}));

vi.mock("@/store/userStore", () => ({ useUserStore: () => mocks.user }));
vi.mock("@common", () => ({ translate: (v: string) => v }));
vi.mock("register-service-worker", () => ({ register: mocks.register }));
vi.mock("@ionic/vue", () => ({
  IonButton: { props: ["disabled"], template: '<button :disabled="disabled"><slot /></button>' }
}));

import AppVersion from "@/components/DxpAppVersionInfo.vue";
import { registerAppServiceWorker } from "@/registerServiceWorker";

let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = reactive({
    pwaState: { updateExists: true, registration: null },
    get getPwaState() { return this.pwaState; },
    updatePwaState(v: any) { Object.assign(this.pwaState, v); }
  });
  vi.stubGlobal("window", { Event: window.Event, MouseEvent: window.MouseEvent, location: { reload: mocks.reload } });
  wrapper = mount(AppVersion);
});

afterEach(() => {
  wrapper.unmount();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("renders Update button when updateExists is true and triggers SKIP_WAITING and reload on click", async () => {
  const worker = { postMessage: vi.fn() };
  mocks.user.pwaState.registration = markRaw({ waiting: worker });

  expect(wrapper.find("button").exists()).toBe(true);
  await wrapper.get("button").trigger("click");
  await flushPromises();

  expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  expect(mocks.user.pwaState.updateExists).toBe(false);
  expect(mocks.reload).toHaveBeenCalledOnce();
});

it("registers service worker in production and updates pwaState when updated", () => {
  vi.stubEnv("PROD", true);
  vi.stubGlobal("navigator", { serviceWorker: {} });

  mocks.user.pwaState.updateExists = false;
  registerAppServiceWorker();

  expect(mocks.register).toHaveBeenCalledOnce();
  const hooks = mocks.register.mock.calls[0][1];
  const mockRegistration = { waiting: {} };
  hooks.updated(mockRegistration);

  expect(mocks.user.pwaState.updateExists).toBe(true);
});
