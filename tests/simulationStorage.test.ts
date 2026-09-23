import { describe, expect, it } from "vitest";
import { clearVariationRun, getVariationRun, setVariationRun } from "@/services/simulationStorage";

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("persisted variation run recovery", () => {
  it("keeps the accepted simulation ID for a reload, then clears the marker", () => {
    const local = storage();
    const record = {
      routingGroupId: "GROUP", variationId: "VAR", serverVariationId: "VAR",
      variationLabel: "Test", simulationId: "SIM", startedAt: 1_000, status: "running" as const,
    };
    setVariationRun(record, local);
    expect(getVariationRun("GROUP", 1_001, local)).toEqual(record);
    clearVariationRun("GROUP", local);
    expect(getVariationRun("GROUP", 1_001, local)).toBeNull();
  });

  it("expires an old marker without touching another group", () => {
    const local = storage();
    setVariationRun({ routingGroupId: "GROUP", variationId: "VAR", serverVariationId: "VAR", variationLabel: "Test", startedAt: 1, status: "interrupted" }, local);
    expect(getVariationRun("OTHER", 2, local)).toBeNull();
    expect(getVariationRun("GROUP", 8 * 24 * 60 * 60_000, local)).toBeNull();
  });
});
