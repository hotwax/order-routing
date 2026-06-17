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

// const primaryId = (product?: any) => {
//   if (!product) return ''
//   const pref = useProductStore().getPrimaryId

//   const parsedGoodIds = Array.isArray(product.goodIdentifications) ? product.goodIdentifications.map((goodIdentification: any) => {
//     if (typeof goodIdentification === 'string' && goodIdentification.includes('/')) {
//       const [type, value] = goodIdentification.split('/', 2)
//       return { type: type?.trim(), value: value?.trim() }
//     }
//     return goodIdentification
//   }) : []

//   const resolve = (type: string) => {
//     if (!type) return ''
//     if (['SKU', 'SHOPIFY_PROD_SKU'].includes(type))
//       return parsedGoodIds.find((goodIdentification: any) => goodIdentification.type === 'SKU')?.value || ''
//     if (type === 'internalName') return product.internalName || ''
//     if (type === 'productId') return product.productId || ''
//     if (type === 'parentProductName' || type === 'groupName') return product.parentProductName || ''
//     if (type === 'title') return product.title || ''
//     if (type === 'primaryProductCategoryName') return product.primaryProductCategoryName || ''
//     return parsedGoodIds.find((goodIdentification: any) => goodIdentification.type === type)?.value || ''
//   }

//   // Try preference, then fallback to SKU or productId
//   return resolve(pref) || resolve('SKU') || product.productId || ''
// }

// const secondaryId = (product: any) => {
//   if (!product) return ''
//   const pref = useProductStore().getSecondaryId

//   // Parse any flat "TYPE/VALUE" strings (from Solr)
//   const parsedGoodIds = Array.isArray(product.goodIdentifications) ? product.goodIdentifications.map((goodIdentification: any) => {
//     if (typeof goodIdentification === 'string' && goodIdentification.includes('/')) {
//       const [type, value] = goodIdentification.split('/', 2)
//       return { type: type?.trim(), value: value?.trim() }
//     }
//     return goodIdentification
//   }) : []

//   const resolve = (type: string) => {
//     if (!type) return ''
//     if (['SKU', 'SHOPIFY_PROD_SKU'].includes(type))
//       return parsedGoodIds.find((goodIdentification: any) => goodIdentification.type === 'SKU')?.value || ''
//     if (type === 'internalName') return product.internalName || ''
//     if (type === 'productId') return product.productId || ''
//     if (type === 'parentProductName' || type === 'groupName') return product.parentProductName || ''
//     if (type === 'title') return product.title || ''
//     if (type === 'primaryProductCategoryName') return product.primaryProductCategoryName || ''
//     return parsedGoodIds.find((goodIdentification: any) => goodIdentification.type === type)?.value || ''
//   }

//   // Try preference, then fallback to productId
//   return resolve(pref) || product.productId || ''
// }

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
