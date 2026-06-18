// tests/circuitVisibility.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// The circuit store imports @common + the WebLLM / IndexedDB service modules at load time.
// Stub them so the store module imports cleanly in the Vitest environment.
vi.mock("@common", () => ({ translate: (s: string) => s }));
vi.mock("@/services/CircuitStorageService", () => ({ CircuitStorageService: {} }));
vi.mock("@/services/CircuitLLMService", () => ({ default: {} }));

import { useCircuitStore } from "../src/store/circuit";

describe("circuit visibility toggle", () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it("defaults circuitEnabled to true (card shown by default)", () => {
    const s = useCircuitStore();
    expect(s.circuitEnabled).toBe(true);
  });

  it("setCircuitEnabled flips the flag both ways", () => {
    const s = useCircuitStore();
    s.setCircuitEnabled(false);
    expect(s.circuitEnabled).toBe(false);
    s.setCircuitEnabled(true);
    expect(s.circuitEnabled).toBe(true);
  });
});
