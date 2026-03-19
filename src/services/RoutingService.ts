import { logger, api } from "@common"
import { useProductStore } from "@/store/productStore";
import { useUserStore } from "@/store/userStore";
import { useUtilStore } from "@/store/utilStore";
import { commonUtil } from "@common";

const fetchRoutingGroups = async (payload: any): Promise<any> => {
  return api({
    url: "order-routing/groups", 
    method: "GET",
    params: payload
  });
}

const fetchRoutingGroupInformation = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `order-routing/groups/${routingGroupId}`,
    method: "GET"
  });
}

const fetchRoutingScheduleInformation = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `order-routing/groups/${routingGroupId}/schedule`,
    method: "GET"
  });
}

const fetchRoutingHistory = async (routingGroupId: string, params: any): Promise<any> => {
  return api({
    url: `order-routing/groups/${routingGroupId}/routingRuns`,
    method: "GET",
    params
  });
}

const fetchGroupHistory = async (jobName: string, params: any): Promise<any> => {
  return api({
    url: `order-routing/serviceJobRuns/${jobName}`,
    method: "GET",
    params
  });
}

const createRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: "order-routing/groups",
    method: "POST",
    data: payload
  })
}

const updateRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/groups/${payload.routingGroupId}`,
    method: "POST",
    data: payload
  })
}

const cloneGroup = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/groups/${payload.routingGroupId}/clone`,
    method: "POST",
    data: payload
  })
}

const fetchOrderRouting = async (orderRoutingId: string): Promise<any> => {
  return api({
    url: `order-routing/routings/${orderRoutingId}`,
    method: "GET"
  })
}

const createRoutingRule = async (payload: any): Promise<any> => {
  return await api({
    url: "order-routing/rules",
    method: "POST",
    data: payload
  })
}

const createOrderRouting = async (payload: any): Promise<any> => {
  return await api({
    url: "order-routing/routings",
    method: "POST",
    data: payload
  })
}

const cloneRouting = async (payload: any): Promise<any> => {
  return await api({
    url: `order-routing/routings/${payload.orderRoutingId}/clone`,
    method: "POST",
    data: payload
  })
}

const updateRouting = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/routings/${payload.orderRoutingId}`,
    method: "POST",
    data: payload
  });
}

const deleteRoutingFilter = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/routings/${payload.orderRoutingId}/orderFilters`,
    method: "DELETE",
    data: payload
  });
}

const deleteRuleCondition = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/rules/${payload.routingRuleId}/inventoryFilters`,
    method: "DELETE",
    data: payload
  });
}

const deleteRuleAction = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/rules/${payload.routingRuleId}/actions`,
    method: "DELETE",
    data: payload
  });
}

const fetchRule = async (routingRuleId: string): Promise<any> => {
  return api({
    url: `order-routing/rules/${routingRuleId}`,
    method: "GET"
  });
}

const cloneRule = async (payload: any): Promise<any> => {
  return await api({
    url: `order-routing/rules/${payload.routingRuleId}/clone`,
    method: "POST",
    data: payload
  })
}

const updateRule = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/rules/${payload.routingRuleId}`,
    method: "POST",
    data: payload
  });
}

const scheduleBrokering = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/groups/${payload.routingGroupId}/schedule`,
    method: "POST",
    data: payload
  });
}

const runNow = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `order-routing/groups/${routingGroupId}/runNow`,
    method: "POST"
  });
}

const findOrder = async (queryString: string, orderId: string): Promise<any> => {

  let orders = []
  let errorMessage = "";
  const orderCarrierPartyIds: Array<string> = [];
  const payload = {
    "json": {
      "params": {
        "rows": "10",
        "group": true,
        "group.field": "orderId",
        "group.limit": 1000,
        "group.ngroups": true,
        "q.op": "AND",
        "start": 0,
        "qf": "orderId^10 search_orderIdentifications search_goodIdentifications orderNotes^5 externalOrderId^5 customerPartyName^20  productId^3 productName parentProductName internalName parentProductId",
        "defType": "edismax"
      },
      "query": `(*${queryString.trim()}*) OR "${queryString.trim()}"^100`,
      "filter": `docType: ORDER AND orderTypeId: SALES_ORDER AND orderStatusId: ORDER_APPROVED AND productStoreId: ${useUserStore().getCurrentEComStore?.productStoreId} AND -shipmentMethodTypeId: STOREPICKUP`
    }
  }

  // If having orderId, then perform searching on the same
  if(orderId) {
    payload.json.filter += `AND orderId: ${orderId}`
  }

  try {
    const resp = await api({
      url: "solr-query",
      method: "post",
      baseURL: commonUtil.getOmsURL(),
      data: payload
    });

    if(!commonUtil.hasError(resp) && resp.data.grouped?.orderId?.groups.length) {
      const productIds: Array<string> = [];
      orders = resp.data.grouped?.orderId?.groups.map((group: any) => {
        const groups = group.doclist.docs.reduce((shipGroups: any, item: any) => {
          productIds.push(item.productId)
          orderCarrierPartyIds.push(item.carrierPartyId)
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

      useUtilStore().fetchCarrierInformation( [...new Set(orderCarrierPartyIds)])

      if(productIds.length) {
        await useProductStore().fetchProducts( productIds)
      }
    } else {
      throw resp
    }
  } catch(error) {
    logger.error(error)
    errorMessage = "Unable to find order"
  }

  return {
    orders,
    errorMessage
  }
}

const brokerOrder = async(payload: any): Promise<any> => {
  return api({
    url: `order-routing/groups/${payload.routingGroupId}/run`,
    method: "POST",
    data: payload
  })
}

const resetOrder = async(payload: any): Promise<any> => {
  return api({
    url: `order-routing/orders/${payload.orderId}/reject`,
    method: "POST",
    data: payload
  })
}

const getRecentOrderFacilityChangeInfo = async(payload: any): Promise<any> => {
  return api({
    url: `order-routing/orders/${payload.orderId}/routing-history/recent`,
    method: "GET",
    data: payload
  })
}

export const OrderRoutingService = {
  brokerOrder,
  cloneGroup,
  createOrderRouting,
  cloneRouting,
  cloneRule,
  createRoutingGroup,
  createRoutingRule,
  deleteRoutingFilter,
  deleteRuleAction,
  deleteRuleCondition,
  fetchGroupHistory,
  fetchOrderRouting,
  fetchRoutingGroupInformation,
  fetchRoutingGroups,
  fetchRoutingHistory,
  fetchRoutingScheduleInformation,
  fetchRule,
  findOrder,
  getRecentOrderFacilityChangeInfo,
  resetOrder,
  runNow,
  scheduleBrokering,
  updateRouting,
  updateRoutingGroup,
  updateRule
}