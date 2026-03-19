import { defineStore } from 'pinia'
import { ProductService } from "@/services/ProductService"
import { logger, commonUtil } from "@common"

export const useProductStore = defineStore('product', {
  state: () => {
    return {
      products: {} as any,
      stock: {} as any
    }
  },
  getters: {
    getProducts(state) {
      return state.products
    },
    getProductById: (state) => (id: string) => {
      return state.products[id] || {}
    },
    getProductStock: (state) => (productId: string, facilityId: string) => {
      return state.stock[productId] ? state.stock[productId][facilityId] ? state.stock[productId][facilityId] : {} : {}
    },
  },
  actions: {
    async fetchProducts(productIds: Array<any>) {
      const cachedProductIds = Object.keys(this.products);
      const productIdFilter= productIds.reduce((filter: string, productId: any) => {
        if (cachedProductIds.includes(productId)) {
          return filter;
        } else {
          if (filter !== '') filter += ' OR '
          return filter += productId;
        }
      }, '');
  
      if (productIdFilter === '') return;
  
      try {
        const resp = await ProductService.fetchProducts({
          "filters": ['productId: (' + productIdFilter + ')'],
          "viewSize": productIds.length
        })
        if(resp.data.response && !commonUtil.hasError(resp)) {
          const products = resp.data.response.docs.reduce((products: any, product: any) => {
            products[product.productId] = product
            return products;
          }, {});
          if(resp.data) this.products = { ...this.products, ...products };
        } else {
          throw resp.data;
        }
      } catch(err) {
        logger.error("Failed to fetch product information", err)
      }
    },
    async fetchStock(shipGroup: Array<any>) {
      const productIds = shipGroup.map((item: any) => item.productId)
      const facilityId = shipGroup[0].facilityId
      for(const productId of productIds) {
        if(this.stock[productId]?.[facilityId]) {
          continue;
        }
  
        try {
          const payload = {
            productId,
            facilityId
          }
    
          const resp: any = await ProductService.getInventoryAvailableByFacility(payload);
          if (!commonUtil.hasError(resp)) {
            if(this.stock[productId]) {
              this.stock[productId][facilityId] = resp.data
            } else {
              this.stock[productId] = {
                [facilityId]: resp.data
              }
            }
          } else {
            throw resp.data;
          }
        } catch (err) {
          logger.error(err)
        }
      }
    },
    async clearProductState() {
      this.products = {};
    }
  },
  persist: true
})
