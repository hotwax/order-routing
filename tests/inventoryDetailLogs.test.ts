import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Inventory detail logs", () => {
  it("uses a stable scrollable row layout for inventory log columns", () => {
    const inventoryDetailView = readFileSync(resolve(__dirname, "../src/views/InventoryDetail.vue"), "utf8");

    expect(inventoryDetailView).toContain('<div class="logs-scroll">');
    expect(inventoryDetailView).toContain('<ion-list class="logs-list">');
    expect(inventoryDetailView).toContain('class="logs-row"');
    expect(inventoryDetailView).not.toContain("repeat(var(--implicit-columns)");
  });

  it("renders the empty log state inside the list with dedicated alignment", () => {
    const inventoryDetailView = readFileSync(resolve(__dirname, "../src/views/InventoryDetail.vue"), "utf8");

    expect(inventoryDetailView).toContain('class="logs-empty"');
    expect(inventoryDetailView).toContain('class="logs-empty-label"');
    expect(inventoryDetailView).toContain("No inventory logs found");
  });
});
