import { expose } from 'comlink'
import workerRemoteApi from '@common/core/workerRemoteApi'
import { createCommonDB } from '@/services/commonDatabase'
import { buildProductQuery, getProductIdentifications, mapApiDocToProduct } from '@/utils/productSync'
import type { CommonDB, Product, ProductInventory } from '@/services/commonDatabase'
import type { ProductQueryParams } from '@/utils/productSync'

export interface ProductSyncContext {
  omsInstance: string
  maargUrl: string
  omsUrl?: string
  token: string
  barcodeIdentification?: string
  facilityId?: string
  staleMs?: number
}

export interface ProductSyncResponse {
  products: Product[]
  total: number
}

export interface ProductBackgroundSyncResponse {
  synced: number
  total: number
}

export interface ProductSyncWorker {
  syncProducts: (params: ProductQueryParams, context: ProductSyncContext) => Promise<ProductSyncResponse>
  syncRemainingProducts: (params: ProductQueryParams, context: ProductSyncContext, total: number, startViewIndex?: number) => Promise<ProductBackgroundSyncResponse>
  syncProductInventory: (productIds: string[], context: ProductSyncContext) => Promise<ProductInventory[]>
  getById: (productId: string, context: ProductSyncContext) => Promise<Product | undefined>
  findProductByIdentification: (idType: string, value: string, context: ProductSyncContext) => Promise<Product | undefined>
  clearCache: (context: ProductSyncContext) => Promise<void>
}

let db: CommonDB | null = null
let currentOMS: string | null = null

async function ensureDB(context: ProductSyncContext) {
  if (!context.omsInstance) throw new Error('OMS instance is required to initialize product cache')
  if (db && currentOMS === context.omsInstance) return db

  db = createCommonDB(context.omsInstance)
  currentOMS = context.omsInstance
  await db.open()

  return db
}

function getHeaders(context: ProductSyncContext) {
  return {
    Authorization: `Bearer ${context.token}`,
    'Content-Type': 'application/json'
  }
}

async function upsertProducts(docs: any[], context: ProductSyncContext) {
  if (!docs?.length) return []

  const database = await ensureDB(context)
  const products = docs.map(mapApiDocToProduct)
  const identifications = getProductIdentifications(products)

  await database.transaction('rw', database.products, database.productIdentification, async () => {
    await database.products.bulkPut(products)
    if (identifications.length) await database.productIdentification.bulkPut(identifications)
  })

  return products
}

function getInventoryRows(resp: any) {
  return resp?.entityList || resp?.entityValueList || resp?.data?.entityList || resp?.data?.entityValueList || []
}

function normalizeInventoryRecord(record: any, fallbackProductId: string, fallbackFacilityId?: string): ProductInventory | null {
  const productId = record.productId || fallbackProductId
  const facilityId = record.facilityId || fallbackFacilityId

  if (!productId || !facilityId) return null

  return {
    productId,
    facilityId,
    availableToPromiseTotal: Number(record.availableToPromiseTotal ?? record.atp ?? 0),
    quantityOnHandTotal: Number(record.quantityOnHandTotal ?? record.qoh ?? 0),
    updatedAt: Date.now()
  }
}

async function upsertInventoryBatch(records: ProductInventory[], context: ProductSyncContext) {
  if (!records.length) return []

  const database = await ensureDB(context)
  await database.productInventory.bulkPut(records)

  return records
}

async function syncProductInventory(productIds: string[], context: ProductSyncContext): Promise<ProductInventory[]> {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))]
  if (!uniqueProductIds.length) return []

  await ensureDB(context)
  const inventoryRecords: ProductInventory[] = []

  for (const productId of uniqueProductIds) {
    try {
      const resp = await workerRemoteApi({
        baseURL: context.maargUrl || context.omsUrl,
        headers: getHeaders(context),
        url: 'oms/dataDocumentView',
        method: 'POST',
        data: {
          dataDocumentId: 'ProductFacilityAndInventoryItem',
          pageSize: 500,
          customParametersMap: {
            productId,
            ...(context.facilityId ? { facilityId: context.facilityId } : {})
          }
        }
      })

      getInventoryRows(resp).forEach((row: any) => {
        const inventoryRecord = normalizeInventoryRecord(row, productId, context.facilityId)
        if (inventoryRecord) inventoryRecords.push(inventoryRecord)
      })
    } catch (err) {
      console.warn(`[Worker] Failed to fetch inventory for ${productId}`, err)
    }
  }

  return upsertInventoryBatch(inventoryRecords, context)
}

async function syncProducts(params: ProductQueryParams, context: ProductSyncContext): Promise<ProductSyncResponse> {
  await ensureDB(context)

  const resp = await workerRemoteApi({
    baseURL: context.maargUrl || context.omsUrl,
    headers: getHeaders(context),
    url: 'admin/runSolrQuery',
    method: 'POST',
    data: buildProductQuery(params)
  })

  const response = resp?.response || resp?.data?.response || {}
  const products = await upsertProducts(response.docs || [], context)
  // const inventory = await syncProductInventory(products.map((product) => product.productId), context)

  return {
    products,
    total: response.numFound || products.length
  }
}

async function syncRemainingProducts(
  params: ProductQueryParams,
  context: ProductSyncContext,
  total: number,
  startViewIndex = 1
): Promise<ProductBackgroundSyncResponse> {
  const viewSize = params.viewSize || 50
  const pageCount = Math.ceil(total / viewSize)
  let synced = 0

  for (let viewIndex = startViewIndex; viewIndex < pageCount; viewIndex++) {
    const resp = await syncProducts({
      ...params,
      viewIndex,
      viewSize
    }, context)

    synced += resp.products.length
    if (!resp.products.length) break
  }

  return { synced, total }
}

async function getById(productId: string, context: ProductSyncContext) {
  if (!productId) return undefined

  const database = await ensureDB(context)
  const cached = await database.products.get(productId)
  const now = Date.now()
  const staleMs = context.staleMs || 60 * 60 * 1000

  if (cached && now - cached.updatedAt < staleMs) {
    return cached
  }

  const resp = await syncProducts({
    filter: `productId: ${productId}`,
    viewSize: 1
  }, context)

  return resp.products[0] || cached
}

async function findProductByIdentification(idType: string, value: string, context: ProductSyncContext) {
  if (!value) return undefined

  const database = await ensureDB(context)
  const ident = await database.table('productIdentification')
    .where('value')
    .equalsIgnoreCase(value)
    .and((item: any) => !idType || item.identKey === idType)
    .first()

  if (ident?.productId) {
    return database.products.get(ident.productId)
  }

  const identificationType = idType || context.barcodeIdentification
  if (!identificationType) return undefined

  const resp = await syncProducts({
    filter: `goodIdentifications:${identificationType}/${value},isVirtual:false,productTypeId:FINISHED_GOOD,-prodCatalogCategoryTypeIds:PCCT_DISCONTINUED`,
    viewSize: 1
  }, context)

  return resp.products[0]
}

async function clearCache(context: ProductSyncContext) {
  const database = await ensureDB(context)

  await database.transaction('rw', database.products, database.productIdentification, database.productInventory, async () => {
    await database.products.clear()
    await database.productIdentification.clear()
    await database.productInventory.clear()
  })
}

expose({
  syncProducts,
  syncRemainingProducts,
  syncProductInventory,
  getById,
  findProductByIdentification,
  clearCache
})
