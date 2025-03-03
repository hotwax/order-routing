import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import ProductState from "./ProductState"
import logger from "@/logger"
import { hasError } from "@/utils"
import * as types from "./mutation-types"
import { ProductService } from "@/services/ProductService"

const actions: ActionTree<ProductState, RootState> = {
  async fetchProducts({ commit, state }, productIds) {
    const cachedProductIds = Object.keys(state.products);
    const productIdFilter= productIds.reduce((filter: string, productId: any) => {
      // If product already exist in cached products skip
      if (cachedProductIds.includes(productId)) {
        return filter;
      } else {
        // checking condition that if the filter is not empty then adding 'OR' to the filter
        if (filter !== '') filter += ' OR '
        return filter += productId;
      }
    }, '');

    // If there are no products skip the API call
    if (productIdFilter === '') return;

    try {
      // adding viewSize as by default we are having the viewSize of 10
      const resp = await ProductService.fetchProducts({
        "filters": ['productId: (' + productIdFilter + ')'],
        "viewSize": productIds.length
      })
      if(resp.data.response && !hasError(resp)) {
        const products = resp.data.response.docs.reduce((products: any, product: any) => {
          products[product.productId] = product
          return products;
        }, {});
        // Handled empty response in case of failed query
        if(resp.data) commit(types.PRODUCT_LIST_UPDATED, products);
      } else {
        throw resp.data;
      }
    } catch(err) {
      logger.error("Failed to fetch product information", err)
    }
  },

  async fetchStock({ commit, state }, shipGroup) {
    const productIds = shipGroup.map((item: any) => item.productId)
    const facilityId = shipGroup[0].facilityId
    for(const productId of productIds) {
      if(state.stock[productId]?.[facilityId]) {
        continue;
      }

      try {
        const payload = {
          productId,
          facilityId
        }
  
        const resp: any = await ProductService.getInventoryAvailableByFacility(payload);
        if (!hasError(resp)) {
          commit(types.PRODUCT_STOCK_UPDATED, { productId: payload.productId, facilityId: facilityId, stock: resp.data })
        } else {
          throw resp.data;
        }
      } catch (err) {
        logger.error(err)
      }
    }
  },

  async clearProductState({ commit }) {
    commit(types.PRODUCT_CLEARED)
  }
}

export default actions;