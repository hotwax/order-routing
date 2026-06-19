Viewed Inventory.vue:117-147

Here is a list of positive test cases (what is working correctly as intended) that you can log in your Google Sheet to show what has been verified:

### 1. **Inventory Search & Pagination**
* **Verification of Exact Name Search:** Verified that searching for a full, exact product name (e.g., `"Electra Bra Top"`) successfully filters and retrieves the matching product.
* **Verification of Exact SKU Search:** Verified that searching for an exact product SKU/ID (e.g., `"WB01-XS-Black"`) returns the exact matching record.
* **Verification of Exact Group ID Search:** Verified that searching for an exact Solr group ID (e.g., `"M102502"`) successfully returns all products belonging to that group.
* **Verification of Pagination Controls:** Verified that clicking the caret-back (`<`) and caret-forward (`>`) buttons successfully changes pages and fetches the next/previous batch of 50 items.
* **Verification of Product Thumbnail Loading:** Verified that product images successfully load from Shopify CDN via `<DxpShopifyImg>` and display correctly.

### 2. **Product Configuration & Adjustments**
* **Verification of "Add Config" Action:** Verified that clicking `"Add Config"` on an unconfigured product successfully opens the configuration edit modal.
* **Verification of Facility Filtering:** Verified that selecting a facility (e.g., `"Brooklyn"`) from the dropdown successfully filters the list to show inventory levels for that facility.
* **Verification of Bulk Checkbox Selection:** Verified that checking `"Select all"` correctly checks all checkboxes in the list.
* **Verification of Bulk Configuration Adjustments:** Verified that selecting multiple checkboxes and clicking `"Adjust Config"` or `"Adjust Inventory"` successfully passes all selected items to the modal.

### 3. **Inventory Detail Page (Transaction Logs)**
* **Verification of Log Ingestion:** Verified that transaction logs are fetched correctly from `/oms/inventoryItem/detail` and displayed on the detail page.
* **Verification of Empty State Handling:** Verified that when a product has no transaction history, the `"No inventory logs found"` fallback message displays correctly.

### 4. **Facility Groups Management**
* **Verification of Group Creation:** Verified that submitting the `"New Group"` form successfully creates a new facility group on the backend (`admin/facilityGroups`).
* **Verification of Automatic ID Derivation:** Verified that the creation modal successfully derives a clean alphanumeric ID from the group name if the ID field is left blank.
* **Verification of Member Counting:** Verified that the UI displays the correct count of facilities assigned to each group (e.g., `"3 facilities"`).
* **Verification of Managing Facilities:** Verified that adding or removing facilities in the `"Manage Facilities"` modal updates the group members correctly on the backend.
* **Verification of Archiving Groups:** Verified that clicking `"Archive"` successfully adds a `thruDate` to the group and removes it from the active UI list.