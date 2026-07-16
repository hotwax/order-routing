import { api, logger } from "@common"

/**
 * Resolves the transaction context + actors behind an order-linked inventory movement (sales,
 * transfer, or purchase) from its orderId, lazily on expand and cached per orderId.
 *
 * The three order-detail services return DIFFERENT, flattened shapes (not the nested @hotwax/oms-api
 * `Order` type), so each is parsed explicitly:
 *  - sales    `GET oms/orders/{id}`          → { orderDetail: { customerFirstName/LastName, orderDate,
 *                                                shipGroups:[{ pickerFirstName/LastName/GroupName (who
 *                                                shipped), shipmentId, trackingCode, items:[{unitPrice}] }] } }
 *  - transfer `GET oms/transferOrders/{id}`  → { order: { status, items:[{unitPrice, totalIssuedQuantity,
 *                                                totalReceivedQuantity}] } }   (no actor, no date)
 *  - purchase `GET oms/purchaseOrders/{id}`  → { order: { orderDate, orderStatusDesc, items:[{unitPrice}] } }
 *
 * Everything is optional; a missing field is omitted. The sales picker name arrives already resolved,
 * so no user lookup is needed for it.
 */

export interface OrderImpact {
  orderDate?: string | number
  orderStatusDesc?: string
  customerName?: string
  supplierName?: string
  unitPrice?: number | string       // price a sales/purchase line carried
  shippedBy?: string                // display-ready for sales (picker); may be a userId otherwise
  receivedBy?: string
  issuedQuantity?: number | string  // transfer
  receivedQuantity?: number | string
  shipmentId?: string
  trackingCode?: string
  facilityName?: string
  rejectionReasonEnumId?: string
}

function endpointFor(orderTypeId?: string): (orderId: string) => string {
  if (orderTypeId === "TRANSFER_ORDER") return (id) => `/oms/transferOrders/${id}`
  if (orderTypeId === "PURCHASE_ORDER") return (id) => `/oms/purchaseOrders/${id}`
  return (id) => `/oms/orders/${id}`
}

function personName(first?: string, last?: string, group?: string, fallbackId?: string): string | undefined {
  const g = (group || "").trim()
  if (g) return g
  const n = [first, last].filter(Boolean).join(" ").trim()
  return n || (fallbackId || undefined)
}

function findItem(items: any[], orderItemSeqId?: string): any {
  if (!items || !items.length) return undefined
  return orderItemSeqId ? items.find((it: any) => it?.orderItemSeqId === orderItemSeqId) : items[0]
}

export function useSalesOrder() {
  // orderId -> raw response (or null), so lines of one order share a fetch.
  const cache: Record<string, any> = {}

  async function fetchRaw(orderId: string, orderTypeId?: string): Promise<any> {
    const key = `${orderTypeId || "SALES"}::${orderId}`
    if (key in cache) return cache[key]
    let data: any = null
    try {
      const resp = await api({ url: endpointFor(orderTypeId)(orderId), method: "GET" }) as any
      data = resp?.data ?? null
    } catch (err) {
      logger.error(`Order detail lookup failed for ${orderId}`, err)
    }
    cache[key] = data
    return data
  }

  async function fetchOrderImpact(params: {
    orderId: string
    orderTypeId?: string
    orderItemSeqId?: string
    shipGroupSeqId?: string
  }): Promise<OrderImpact | null> {
    const { orderId, orderTypeId, orderItemSeqId, shipGroupSeqId } = params
    if (!orderId) return null
    const data = await fetchRaw(orderId, orderTypeId)
    if (!data) return null

    const impact: OrderImpact = {}

    if (orderTypeId === "TRANSFER_ORDER") {
      const o = data.order ?? data
      if (!o) return null
      const item = findItem(o.items || [], orderItemSeqId)
      impact.orderStatusDesc = o.status ?? o.orderStatusDesc
      if (item?.unitPrice != null) impact.unitPrice = item.unitPrice
      if (item?.totalIssuedQuantity != null) impact.issuedQuantity = item.totalIssuedQuantity
      if (item?.totalReceivedQuantity != null) impact.receivedQuantity = item.totalReceivedQuantity
      return impact
    }

    if (orderTypeId === "PURCHASE_ORDER") {
      const o = data.order ?? data
      if (!o) return null
      const item = findItem(o.items || [], orderItemSeqId)
      impact.orderDate = o.orderDate ?? o.entryDate
      impact.orderStatusDesc = o.orderStatusDesc ?? o.status
      if (item?.unitPrice != null) impact.unitPrice = item.unitPrice
      return impact
    }

    // SALES_ORDER (default)
    const d = data.orderDetail ?? data.order ?? data
    if (!d) return null
    const shipGroups: any[] = d.shipGroups || []
    const sg = shipGroupSeqId ? shipGroups.find((g: any) => g?.shipGroupSeqId === shipGroupSeqId) : shipGroups[0]
    const items = (sg?.items) || shipGroups.flatMap((g: any) => g?.items || [])
    const item = findItem(items, orderItemSeqId)

    impact.orderDate = d.orderDate ?? d.entryDate
    impact.customerName = personName(d.customerFirstName, d.customerLastName, d.customerGroupName, undefined) || d.billingAddress?.toName
    if (item?.unitPrice != null) impact.unitPrice = item.unitPrice
    if (sg) {
      impact.shippedBy = personName(sg.pickerFirstName, sg.pickerLastName, sg.pickerGroupName, sg.pickerId)
      impact.shipmentId = sg.shipmentId
      impact.trackingCode = sg.trackingCode
      impact.facilityName = sg.facilityName
    }
    return impact
  }

  return { fetchOrderImpact }
}
