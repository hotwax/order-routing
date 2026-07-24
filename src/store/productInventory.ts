import { defineStore } from 'pinia'
import { api, commonUtil, emitter, logger } from '@common'
import { WorkerFactory } from '@common/core/workerFactory'
import { clearProductCache, initialize } from '@/services/appInitializer'
import type { ProductSyncContext, ProductSyncWorker } from '@/workers/productSyncWorker'

export interface ProductInventoryInformation {
  productId: string;
  [key: string]: any;
}

export interface ProductInventoryState {
  productsInventory: Record<string, ProductInventoryInformation>;
  productList: ProductInventoryInformation[];
  total: number;
  isProductSyncing: boolean;
  productSyncCompletedAt: number;
}

let activeProductSyncWorker: any = null
let activeProductSyncKey = ''

function getProductSyncContext(): ProductSyncContext {
  const context = {
    omsInstance: commonUtil.getOMSInstanceName(),
    maargUrl: commonUtil.getMaargURL(),
    omsUrl: commonUtil.getOmsURL(),
    token: commonUtil.getToken() || ''
  }

  if (!context.omsInstance) throw new Error('OMS instance is required to sync products')

  return context
}

function getProductSyncKey(payload: any, viewSize: number) {
  return [
    payload.queryString || '',
    payload.facilityId || '',
    viewSize
  ].join('|')
}

export const useProductInventoryStore = defineStore('productInventory', {
  state: (): ProductInventoryState => ({
    productsInventory: {},
    productList: [],
    total: 0,
    isProductSyncing: false,
    productSyncCompletedAt: 0
  }),
  getters: {
    getProductInventory: (state) => state.productsInventory,
    getProducts: (state) => state.productList,
    getTotalProducts: (state) => state.total,
    getIsProductSyncing: (state) => state.isProductSyncing,
    getProductSyncCompletedAt: (state) => state.productSyncCompletedAt,
    getProductInventoryByProductId: (state) => (productId: string) => state.productsInventory[productId] || {}
  },
  actions: {
    async findProduct(payload: any) {
      const viewIndex = payload.viewIndex ?? payload.pageIndex ?? 0
      const viewSize = payload.viewSize ?? payload.pageSize ?? 50

      if (viewIndex === 0) emitter.emit("presentLoader");

      let resp = { products: [] as ProductInventoryInformation[], inventory: [] as any[], total: 0 };
      let productWorker: any = null;
      let shouldTerminateWorker = true;
      let startedBackgroundSync = false;

      try {
        await initialize()
        productWorker = WorkerFactory.createWorker<ProductSyncWorker>(new URL('@/workers/productSyncWorker.ts', import.meta.url))

        const context = {
          ...getProductSyncContext(),
          ...(payload.facilityId ? { facilityId: payload.facilityId } : {})
        }

        resp = await productWorker.api.syncProducts({
          filter: 'isVirtual:false,isVariant:true',
          viewSize,
          viewIndex,
          keyword: payload.queryString
        }, context)

        this.productsInventory = resp.products.reduce((productsByProductId: Record<string, ProductInventoryInformation>, product: ProductInventoryInformation) => {
          productsByProductId[product.productId] = {
            ...productsByProductId[product.productId],
            ...product
          }
          return productsByProductId
        }, { ...this.productsInventory })

        this.productList = viewIndex && viewIndex > 0
          ? this.productList.concat(resp.products)
          : resp.products
        this.total = resp.total

        if (resp.inventory?.length) {
          this.productsInventory = resp.inventory.reduce((productsByProductId: Record<string, ProductInventoryInformation>, inventory: any) => {
            productsByProductId[inventory.productId] = {
              ...productsByProductId[inventory.productId],
              inventory: {
                ...(productsByProductId[inventory.productId]?.inventory || {}),
                [inventory.facilityId]: inventory
              }
            }
            return productsByProductId
          }, { ...this.productsInventory })

          this.productList = this.productList.map((product) => this.productsInventory[product.productId] || product)
        }

        if (payload.syncAll && viewIndex === 0 && resp.total > resp.products.length) {
          const syncKey = getProductSyncKey(payload, viewSize)

          if (activeProductSyncWorker && activeProductSyncKey !== syncKey) {
            activeProductSyncWorker.worker.terminate()
            activeProductSyncWorker = null
            activeProductSyncKey = ''
          }

          if (!activeProductSyncWorker) {
            activeProductSyncWorker = productWorker
            activeProductSyncKey = syncKey
            this.isProductSyncing = true
            shouldTerminateWorker = false
            startedBackgroundSync = true

            productWorker.api.syncRemainingProducts({
              filter: 'isVirtual:false,isVariant:true',
              viewSize,
              keyword: payload.queryString
            }, context, resp.total, 1).then((backgroundResp: any) => {
              if (activeProductSyncKey === syncKey) this.total = backgroundResp.total
            }).catch((error: any) => {
              logger.error(error)
            }).finally(() => {
              if (activeProductSyncWorker === productWorker) {
                activeProductSyncWorker = null
                activeProductSyncKey = ''
                this.isProductSyncing = false
                this.productSyncCompletedAt = Date.now()
              }
              productWorker.worker.terminate()
            })
          }
        }

        if (!startedBackgroundSync && !this.isProductSyncing) this.productSyncCompletedAt = Date.now()
      } catch (error) {
        logger.error(error)
        if (!viewIndex) {
          this.productsInventory = {}
          this.productList = []
          this.total = 0
        }
      } finally {
        if (shouldTerminateWorker) productWorker?.worker.terminate()
      }

      if (viewIndex === 0) emitter.emit("dismissLoader");
      return resp;
    },
    async clearProductInventory() {
      if (activeProductSyncWorker) {
        activeProductSyncWorker.worker.terminate()
        activeProductSyncWorker = null
        activeProductSyncKey = ''
      }

      try {
        await clearProductCache()
      } catch (err) {
        logger.error('Failed to clear product inventory cache', err)
      }

      this.productsInventory = {}
      this.productList = []
      this.total = 0
      this.isProductSyncing = false
      this.productSyncCompletedAt = 0
    },
    async fetchStock(productIds: Array<string>, facilityId: string) {
      const fetchPromises = productIds.map(async (productId) => {
        try {
          const resp: any = await api({
            url: "poorti/getInventoryAvailableByFacility",
            method: "GET",
            params: {
              productId,
              facilityId
            }
          });

          if (!commonUtil.hasError(resp)) {
            this.productsInventory[productId] = {
              ...(this.productsInventory[productId] || { productId }),
              [facilityId]: resp.data
            }
          } else {
            throw resp.data;
          }
        } catch (err) {
          logger.error(err)
        }
      })

      await Promise.all(fetchPromises);
    }
  }
})
