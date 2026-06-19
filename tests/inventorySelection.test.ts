import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Inventory product selection", () => {
  it("binds row checkboxes directly to the product selection state", () => {
    const inventoryView = readFileSync(resolve(__dirname, "../src/views/Inventory.vue"), "utf8");

    expect(inventoryView).toContain('<ion-checkbox v-model="product.isChecked" slot="start" @click.stop></ion-checkbox>');
    expect(inventoryView).not.toContain('@ionChange="product.isChecked');
  });
});
