interface InventoryFacility {
  facilityId?: string;
}

interface InventoryFacilitySearchInput {
  pageSize: number;
  pageIndex: number;
  searchQuery: string;
  facilityId?: string;
}

export function resolveInventoryFacilityId(savedFacilityId: string, facilities: InventoryFacility[] = []) {
  const exists = facilities.some(f => f.facilityId === savedFacilityId);
  return (exists ? savedFacilityId : facilities[0]?.facilityId) || "";
}

export function buildInventoryFacilitySearchParams(input: InventoryFacilitySearchInput) {
  if (!input.facilityId) return null;

  const params = {
    pageSize: input.pageSize,
    pageIndex: input.pageIndex,
    facilityId: input.facilityId
  } as Record<string, string | number>;

  const keyword = input.searchQuery.trim();
  if (keyword) params.keyword = keyword;

  return params;
}
