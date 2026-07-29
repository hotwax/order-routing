import { db, initialize } from '@/services/appInitializer'
import { getProductIdentifications, mapApiDocToProduct } from '@/utils/productSync'
import type { Product } from '@/services/commonDatabase'

interface CachedProductPage {
  products: Product[]
  total: number
}

async function ensureDB() {
  await initialize()
  return db
}

async function getById(productId: string) {
  const database = await ensureDB()
  return database.products.get(productId)
}

async function searchCachedProducts(keyword: string, limit = 250) {
  const productPage = await getCachedProductsPage(keyword, 0, limit)
  return productPage.products
}

async function getCachedProductsPage(keyword = '', pageIndex = 0, pageSize = 50): Promise<CachedProductPage> {
  const database = await ensureDB()
  const term = keyword.trim().toLowerCase()
  const offset = pageIndex * pageSize

  if (!term) {
    const [products, total] = await Promise.all([
      database.products.orderBy('productId').offset(offset).limit(pageSize).toArray(),
      database.products.count()
    ])

    return { products, total }
  }

  const identifications = await database.productIdentification
    .where('value')
    .startsWithIgnoreCase(term)
    .toArray()

  const productIds = new Set(identifications.map((identification) => identification.productId))
  const products = await database.products.toArray()
  const filteredProducts = products.filter((product) =>
    productIds.has(product.productId) ||
    product.productId.toLowerCase().includes(term) ||
    product.productName?.toLowerCase().includes(term) ||
    product.parentProductName?.toLowerCase().includes(term) ||
    product.internalName?.toLowerCase().includes(term)
  )

  return {
    products: filteredProducts.slice(offset, offset + pageSize),
    total: filteredProducts.length
  }
}

async function upsertFromApi(docs: any[]) {
  if (!docs?.length) return []

  const database = await ensureDB()
  const products: Product[] = docs.map(mapApiDocToProduct)
  const identifications = getProductIdentifications(products)

  await database.transaction('rw', database.products, database.productIdentification, async () => {
    await database.products.bulkPut(products)
    if (identifications.length) await database.productIdentification.bulkPut(identifications)
  })

  return products
}

async function getProductInventory(productId: string, facilityId?: string) {
  const database = await ensureDB()

  if (facilityId) {
    return database.productInventory.get([productId, facilityId])
  }

  return database.productInventory
    .where('productId')
    .equals(productId)
    .toArray()
}

async function clearCache() {
  const database = await ensureDB()

  await database.transaction('rw', database.products, database.productIdentification, database.productInventory, async () => {
    await database.products.clear()
    await database.productIdentification.clear()
    await database.productInventory.clear()
  })
}

export function useProductMaster() {
  return {
    getById,
    getCachedProductsPage,
    getProductInventory,
    searchCachedProducts,
    upsertFromApi,
    clearCache
  }
}
