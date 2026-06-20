import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Inventory detail logs", () => {
  it("uses a stable scrollable row layout for inventory log columns", () => {
    const inventoryDetailView = readFileSync(resolve(__dirname, "../src/views/InventoryDetail.vue"), "utf8");

    expect(inventoryDetailView).toContain('<div class="logs-scroll">');
    expect(inventoryDetailView).toContain('<div class="list-item">');
    expect(inventoryDetailView).toContain('class="list-item" v-for');
    expect(inventoryDetailView).toContain("repeat(var(--implicit-columns)");
    expect(inventoryDetailView).toContain(".logs-panel .list-item > *");
    expect(inventoryDetailView).not.toContain('<ion-list class="logs-list">');
    expect(inventoryDetailView).not.toContain('class="logs-row"');
  });

  it("renders the empty log state inside the list with dedicated alignment", () => {
    const inventoryDetailView = readFileSync(resolve(__dirname, "../src/views/InventoryDetail.vue"), "utf8");

    expect(inventoryDetailView).toContain('class="list-item logs-empty"');
    expect(inventoryDetailView).toContain("No inventory logs found");
  });

  it("guards inventory detail requests until a facility is selected", () => {
    const inventoryDetailView = readFileSync(resolve(__dirname, "../src/views/InventoryDetail.vue"), "utf8");

    expect(inventoryDetailView).toContain("function hasInventoryDetailContext()");
    expect(inventoryDetailView).toContain("if (!hasInventoryDetailContext())");
    expect(inventoryDetailView).toContain("inventoryLogs.value = []");
    expect(inventoryDetailView).toContain("inventoryConfig.value = productFacility.value?.[0] ?? {}");
    expect(inventoryDetailView).not.toContain("productFacility.value?.[0] ?? null");
  });
});
