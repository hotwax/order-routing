import { translate } from "@/i18n";
import logger from "@/logger";
import { OrderRoutingService } from "@/services/RoutingService";
import store from "@/store";
import { hasError, showToast } from "@/utils";
import { Ref, ref } from "vue";

export async function useOrderTest(queryString: string) {
  const orders = ref([])
  const errorMessage = ref("")
  const orderCarrierPartyIds: Ref<string[]> = ref([])

  if(!queryString.trim()) {
    showToast(translate("Enter valid order attribute for searching"))
    return;
  }

  const payload = {
    "json": {
      "params": {
        "rows": "10",
        "group": true,
        "group.field": "orderId",
        "group.limit": 1000,
        "group.ngroups": true,
        "q.op": "AND",
        "start": 0
      },
      "query":"(*:*)",
      "filter": `docType: ORDER AND orderId: ${queryString} AND -orderStatusId: (ORDER_REJECTED OR ORDER_CANCELLED)`
    }
  }

  try {
    const resp = await OrderRoutingService.findOrder(payload) as any;

    if(!hasError(resp) && resp.data.grouped?.orderId?.groups.length) {
      const productIds: Array<string> = [];
      orders.value = resp.data.grouped?.orderId?.groups.map((group: any) => {
        const groups = group.doclist.docs.reduce((shipGroups: any, item: any) => {
          productIds.push(item.productId)
          orderCarrierPartyIds.value.push(item.carrierPartyId)
          shipGroups[item.shipGroupSeqId] ? shipGroups[item.shipGroupSeqId].push(item) : shipGroups[item.shipGroupSeqId] = [item]
          return shipGroups
        }, {})

        return {
          orderId: group.doclist.docs[0].orderId,
          orderName: group.doclist.docs[0].orderName,
          orderStatusDesc: group.doclist.docs[0].orderStatusDesc,
          groups
        }
      })

      store.dispatch("util/fetchCarrierInformation", [...new Set(orderCarrierPartyIds.value)])

      if(productIds.length) {
        store.dispatch("product/fetchProducts", productIds)
      }
    } else {
      throw resp
    }
  } catch(error) {
    logger.error(error)
    errorMessage.value = "Unable to find order"
  }

  return { orders, errorMessage }
}