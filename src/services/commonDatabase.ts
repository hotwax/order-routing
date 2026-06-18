import Dexie, { Table } from 'dexie'

export interface Product {
  productId: string
  productName?: string
  parentProductName?: string
  title?: string
  primaryProductCategoryName?: string
  internalName?: string
  mainImageUrl?: string
  goodIdentifications?: { type: string; value: string }[]
  updatedAt: number
}

export interface ProductInventory {
  productId: string
  facilityId: string
  availableToPromiseTotal: number
  quantityOnHandTotal: number
  updatedAt: number
}

export class CommonDB extends Dexie {
  products!: Table<Product, string>
  productIdentification!: Table<{ productId: string; identKey: string; value: string }, [string, string]>
  productInventory!: Table<ProductInventory, [string, string]>

  constructor(omsInstance: string) {
    super(`${omsInstance}-CommonDB`)

    this.version(1).stores({
      products: 'productId, updatedAt',
      productIdentification: '[productId+identKey], identKey, value',
      productInventory: '[productId+facilityId], productId, facilityId'
    })
  }
}

export function createCommonDB(omsInstance: string) {
  return new CommonDB(omsInstance)
}
