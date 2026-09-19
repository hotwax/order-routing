// tests/omsInstanceScope.test.ts
// The canonical persisted Pinia product-store cache is stamped with the OMS instance it was
// fetched from; userStore.ensureInstanceScope drops all instance-scoped state when the stamp no
// longer matches the connected instance (login or hydrate after an instance switch).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createApp } from "vue";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

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
    getOMSInstanceName: () => "demo-oms",
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
const persistedValues = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return persistedValues.size;
  },
  clear() {
    persistedValues.clear();
  },
  getItem(key: string) {
    return persistedValues.get(key) ?? null;
  },
  key(index: number) {
    return [...persistedValues.keys()][index] ?? null;
  },
  removeItem(key: string) {
    persistedValues.delete(key);
  },
  setItem(key: string, value: string) {
    persistedValues.set(key, String(value));
  },
};

function seedInstanceState(instanceKey: string) {
  const ecom = productStore();
  ecom.ecomStores = [{ productStoreId: "CAT_STORE", storeName: "CAT" }];
  ecom.currentEComStore = { productStoreId: "CAT_STORE", storeName: "CAT" };
  ecom.omsInstanceKey = instanceKey;

  useChannelStore().inventoryChannels = [{ facilityId: "OLD_CHANNEL" }];
  useRuleStore().rules = { list: [{ ruleId: "OLD_RULE" }], total: 1 };
}

describe("OMS instance scoping of persisted product stores", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageStub);
    setActivePinia(createPinia());
    mocks.api.mockReset();
    mocks.omsUrl.value = DEMO_KEY;
    localStorage.clear();
  });

  it("keeps state when the cache is stamped with the connected instance", async () => {
    seedInstanceState(DEMO_KEY);

    expect(await useUserStore().ensureInstanceScope()).toBe(true);

    expect(useAtpProductStore().currentProductStore.productStoreId).toBe("CAT_STORE");
    expect(productStore().ecomStores).toHaveLength(1);
    expect(useChannelStore().inventoryChannels).toHaveLength(1);
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("drops all instance-scoped state when the cache was stamped by another instance", async () => {
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
  });

  it("keeps the new user profile when postLogin clears stale instance state", async () => {
    seedInstanceState(OLD_KEY);
    mocks.api.mockImplementation((config: any) => {
      if (config.url === "admin/user/profile") {
        return Promise.resolve({ data: { userId: "new-user", timeZone: "UTC" } });
      }
      if (config.url === "admin/user/permissions") {
        const docs = config.params?.viewIndex === 0
          ? [{ permissionId: import.meta.env.VITE_PERMISSION_ID || "ORDER_ROUTING_VIEW" }]
          : [];
        return Promise.resolve({ status: 200, data: { docs } });
      }
      if (config.url === "admin/user/productStore") {
        return Promise.resolve({ data: [{ productStoreId: "DEMO_STORE", storeName: "Demo" }] });
      }
      if (config.url === "admin/user/getAvailableTimeZones") {
        return Promise.resolve({ data: { timeZones: [{ id: "UTC" }] } });
      }
      return Promise.resolve({ data: [] });
    });

    const user = useUserStore();
    await user.postLogin();

    expect(user.current).toEqual({ userId: "new-user", timeZone: "UTC" });
  });

  it("fetches the product-store catalog once during login", async () => {
    mocks.api.mockImplementation((config: any) => {
      if (config.url === "admin/user/profile") {
        return Promise.resolve({ data: { userId: "new-user", timeZone: "UTC" } });
      }
      if (config.url === "admin/user/permissions") {
        const docs = config.params?.viewIndex === 0
          ? [{ permissionId: import.meta.env.VITE_PERMISSION_ID || "ORDER_ROUTING_VIEW" }]
          : [];
        return Promise.resolve({ status: 200, data: { docs } });
      }
      if (config.url === "admin/user/productStore") {
        return Promise.resolve({ data: [{ productStoreId: "DEMO_STORE", storeName: "Demo" }] });
      }
      if (config.url === "admin/user/getAvailableTimeZones") {
        return Promise.resolve({ data: { timeZones: [{ id: "UTC" }] } });
      }
      return Promise.resolve({ data: [] });
    });

    await useUserStore().postLogin();

    const productStoreRequests = mocks.api.mock.calls.filter(
      ([config]: any[]) => config.url === "admin/user/productStore",
    );
    expect(productStoreRequests).toHaveLength(1);
  });

  it("keeps the canonical product-store selection when sourcing state resets", () => {
    seedInstanceState(DEMO_KEY);

    useAtpProductStore().$reset();

    expect(productStore().currentEComStore.productStoreId).toBe("CAT_STORE");
    expect(useAtpProductStore().currentProductStore.productStoreId).toBe("CAT_STORE");
  });

  it("does not rehydrate legacy product-store identity into sourcing state", () => {
    localStorage.setItem("atpProductStore", JSON.stringify({
      productStores: [{ productStoreId: "OLD_STORE" }],
      currentProductStore: { productStoreId: "OLD_STORE" },
      omsInstanceKey: OLD_KEY,
      configFacilities: [{ facilityId: "CONFIG" }],
    }));
    const pinia = createPinia().use(piniaPluginPersistedstate);
    createApp({}).use(pinia);
    setActivePinia(pinia);

    const atp = useAtpProductStore();

    expect(atp.configFacilities).toEqual([{ facilityId: "CONFIG" }]);
    expect(atp.$state).not.toHaveProperty("productStores");
    expect(atp.$state).not.toHaveProperty("currentProductStore");
    expect(atp.$state).not.toHaveProperty("omsInstanceKey");
  });

  it("does not apply product-store settings returned after the OMS instance changes", async () => {
    let resolveSettings!: (value: any) => void;
    let signalSettingsRequested!: () => void;
    const settingsRequested = new Promise<void>((resolve) => {
      signalSettingsRequested = resolve;
    });
    const delayedSettings = new Promise<any>((resolve) => {
      resolveSettings = resolve;
    });
    mocks.api.mockImplementation((config: any) => {
      if (config.url === "admin/user/productStore") {
        return Promise.resolve({ data: [{ productStoreId: "DEMO_STORE" }] });
      }
      if (config.url === "admin/productStores/DEMO_STORE/settings") {
        signalSettingsRequested();
        return delayedSettings;
      }
      return Promise.resolve({ data: [] });
    });

    const ecom = productStore();
    const fetchPromise = ecom.fetchProductStores();
    await settingsRequested;

    mocks.omsUrl.value = OLD_KEY;
    ecom.$reset();
    resolveSettings({
      data: [{
        settingTypeEnumId: "PRDT_IDEN_PREF",
        settingValue: JSON.stringify({ primaryId: "OLD_SKU", secondaryId: "OLD_ID" }),
      }],
    });
    await fetchPromise;

    expect(ecom.settings.productIdentifier.productIdentificationPref).toEqual({
      primaryId: "SKU",
      secondaryId: "productId",
    });
  });

  it("stamps fetched product stores with the connected instance key", async () => {
    mocks.api.mockResolvedValue({ data: [{ productStoreId: "DEMO_STORE" }] });

    await productStore().fetchProductStores();

    expect(productStore().omsInstanceKey).toBe(getOmsInstanceKey());
    expect(productStore().omsInstanceKey).toBe(DEMO_KEY);
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
