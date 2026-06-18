import { commonUtil } from '@common'
import { CommonDB, createCommonDB } from '@/services/commonDatabase'

export let db: CommonDB
let currentOMS: string | null = null

export async function initialize() {
  const oms = commonUtil.getOMSInstanceName()

  if (!oms) {
    console.warn('[AppInit] OMS instance not selected yet.')
    return
  }

  if (!db || currentOMS !== oms) {
    db = createCommonDB(oms)
    currentOMS = oms
    await db.open()
  }
}

export async function clearProductCache() {
  if (!db) return

  await db.transaction('rw', db.products, db.productIdentification, db.productInventory, async () => {
    await db.products.clear()
    await db.productIdentification.clear()
    await db.productInventory.clear()
  })
}
