import { api, commonUtil, logger } from "@common";
import { computed, ref } from "vue";

export interface ChannelFacilityReference {
  facilityId: string;
  facilityName?: string;
  facilityTypeId?: string;
  parentFacilityTypeId?: string;
}

export interface ChannelInventoryLoadParams {
  productStoreId: string;
  facilityGroupId: string;
  productId: string;
  allFacilities?: ChannelFacilityReference[];
  channelFacilities?: ChannelFacilityReference[];
}

export interface ChannelFacilityInventoryRow {
  facilityId: string;
  facilityName: string;
  atp: number | null;
  qoh: number | null;
  minimumStock: number;
  allowBrokering: string;
}

export interface ShopifyReconciliationRow {
  shopId: string;
  systemMessageRemoteId: string;
  shopName: string;
  shopDomain: string;
  shopifyLocationId: string;
  shopifyLocationName: string;
  shopifyProductId: string;
  shopifyInventoryItemId: string;
  isProductMapped: boolean;
  shopifyAtp: number | null;
  shopifyAtpState: "idle" | "loading" | "loaded" | "unavailable";
}

export interface ChannelInventoryJobRun {
  jobRunId: string;
  jobName: string;
  jobDescription: string;
  serviceName: string;
  shopName: string;
  systemMessageRemoteId: string;
  status: "FAILED" | "RUNNING" | "SUCCESSFUL" | "TERMINATED";
  startTime: string | number | null;
  endTime: string | number | null;
  userId: string;
  messages: unknown;
  parameters: unknown;
  results: unknown;
  errors: unknown;
  logs: any[];
  referencesProduct: boolean;
}

type LoadState = "idle" | "loading" | "loaded" | "partial" | "unavailable";

const SHOPIFY_INVENTORY_QUERY = `
  query InventoryItemAvailable($inventoryItemId: ID!, $locationId: ID!) {
    location(id: $locationId) {
      name
    }
    inventoryItem(id: $inventoryItemId) {
      inventoryLevel(locationId: $locationId) {
        quantities(names: ["available"]) {
          name
          quantity
        }
      }
    }
  }
`;

const SHOPIFY_LOCATION_QUERY = `
  query LocationName($locationId: ID!) {
    location(id: $locationId) {
      name
    }
  }
`;

const CHANNEL_INVENTORY_PUSH_SERVICE_NAMES = [
  "co.hotwax.ofbiz.InventoryServices.generate#ShopifyInventoryFeed",
  "co.hotwax.ofbiz.InventoryServices.generate#InventoryDeltaFeed",
];

function isSuccessfulResponse(response: any) {
  return response && !commonUtil.hasError(response);
}

function isNaFacility(facilityId: unknown) {
  return facilityId === "_NA_" || facilityId === "NA";
}

function isPhysicalFacility(facility: ChannelFacilityReference) {
  return facility.facilityTypeId !== "CONFIGURATION" &&
    facility.facilityTypeId !== "VIRTUAL_FACILITY" &&
    facility.parentFacilityTypeId !== "VIRTUAL_FACILITY";
}

function numberOrNull(value: unknown) {
  if(value === null || value === undefined || value === "") {return null;}
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function shopifyGid(type: "InventoryItem" | "Location", id: string) {
  return id.startsWith("gid://") ? id : `gid://shopify/${type}/${id}`;
}

function mappingKey(shopId: string, shopifyLocationId: string) {
  return `${shopId}::${shopifyLocationId}`;
}

function logRequestFailure(message: string, error: any) {
  const status = error?.response?.status ?? error?.status;
  logger.error(status ? `${message} (HTTP ${status})` : message);
}

function getServiceJobParameter(job: any, parameterName: string) {
  return (job?.serviceJobParameters || []).find((parameter: any) => parameter.parameterName === parameterName)?.parameterValue || "";
}

function parameterContains(value: string, expectedValue: string) {
  if(!value) {return false;}
  try {
    const parsedValue = JSON.parse(value);
    if(Array.isArray(parsedValue)) {return parsedValue.map(String).includes(expectedValue);}
  } catch (_) {
    // Moqui parameters are also commonly stored as a comma-delimited string.
  }

  return value.split(",").map((item) => item.trim()).includes(expectedValue);
}

function getJobRunStatus(run: any): ChannelInventoryJobRun["status"] {
  if(run?.hasError === "Y") {return "FAILED";}
  if(run?.startTime && !run?.endTime) {return "RUNNING";}
  if(run?.startTime && run?.endTime) {return "SUCCESSFUL";}

  return "TERMINATED";
}

function getRunTime(run: any) {
  const value = run?.startTime || run?.lastUpdatedStamp || run?.endTime;
  if(!value) {return 0;}
  const numericValue = Number(value);
  if(Number.isFinite(numericValue)) {return numericValue;}
  const parsedValue = Date.parse(String(value));

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function referencesProduct(run: any, productId: string) {
  const evidence = [run?.parameters, run?.results, run?.messages]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => typeof value === "string" ? value : JSON.stringify(value));
  const escapedProductId = productId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const productPattern = new RegExp(`(^|[\\s\"',:\\[\\]{}()])${escapedProductId}($|[\\s\"',:\\[\\]{}()])`);

  return evidence.some((value) => productPattern.test(value));
}

function normalizeProductFacility(response: any, facility: ChannelFacilityReference): ChannelFacilityInventoryRow | null {
  const rows = response?.data?.productFacilities ?? response?.data?.products ?? [];
  const row = rows.find((candidate: any) => {
    const config = candidate?.inventoryConfig ?? candidate;

    return (config?.facilityId ?? candidate?.facilityId) === facility.facilityId;
  }) ?? rows[0];
  if(!row) {return null;}

  const config = row.inventoryConfig ?? row;

  return {
    facilityId: facility.facilityId,
    facilityName: facility.facilityName || facility.facilityId,
    atp: numberOrNull(config.atp ?? row.availableToPromise),
    qoh: numberOrNull(config.qoh ?? row.quantityOnHand),
    minimumStock: numberOrNull(config.minimumStock) ?? 0,
    allowBrokering: config.allowBrokering || "Y",
  };
}

export interface ProductOnlineAtpBatchParams {
  productStoreId: string;
  facilityGroupId: string;
  productIds: string[];
}

/**
 * Loads Online ATP for a page of products in one batched call. get#ProductOnlineAtp requires
 * productId (or sku) and accepts it as a list, sent as repeated query params. Products the
 * backend omits have no channel-eligible inventory, so they stay out of the returned map.
 */
export async function fetchProductOnlineAtpMap({ productStoreId, facilityGroupId, productIds }: ProductOnlineAtpBatchParams): Promise<Record<string, number | null>> {
  const onlineAtpByProduct: Record<string, number | null> = {};
  if(!productIds.length) {return onlineAtpByProduct;}

  try {
    const response = await api({
      url: "oms/getProductOnlineAtp",
      method: "GET",
      params: { productStoreId, facilityGroupId, productId: productIds },
    });
    if(!isSuccessfulResponse(response)) {throw response;}
    ((response as any)?.data?.productOnlineAtp || []).forEach((row: any) => {
      if(row?.productId) {onlineAtpByProduct[row.productId] = numberOrNull(row.atp);}
    });
  } catch (error) {
    logRequestFailure("Failed to fetch Online ATP for product page", error);
  }

  return onlineAtpByProduct;
}

/** Rows without a fetched value get null so the list keeps rendering "-" for them. */
export function mergeOnlineAtpIntoRows<T extends { productId: string }>(rows: T[], onlineAtpByProduct: Record<string, number | null>): (T & { onlineAtp: number | null })[] {
  return rows.map((row) => ({ ...row, onlineAtp: onlineAtpByProduct[row.productId] ?? null }));
}

/**
 * Loads independently available channel computation and reconciliation evidence.
 * A failure in one source never blanks data that another source returned.
 */
export function useChannelInventory() {
  const onlineAtp = ref<number | null>(null);
  const onlineAtpState = ref<"idle" | "loading" | "loaded" | "unavailable">("idle");
  const facilityInventoryState = ref<LoadState>("idle");
  const facilityInventoryRows = ref<ChannelFacilityInventoryRow[]>([]);
  const facilityInventoryUnavailableCount = ref(0);
  const channelFacilityIds = ref<string[]>([]);
  const reconciliationState = ref<"idle" | "loading" | "loaded" | "unavailable">("idle");
  const shopifyLocationMappings = ref<any[]>([]);
  const shopifyProductMappings = ref<any[]>([]);
  const systemMessageRemotes = ref<any[]>([]);
  const shopifyAtpByMapping = ref<Record<string, { value: number | null; state: ShopifyReconciliationRow["shopifyAtpState"] }>>({});
  const shopifyLocationNameByMapping = ref<Record<string, string>>({});
  const virtualQueueDemand = ref<number | null>(null);
  const virtualQueueDemandState = ref<"idle" | "loading" | "loaded" | "unavailable">("idle");
  const physicalFacilityCount = ref(0);
  // Display name of the _NA_ facility (e.g. "Brokering Queue") that channel/aggregate inventory is
  // pushed through — resolved from the virtual-facility fetch below and shown in the reconciliation
  // copy instead of the raw "_NA_" code.
  const naFacilityName = ref("");
  const channelHistoryState = ref<LoadState>("idle");
  const channelJobRuns = ref<ChannelInventoryJobRun[]>([]);
  const channelJobRunsUnavailableCount = ref(0);
  let requestId = 0;

  const reconciliationRows = computed<ShopifyReconciliationRow[]>(() => {
    return shopifyLocationMappings.value
      .filter((mapping: any) => isNaFacility(mapping.facilityId))
      .map((mapping: any) => {
        const productMapping = shopifyProductMappings.value.find((candidate: any) => candidate.shopId === mapping.shopId);
        const systemMessageRemote = systemMessageRemotes.value.find((candidate: any) => candidate.internalId === mapping.shopId);
        const currentShopifyAtp = shopifyAtpByMapping.value[mappingKey(mapping.shopId || "", mapping.shopifyLocationId || "")];

        return {
          shopId: mapping.shopId || "",
          systemMessageRemoteId: systemMessageRemote?.systemMessageRemoteId || "",
          shopName: mapping.name || mapping.shopId || "",
          shopDomain: mapping.myshopifyDomain || mapping.domain || "",
          shopifyLocationId: mapping.shopifyLocationId || "",
          shopifyLocationName: shopifyLocationNameByMapping.value[mappingKey(mapping.shopId || "", mapping.shopifyLocationId || "")] || "",
          shopifyProductId: productMapping?.shopifyProductId || "",
          shopifyInventoryItemId: productMapping?.shopifyInventoryItemId || "",
          isProductMapped: Boolean(productMapping?.shopifyInventoryItemId),
          shopifyAtp: currentShopifyAtp?.value ?? null,
          shopifyAtpState: currentShopifyAtp?.state ?? "idle",
        };
      });
  });

  const channelFacilityCount = computed(() => channelFacilityIds.value.length);

  const brokeringDisabledFacilities = computed(() => facilityInventoryRows.value
    .filter((row) => channelFacilityIds.value.includes(row.facilityId) && row.allowBrokering === "N"));

  const channelFacilityInventory = computed(() => facilityInventoryRows.value
    .filter((row) => channelFacilityIds.value.includes(row.facilityId)));

  // Steps of the Online ATP walkthrough (broad -> specific): all physical inventory, then only the
  // channel's inventory-group members, then what per-facility brokering removes, then the safety
  // stock held back at the locations that still contribute.
  const physicalAtp = computed(() => facilityInventoryRows.value
    .reduce((total, row) => total + (row.atp ?? 0), 0));

  const channelAtp = computed(() => channelFacilityInventory.value
    .reduce((total, row) => total + (row.atp ?? 0), 0));

  const brokeringDisabledAtp = computed(() => brokeringDisabledFacilities.value
    .reduce((total, row) => total + (row.atp ?? 0), 0));

  const contributingSafetyStock = computed(() => channelFacilityInventory.value
    .filter((row) => row.allowBrokering !== "N")
    .reduce((total, row) => total + row.minimumStock, 0));

  const outsideChannelInventory = computed(() => facilityInventoryRows.value
    .filter((row) => !channelFacilityIds.value.includes(row.facilityId))
    .filter((row) => (row.atp ?? 0) !== 0 || (row.qoh ?? 0) !== 0));

  function clear() {
    requestId += 1;
    onlineAtp.value = null;
    onlineAtpState.value = "idle";
    facilityInventoryState.value = "idle";
    facilityInventoryRows.value = [];
    facilityInventoryUnavailableCount.value = 0;
    channelFacilityIds.value = [];
    physicalFacilityCount.value = 0;
    reconciliationState.value = "idle";
    shopifyLocationMappings.value = [];
    shopifyProductMappings.value = [];
    systemMessageRemotes.value = [];
    shopifyAtpByMapping.value = {};
    shopifyLocationNameByMapping.value = {};
    virtualQueueDemand.value = null;
    virtualQueueDemandState.value = "idle";
    naFacilityName.value = "";
    channelHistoryState.value = "idle";
    channelJobRuns.value = [];
    channelJobRunsUnavailableCount.value = 0;
  }

  async function loadChannelJobHistory(params: ChannelInventoryLoadParams, currentRequestId: number) {
    channelHistoryState.value = "loading";
    channelJobRuns.value = [];
    channelJobRunsUnavailableCount.value = 0;

    try {
      const jobListResults = await Promise.allSettled(CHANNEL_INVENTORY_PUSH_SERVICE_NAMES.map((serviceName) => api({
        url: "admin/serviceJobs",
        method: "GET",
        params: { pageIndex: 0, pageSize: 250, serviceName },
      })));
      if(currentRequestId !== requestId) {return;}

      const successfulJobLists = jobListResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled" && isSuccessfulResponse(result.value));
      if(!successfulJobLists.length) {throw (jobListResults.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined)?.reason;}

      const jobsByName = new Map<string, any>();
      successfulJobLists.forEach((result) => {
        (result.value?.data?.serviceJobList || []).forEach((job: any) => {
          if(job?.jobName) {jobsByName.set(job.jobName, job);}
        });
      });

      const remoteIds = reconciliationRows.value.map((row) => row.systemMessageRemoteId).filter(Boolean);
      const shopIds = reconciliationRows.value.map((row) => row.shopId).filter(Boolean);
      const jobs = [...jobsByName.values()].filter((job: any) => {
        const productStoreId = getServiceJobParameter(job, "productStoreId") || getServiceJobParameter(job, "productStoreIds");
        const facilityGroupId = getServiceJobParameter(job, "facilityGroupId") || getServiceJobParameter(job, "facilityGroupIds");
        const systemMessageRemoteId = getServiceJobParameter(job, "systemMessageRemoteId");
        const shopId = getServiceJobParameter(job, "shopId");
        if(productStoreId && !parameterContains(productStoreId, params.productStoreId)) {return false;}
        if(facilityGroupId && !parameterContains(facilityGroupId, params.facilityGroupId)) {return false;}
        if(systemMessageRemoteId && !remoteIds.includes(systemMessageRemoteId)) {return false;}
        if(shopId && !shopIds.includes(shopId)) {return false;}

        return true;
      });

      const runResults = await Promise.allSettled(jobs.map(async (job: any) => {
        const response = await api({
          url: `admin/serviceJobs/${encodeURIComponent(job.jobName)}/runs`,
          method: "GET",
          params: {
            dependentLevels: 1,
            orderByField: "-startTime",
            pageIndex: 0,
            pageSize: 25,
          },
        });
        if(!isSuccessfulResponse(response)) {throw response;}
        const systemMessageRemoteId = getServiceJobParameter(job, "systemMessageRemoteId");
        const shopId = getServiceJobParameter(job, "shopId");
        const shop = reconciliationRows.value.find((row) =>
          (systemMessageRemoteId && row.systemMessageRemoteId === systemMessageRemoteId) ||
          (shopId && row.shopId === shopId));

        return (Array.isArray(response?.data) ? response.data : []).map((run: any): ChannelInventoryJobRun => ({
          jobRunId: String(run.jobRunId || ""),
          jobName: job.jobName || run.jobName || "",
          jobDescription: job.description || "",
          serviceName: job.serviceName || "",
          shopName: shop?.shopName || shop?.shopDomain || shopId || "",
          systemMessageRemoteId,
          status: getJobRunStatus(run),
          startTime: run.startTime || run.lastUpdatedStamp || null,
          endTime: run.endTime || null,
          userId: run.userId || "",
          messages: run.messages,
          parameters: run.parameters,
          results: run.results,
          errors: run.errors,
          logs: Array.isArray(run.logs) ? run.logs : [],
          referencesProduct: referencesProduct(run, params.productId),
        }));
      }));
      if(currentRequestId !== requestId) {return;}

      channelJobRuns.value = runResults
        .flatMap((result) => result.status === "fulfilled" ? result.value : [])
        .sort((first, second) => getRunTime(second) - getRunTime(first));
      channelJobRunsUnavailableCount.value = runResults.filter((result) => result.status === "rejected").length;
      const jobListUnavailableCount = jobListResults.length - successfulJobLists.length;
      channelJobRunsUnavailableCount.value += jobListUnavailableCount;
      if((jobs.length && runResults.every((result) => result.status === "rejected")) || !successfulJobLists.length) {channelHistoryState.value = "unavailable";} else if(channelJobRunsUnavailableCount.value) {channelHistoryState.value = "partial";} else {channelHistoryState.value = "loaded";}
    } catch (error) {
      if(currentRequestId !== requestId) {return;}
      channelHistoryState.value = "unavailable";
      logRequestFailure("Failed to fetch channel inventory push history", error);
    }
  }

  // Mirrors get#ProductOnlineAtp's VirtualFacilityOrderItemCount: sales-order items parked at
  // virtual-facility queues in any status other than cancelled/completed/rejected are still
  // promised, so OMS subtracts their quantity (alongside the threshold) from Online ATP.
  async function loadVirtualQueueDemand(params: ChannelInventoryLoadParams, currentRequestId: number) {
    virtualQueueDemand.value = null;
    virtualQueueDemandState.value = "loading";
    naFacilityName.value = "";
    try {
      const facilitiesResponse = await api({
        url: "oms/facilities",
        method: "GET",
        params: { parentFacilityTypeId: "VIRTUAL_FACILITY", pageSize: 100 },
      });
      if(!isSuccessfulResponse(facilitiesResponse)) {throw facilitiesResponse;}
      // The endpoint does not honor the parentFacilityTypeId filter, so filter client-side.
      const facilities = Array.isArray((facilitiesResponse as any)?.data) ? (facilitiesResponse as any).data : (facilitiesResponse as any)?.data?.facilities || [];
      if(currentRequestId !== requestId) {return;}
      const naFacility = facilities.find((facility: any) => isNaFacility(facility.facilityId));
      naFacilityName.value = naFacility?.facilityName || "";
      const virtualFacilityIds = facilities
        .filter((facility: any) => facility.parentTypeId === "VIRTUAL_FACILITY")
        .map((facility: any) => facility.facilityId);
      if(!virtualFacilityIds.length) {
        virtualQueueDemand.value = 0;
        virtualQueueDemandState.value = "loaded";

        return;
      }

      // Quote the interpolated ids: this count feeds the displayed Computed ATP, so a productId
      // carrying a Solr special character (e.g. a hyphen, read as a negation) must not silently
      // skew the query into a wrong number.
      const facilityClause = virtualFacilityIds.map((facilityId: string) => `"${facilityId}"`).join(" OR ");
      const response = await api({
        url: "solr-query",
        method: "post",
        baseURL: commonUtil.getOmsURL(),
        data: {
          json: {
            params: { rows: 0 },
            query: "*:*",
            filter: `docType: ORDER AND orderTypeId: SALES_ORDER AND productStoreId: "${params.productStoreId}" AND productId: "${params.productId}" AND facilityId: (${facilityClause}) AND -orderItemStatusId: (ITEM_CANCELLED OR ITEM_COMPLETED OR ITEM_REJECTED)`,
            facet: { queueDemand: "sum(quantity)" },
          },
        },
      });
      if(!isSuccessfulResponse(response)) {throw response;}
      if(currentRequestId !== requestId) {return;}
      virtualQueueDemand.value = numberOrNull((response as any)?.data?.facets?.queueDemand) ?? 0;
      virtualQueueDemandState.value = "loaded";
    } catch (error) {
      if(currentRequestId !== requestId) {return;}
      virtualQueueDemandState.value = "unavailable";
      logRequestFailure("Failed to fetch virtual queue demand", error);
    }
  }

  async function loadFacilityInventory(params: ChannelInventoryLoadParams, currentRequestId: number) {
    const allFacilities = (params.allFacilities || []).filter(isPhysicalFacility);
    physicalFacilityCount.value = allFacilities.length;
    channelFacilityIds.value = (params.channelFacilities || []).filter(isPhysicalFacility).map((facility) => facility.facilityId);
    if(!allFacilities.length) {
      facilityInventoryState.value = "loaded";

      return;
    }

    const results = await Promise.allSettled(allFacilities.map(async (facility) => {
      const response = await api({
        url: "oms/productFacilities/search",
        method: "GET",
        params: { productId: params.productId, facilityId: facility.facilityId },
      });
      if(!isSuccessfulResponse(response)) {throw response;}

      return normalizeProductFacility(response, facility);
    }));
    if(currentRequestId !== requestId) {return;}

    facilityInventoryRows.value = results
      .filter((result): result is PromiseFulfilledResult<ChannelFacilityInventoryRow | null> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((row): row is ChannelFacilityInventoryRow => Boolean(row));
    facilityInventoryUnavailableCount.value = results.filter((result) => result.status === "rejected").length;
    if(facilityInventoryUnavailableCount.value === results.length) {facilityInventoryState.value = "unavailable";} else if(facilityInventoryUnavailableCount.value) {facilityInventoryState.value = "partial";} else {facilityInventoryState.value = "loaded";}
  }

  async function loadShopifyAtp(rows: ShopifyReconciliationRow[], currentRequestId: number) {
    const mappedRows = rows.filter((row) => row.systemMessageRemoteId && row.shopifyLocationId && row.shopifyInventoryItemId);
    // Rows without a product mapping can't report ATP, but the mapped location itself still
    // exists in Shopify — resolve its display name with a location-only query.
    const locationOnlyRows = rows.filter((row) => row.systemMessageRemoteId && row.shopifyLocationId && !row.shopifyInventoryItemId);
    const initialState: typeof shopifyAtpByMapping.value = {};
    rows.forEach((row) => {
      initialState[mappingKey(row.shopId, row.shopifyLocationId)] = {
        value: null,
        state: row.isProductMapped && row.shopifyLocationId && row.systemMessageRemoteId ? "loading" : "unavailable",
      };
    });
    shopifyAtpByMapping.value = initialState;

    const results = await Promise.allSettled(mappedRows.map(async (row) => {
      const response = await api({
        url: "shopify/graphql",
        method: "POST",
        data: {
          systemMessageRemoteId: row.systemMessageRemoteId,
          queryText: SHOPIFY_INVENTORY_QUERY,
          variables: {
            inventoryItemId: shopifyGid("InventoryItem", row.shopifyInventoryItemId),
            locationId: shopifyGid("Location", row.shopifyLocationId),
          },
        },
      });
      if(!isSuccessfulResponse(response)) {throw response;}
      const quantities = response?.data?.response?.inventoryItem?.inventoryLevel?.quantities || [];
      const available = numberOrNull(quantities.find((quantity: any) => quantity.name === "available")?.quantity);

      return {
        key: mappingKey(row.shopId, row.shopifyLocationId),
        value: available,
        locationName: response?.data?.response?.location?.name || "",
      };
    }));
    const locationResults = await Promise.allSettled(locationOnlyRows.map(async (row) => {
      const response = await api({
        url: "shopify/graphql",
        method: "POST",
        data: {
          systemMessageRemoteId: row.systemMessageRemoteId,
          queryText: SHOPIFY_LOCATION_QUERY,
          variables: { locationId: shopifyGid("Location", row.shopifyLocationId) },
        },
      });
      if(!isSuccessfulResponse(response)) {throw response;}

      return {
        key: mappingKey(row.shopId, row.shopifyLocationId),
        locationName: response?.data?.response?.location?.name || "",
      };
    }));
    if(currentRequestId !== requestId) {return;}

    const updatedState = { ...shopifyAtpByMapping.value };
    const updatedNames = { ...shopifyLocationNameByMapping.value };
    mappedRows.forEach((row, index) => {
      const result = results[index];
      const key = mappingKey(row.shopId, row.shopifyLocationId);
      updatedState[key] = result.status === "fulfilled"
        ? { value: result.value.value, state: "loaded" }
        : { value: null, state: "unavailable" };
      if(result.status === "fulfilled" && result.value.locationName) {updatedNames[key] = result.value.locationName;}
      if(result.status === "rejected") {logRequestFailure("Failed to fetch Shopify ATP", result.reason);}
    });
    locationResults.forEach((result) => {
      if(result.status === "fulfilled" && result.value.locationName) {updatedNames[result.value.key] = result.value.locationName;} else if(result.status === "rejected") {logRequestFailure("Failed to fetch Shopify location name", result.reason);}
    });
    shopifyAtpByMapping.value = updatedState;
    shopifyLocationNameByMapping.value = updatedNames;
  }

  async function load(params: ChannelInventoryLoadParams) {
    const currentRequestId = ++requestId;
    onlineAtp.value = null;
    onlineAtpState.value = "loading";
    facilityInventoryState.value = "loading";
    facilityInventoryRows.value = [];
    facilityInventoryUnavailableCount.value = 0;
    reconciliationState.value = "loading";
    shopifyLocationMappings.value = [];
    shopifyProductMappings.value = [];
    systemMessageRemotes.value = [];
    shopifyAtpByMapping.value = {};
    shopifyLocationNameByMapping.value = {};
    channelHistoryState.value = "loading";
    channelJobRuns.value = [];
    channelJobRunsUnavailableCount.value = 0;

    const facilityInventoryPromise = loadFacilityInventory(params, currentRequestId);
    const virtualQueueDemandPromise = loadVirtualQueueDemand(params, currentRequestId);
    const [onlineAtpResult, locationMappingsResult, productMappingsResult, systemMessageRemotesResult] = await Promise.allSettled([
      api({
        url: "oms/getProductOnlineAtp",
        method: "GET",
        params: {
          productStoreId: params.productStoreId,
          facilityGroupId: params.facilityGroupId,
          productId: params.productId,
        },
      }),
      api({
        url: "oms/ShopFacilityMappings",
        method: "GET",
        params: { productStoreId: params.productStoreId, pageNoLimit: true },
      }),
      api({
        url: `oms/products/${encodeURIComponent(params.productId)}/shopifyShopProducts`,
        method: "GET",
        params: { productStoreId: params.productStoreId, pageNoLimit: true },
      }),
      api({
        url: "oms/systemMessageRemotes",
        method: "GET",
      }),
    ]);

    if(currentRequestId !== requestId) {return;}

    if(onlineAtpResult.status === "fulfilled" && isSuccessfulResponse(onlineAtpResult.value)) {
      const rows = (onlineAtpResult.value as any)?.data?.productOnlineAtp || [];
      const productRow = rows.find((row: any) => row.productId === params.productId) || rows[0];
      const value = Number(productRow?.atp);
      onlineAtp.value = Number.isFinite(value) ? value : null;
      onlineAtpState.value = "loaded";
    } else {
      onlineAtpState.value = "unavailable";
      logRequestFailure("Failed to fetch channel Online ATP", onlineAtpResult.status === "rejected" ? onlineAtpResult.reason : onlineAtpResult.value);
    }

    const locationMappingsLoaded = locationMappingsResult.status === "fulfilled" && isSuccessfulResponse(locationMappingsResult.value);
    const productMappingsLoaded = productMappingsResult.status === "fulfilled" && isSuccessfulResponse(productMappingsResult.value);
    const systemMessageRemotesLoaded = systemMessageRemotesResult.status === "fulfilled" && isSuccessfulResponse(systemMessageRemotesResult.value);

    if(locationMappingsLoaded) {shopifyLocationMappings.value = (locationMappingsResult.value as any)?.data || [];}
    if(productMappingsLoaded) {shopifyProductMappings.value = (productMappingsResult.value as any)?.data || [];}
    if(systemMessageRemotesLoaded) {
      const data = (systemMessageRemotesResult.value as any)?.data;
      systemMessageRemotes.value = data?.systemMessageRemoteList ?? (Array.isArray(data) ? data : []);
    }
    reconciliationState.value = locationMappingsLoaded && productMappingsLoaded && systemMessageRemotesLoaded ? "loaded" : "unavailable";

    if(!locationMappingsLoaded) {
      logRequestFailure("Failed to fetch Shopify location mappings", locationMappingsResult.status === "rejected" ? locationMappingsResult.reason : locationMappingsResult.value);
    }
    if(!productMappingsLoaded) {
      logRequestFailure("Failed to fetch Shopify product mappings", productMappingsResult.status === "rejected" ? productMappingsResult.reason : productMappingsResult.value);
    }
    if(!systemMessageRemotesLoaded) {
      logRequestFailure("Failed to fetch Shopify remote mappings", systemMessageRemotesResult.status === "rejected" ? systemMessageRemotesResult.reason : systemMessageRemotesResult.value);
    }

    const detailLoads: Promise<void>[] = [loadChannelJobHistory(params, currentRequestId)];
    if(locationMappingsLoaded && productMappingsLoaded && systemMessageRemotesLoaded) {
      detailLoads.push(loadShopifyAtp(reconciliationRows.value, currentRequestId));
    }
    await Promise.all(detailLoads);
    await facilityInventoryPromise;
    await virtualQueueDemandPromise;
  }

  return {
    brokeringDisabledAtp,
    brokeringDisabledFacilities,
    channelAtp,
    channelFacilityCount,
    channelFacilityInventory,
    channelHistoryState,
    channelJobRuns,
    channelJobRunsUnavailableCount,
    clear,
    contributingSafetyStock,
    facilityInventoryRows,
    facilityInventoryState,
    facilityInventoryUnavailableCount,
    load,
    naFacilityName,
    onlineAtp,
    onlineAtpState,
    outsideChannelInventory,
    physicalAtp,
    physicalFacilityCount,
    reconciliationRows,
    reconciliationState,
    virtualQueueDemand,
    virtualQueueDemandState,
  };
}
