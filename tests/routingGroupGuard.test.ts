import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@common/composables/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: { value: true } }),
}));

import router from "../src/router";
import { orderRoutingStore } from "../src/store/orderRoutingStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("routing group direct-entry guard", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("does not finish navigation before the routing-group lookup calls next", async () => {
    const store = orderRoutingStore();
    const lookup = deferred<boolean>();
    store.groups = [];
    store.fetchOrderRoutingGroups = vi.fn(async () => {
      const loaded = await lookup.promise;
      store.groups = [{ routingGroupId: "PRE_ORDER_GROUP" }] as any;
      return loaded;
    }) as any;
    const route = router.getRoutes().find((record) => record.path === "/order-routing/:routingGroupId");
    expect(route?.beforeEnter).toBeTruthy();
    const next = vi.fn();

    const guardResult = (route!.beforeEnter as any)(
      { params: { routingGroupId: "PRE_ORDER_GROUP" }, fullPath: "/order-routing/PRE_ORDER_GROUP" }, {}, next,
    );
    let settled = false;
    Promise.resolve(guardResult).then(() => { settled = true; });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(next).not.toHaveBeenCalled();

    lookup.resolve(true);
    await guardResult;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });
});
