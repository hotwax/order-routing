// tests/omsInstanceScope.test.ts
// Persisted Pinia product-store caches are stamped with the OMS instance they were fetched
// from; userStore.ensureInstanceScope drops all instance-scoped state when the stamp no
// longer matches the connected instance (login or hydrate after an instance switch).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  omsUrl: { value: "https://demo-oms.hotwax.io/api/" },
}));

vi.mock("@common", () => ({
  api: mocks.api,
  logger: { error: () => {}, warn: () => {}, info: () => {} },
  translate: (key: string) => key,
  emitter: { on: () => {}, off: () => {}, emit: () => {} },
  cookieHelper: () => ({ get: () => null, set: () => {}, remove: () => {} }),
  commonUtil: {
    getOmsURL: () => mocks.omsUrl.value,
    getMaargURL: () => mocks.omsUrl.value,
    hasError: (resp: any) => resp?._error === true,
    showToast: () => {},
  },
}));
vi.mock("@common/composables/useAuth", () => ({
  useAuth: () => ({ updateUserId: () => {} }),
}));
vi.mock("@common/core/workerFactory", () => ({ WorkerFactory: class {} }));
vi.mock("@/services/appInitializer", () => ({
  initialize: vi.fn(),
  clearProductCache: vi.fn(),
  db: {},
}));

import { useUserStore } from "../src/store/userStore";
import { useAtpProductStore } from "../src/store/atpProductStore";
import { productStore } from "../src/store/productStore";
import { useChannelStore } from "../src/store/channel";
import { useRuleStore } from "../src/store/rule";
import { getOmsInstanceKey, isInstanceScopeStale } from "../src/utils/omsInstance";

const DEMO_KEY = "https://demo-oms.hotwax.io/api/";
const OLD_KEY = "https://old-oms.hotwax.io/api/";

function seedInstanceState(instanceKey: string) {
  const atp = useAtpProductStore();
  atp.productStores = [{ productStoreId: "CAT_STORE", storeName: "CAT" }];
  atp.currentProductStore = { productStoreId: "CAT_STORE", storeName: "CAT" };
  atp.omsInstanceKey = instanceKey;

  const ecom = productStore();
  ecom.ecomStores = [{ productStoreId: "CAT_STORE", storeName: "CAT" }];
  ecom.currentEComStore = { productStoreId: "CAT_STORE", storeName: "CAT" };
  ecom.omsInstanceKey = instanceKey;

  useChannelStore().inventoryChannels = [{ facilityId: "OLD_CHANNEL" }];
  useRuleStore().rules = { list: [{ ruleId: "OLD_RULE" }], total: 1 };
}

describe("OMS instance scoping of persisted product stores", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.api.mockReset();
    mocks.omsUrl.value = DEMO_KEY;
  });

  it("keeps state when the caches are stamped with the connected instance", async () => {
    seedInstanceState(DEMO_KEY);

    expect(await useUserStore().ensureInstanceScope()).toBe(true);

    expect(useAtpProductStore().currentProductStore.productStoreId).toBe("CAT_STORE");
    expect(productStore().ecomStores).toHaveLength(1);
    expect(useChannelStore().inventoryChannels).toHaveLength(1);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("drops all instance-scoped state when the caches were stamped by another instance", async () => {
    seedInstanceState(OLD_KEY);

    expect(await useUserStore().ensureInstanceScope()).toBe(false);

    expect(useAtpProductStore().productStores).toHaveLength(0);
    expect(useAtpProductStore().currentProductStore).toEqual({});
    expect(productStore().ecomStores).toHaveLength(0);
    expect(productStore().currentEComStore).toEqual({});
    expect(useChannelStore().inventoryChannels).toHaveLength(0);
    expect(useRuleStore().rules.list).toHaveLength(0);
  });

  it("treats unstamped legacy data as belonging to an unknown instance and drops it", async () => {
    seedInstanceState("");

    expect(await useUserStore().ensureInstanceScope()).toBe(false);
    expect(useAtpProductStore().productStores).toHaveLength(0);
    expect(productStore().currentEComStore).toEqual({});
  });

  it("leaves empty unstamped state untouched", async () => {
    expect(await useUserStore().ensureInstanceScope()).toBe(true);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("keeps state when no instance is connected (no oms cookie), deferring to the login flow", async () => {
    seedInstanceState(OLD_KEY);
    mocks.omsUrl.value = "";

    expect(await useUserStore().ensureInstanceScope()).toBe(true);
    expect(useAtpProductStore().currentProductStore.productStoreId).toBe("CAT_STORE");
  });

  it("refetches and restamps product stores for the connected instance on hydrate", async () => {
    seedInstanceState(OLD_KEY);
    mocks.api.mockImplementation((config: any) => {
      if (config.url === "admin/user/productStore") {
        return Promise.resolve({ data: [{ productStoreId: "DEMO_STORE", storeName: "Demo" }] });
      }
      return Promise.resolve({ data: [] });
    });

    expect(await useUserStore().ensureInstanceScope({ refetch: true })).toBe(false);

    const atp = useAtpProductStore();
    const ecom = productStore();
    expect(ecom.ecomStores.map((s: any) => s.productStoreId)).toEqual(["DEMO_STORE"]);
    expect(ecom.currentEComStore.productStoreId).toBe("DEMO_STORE");
    expect(ecom.omsInstanceKey).toBe(DEMO_KEY);
    expect(atp.productStores.map((s: any) => s.productStoreId)).toEqual(["DEMO_STORE"]);
    expect(atp.currentProductStore.productStoreId).toBe("DEMO_STORE");
    expect(atp.omsInstanceKey).toBe(DEMO_KEY);
  });

  it("stamps fetched product stores with the connected instance key", async () => {
    mocks.api.mockResolvedValue({ data: [{ productStoreId: "DEMO_STORE" }] });

    await useAtpProductStore().fetchUserProductStores();

    expect(useAtpProductStore().omsInstanceKey).toBe(getOmsInstanceKey());
    expect(useAtpProductStore().omsInstanceKey).toBe(DEMO_KEY);
  });

  it("isInstanceScopeStale only flags caches that hold data for another or unknown instance", () => {
    expect(isInstanceScopeStale(DEMO_KEY, true)).toBe(false);
    expect(isInstanceScopeStale(OLD_KEY, true)).toBe(true);
    expect(isInstanceScopeStale("", true)).toBe(true);
    expect(isInstanceScopeStale(undefined, true)).toBe(true);
    expect(isInstanceScopeStale(OLD_KEY, false)).toBe(false);
    expect(isInstanceScopeStale("", false)).toBe(false);
  });
});
