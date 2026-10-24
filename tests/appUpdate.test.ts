import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
const reload = vi.fn();
const overlay = vi.hoisted(() => ({ create: vi.fn(), present: vi.fn(), dismissed: vi.fn(), modal: vi.fn(), loading: vi.fn() }));
vi.mock("@ionic/vue", () => ({ alertController: { create: overlay.create }, modalController: { getTop: overlay.modal }, loadingController: { getTop: overlay.loading } }));
vi.mock("@common", () => ({ translate: (value: string) => value }));
import { useAppUpdateStore } from "@/store/appUpdate";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => { reload.mockReset(); overlay.modal.mockReset(); overlay.loading.mockReset(); vi.stubGlobal("window", { location: { reload } }); setActivePinia(createPinia()); overlay.create.mockReset().mockResolvedValue({ present: overlay.present, onDidDismiss: overlay.dismissed }); overlay.dismissed.mockReset().mockResolvedValue({ role: "cancel" }); });
describe("safe frontend update", () => {
  it("does not reload through an open editor or active loader", async () => {
    const store = useAppUpdateStore(); store.availableBuildId = "next";
    overlay.modal.mockResolvedValue({}); await store.requestUpdate();
    expect(overlay.create).not.toHaveBeenCalled();
    overlay.modal.mockResolvedValue(undefined); overlay.loading.mockResolvedValue({});
    await store.requestUpdate(); expect(overlay.create).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("reloads only when the user confirms and no blocker exists", async () => {
    const store = useAppUpdateStore(); store.availableBuildId = "next";
    overlay.dismissed.mockResolvedValue({ role: "confirm" });
    await store.requestUpdate(); expect(reload).toHaveBeenCalledOnce();
  });
  it("does not offer reload without an update or while any editor owns a blocker", async () => {
    const store = useAppUpdateStore(); await store.requestUpdate(); expect(overlay.create).not.toHaveBeenCalled();
    store.availableBuildId = "next";
    const first = Symbol(), second = Symbol(); store.setBlocked(first, true); store.setBlocked(second, true);
    store.setBlocked(first, false); await store.requestUpdate(); expect(overlay.create).not.toHaveBeenCalled();
    store.setBlocked(second, false); await store.requestUpdate(); expect(overlay.create).toHaveBeenCalledOnce();
    expect(store.confirming).toBe(false); expect(reload).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and prevents concurrent confirmation dialogs", async () => {
    const store = useAppUpdateStore(); store.availableBuildId = "next";
    let resolve: (v: any) => void = () => {};
    overlay.dismissed.mockReturnValue(new Promise(r => { resolve = r; }));
    const pending = store.requestUpdate(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await store.requestUpdate(); expect(overlay.create).toHaveBeenCalledOnce();
    resolve({ role: "cancel" }); await pending; expect(store.confirming).toBe(false); expect(reload).not.toHaveBeenCalled();
  });
  it("rechecks work started during confirmation", async () => {
    const store = useAppUpdateStore(); store.availableBuildId = "next";
    overlay.dismissed.mockImplementation(async () => { store.setBlocked(Symbol(), true); return { role: "confirm" }; });
    await store.requestUpdate(); expect(store.blocked).toBe(true); expect(store.confirming).toBe(false); expect(reload).not.toHaveBeenCalled();
  });
});
