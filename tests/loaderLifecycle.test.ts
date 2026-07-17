import { describe, expect, it, vi } from "vitest";

vi.mock("@common", () => ({
  commonUtil: {},
  emitter: {},
  translate: (message: string) => message
}));
vi.mock("@common/composables/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/store/userStore", () => ({ useUserStore: vi.fn() }));
vi.mock("@/store/atpProductStore", () => ({ useAtpProductStore: vi.fn() }));
vi.mock("@/store/productStore", () => ({ productStore: vi.fn() }));
vi.mock("@/utils/simConfig", () => ({ isFeatureEnabled: vi.fn() }));
vi.mock("@/router", () => ({ default: {} }));

import { createGlobalLoaderLifecycle } from "../src/App.vue";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeOverlay(presentPromise: Promise<void> = Promise.resolve()) {
  const didDismiss = deferred<unknown>();
  return {
    present: vi.fn(() => presentPromise),
    dismiss: vi.fn(async () => {
      didDismiss.resolve(undefined);
      return true;
    }),
    remove: vi.fn(() => didDismiss.resolve(undefined)),
    onDidDismiss: vi.fn(() => didDismiss.promise),
    userDismiss: () => didDismiss.resolve(undefined)
  };
}

describe("global loader lifecycle", () => {
  it("keeps the replacement active when the older concurrent request dismisses", async () => {
    const firstPresent = deferred<void>();
    const first = fakeOverlay(firstPresent.promise);
    const second = fakeOverlay();
    const createOverlay = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const lifecycle = createGlobalLoaderLifecycle(createOverlay, (message) => message);

    const firstReady = lifecycle.present({ message: "First", backdropDismiss: false });
    await vi.waitFor(() => expect(first.present).toHaveBeenCalledOnce());

    await lifecycle.present({ message: "Second", backdropDismiss: false });
    lifecycle.dismiss();

    // The first request's dismiss releases only its ownership. The current second loader stays.
    expect(second.dismiss).not.toHaveBeenCalled();

    firstPresent.resolve();
    await firstReady;

    // Ionic may ignore the first dismiss during present, so the stale overlay is retried after
    // its animation settles. That retry remains scoped to the first overlay by identity.
    expect(first.dismiss).toHaveBeenCalledTimes(2);
    expect(second.dismiss).not.toHaveBeenCalled();

    lifecycle.dismiss();
    await Promise.resolve();
    expect(second.dismiss).toHaveBeenCalledOnce();
  });

  it("cannot install an older loader whose creation resolves after its replacement", async () => {
    const firstCreate = deferred<ReturnType<typeof fakeOverlay>>();
    const first = fakeOverlay();
    const second = fakeOverlay();
    const createOverlay = vi.fn()
      .mockImplementationOnce(() => firstCreate.promise)
      .mockResolvedValueOnce(second);
    const lifecycle = createGlobalLoaderLifecycle(createOverlay, (message) => message);

    const firstReady = lifecycle.present({ message: "First" });
    await lifecycle.present({ message: "Second" });

    firstCreate.resolve(first);
    await firstReady;

    expect(first.present).not.toHaveBeenCalled();
    expect(first.remove).toHaveBeenCalledOnce();

    lifecycle.dismiss();
    expect(second.dismiss).not.toHaveBeenCalled();
    lifecycle.dismiss();
    await Promise.resolve();
    expect(second.dismiss).toHaveBeenCalledOnce();
  });

  it("coalesces message-less concurrent callers until all owners dismiss", async () => {
    const overlay = fakeOverlay();
    const createOverlay = vi.fn().mockResolvedValue(overlay);
    const lifecycle = createGlobalLoaderLifecycle(createOverlay, (message) => message);

    const firstReady = lifecycle.present();
    const secondReady = lifecycle.present();
    await Promise.all([firstReady, secondReady]);

    expect(createOverlay).toHaveBeenCalledOnce();
    expect(overlay.present).toHaveBeenCalledOnce();

    lifecycle.dismiss();
    expect(overlay.dismiss).not.toHaveBeenCalled();
    lifecycle.dismiss();
    await Promise.resolve();
    expect(overlay.dismiss).toHaveBeenCalledOnce();
  });

  it("does not let a stale caller dismiss the replacement after a backdrop dismissal", async () => {
    const first = fakeOverlay();
    const second = fakeOverlay();
    const createOverlay = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const lifecycle = createGlobalLoaderLifecycle(createOverlay, (message) => message);

    await lifecycle.present({ message: "First", backdropDismiss: true });
    first.userDismiss();
    await Promise.resolve();

    await lifecycle.present({ message: "Second", backdropDismiss: false });

    // The first operation finishes after its backdrop-dismissed overlay has been replaced. Its
    // release must consume only its own outstanding ownership, leaving the second overlay visible.
    lifecycle.dismiss();
    expect(second.dismiss).not.toHaveBeenCalled();

    lifecycle.dismiss();
    await Promise.resolve();
    expect(second.dismiss).toHaveBeenCalledOnce();
  });
});
