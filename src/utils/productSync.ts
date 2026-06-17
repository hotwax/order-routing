import type { Product } from '@/services/commonDatabase'

export const DEFAULT_PRODUCT_FIELDS = 'productId,productName,parentProductName,title,primaryProductCategoryName,internalName,mainImageUrl,goodIdentifications'

export interface ProductQueryParams {
  keyword?: string
  viewSize?: number
  viewIndex?: number
  docType?: string
  filter?: string
  filters?: Record<string, { value: any; op?: string }>
  fieldsToSelect?: string
  queryFields?: string
  sort?: string
}

export function mapApiDocToProduct(doc: any): Product {
  const normalizedIdents = (doc.goodIdentifications || []).map((ident: any) => {
    if (typeof ident === 'string') {
      const slashIndex = ident.indexOf('/')
      if (slashIndex !== -1) {
        return {
          type: ident.substring(0, slashIndex).trim(),
          value: ident.substring(slashIndex + 1).trim()
        }
      }

      return { type: '', value: ident.trim() }
    }

    if (ident && typeof ident === 'object') {
      return {
        type: String(ident.type || '').trim(),
        value: String(ident.value || '').trim()
      }
    }

    return { type: '', value: '' }
  })

  return {
    productId: doc.productId,
    productName: doc.productName || '',
    parentProductName: doc.parentProductName || '',
    title: doc.title || '',
    primaryProductCategoryName: doc.primaryProductCategoryName || '',
    internalName: doc.internalName || '',
    mainImageUrl: doc.mainImageUrl || '',
    goodIdentifications: normalizedIdents,
    updatedAt: Date.now()
  }
}

export function getProductIdentifications(products: Product[]) {
  const identifications: { productId: string; identKey: string; value: string }[] = []

  products.forEach((product) => {
    if (!product.goodIdentifications?.length) return

    product.goodIdentifications.forEach((ident) => {
      const identKey = ident.type?.trim()
      const value = ident.value?.trim()
      if (!identKey || !value) return

      identifications.push({
        productId: product.productId,
        identKey,
        value
      })
    })
  })

  return identifications
}

export function buildProductQuery(params: ProductQueryParams): Record<string, any> {
  const viewSize = params.viewSize || Number(import.meta.env.VITE_VIEW_SIZE) || 100
  const viewIndex = params.viewIndex || 0

  const payload: any = {
    json: {
      params: {
        rows: viewSize,
        'q.op': 'AND',
        start: viewIndex * viewSize
      },
      query: '(*:*)',
      filter: [`docType:${params.docType || 'PRODUCT'}`]
    }
  }

  if (params.sort) payload.json.params.sort = params.sort
  payload.json.params.fl = params.fieldsToSelect || DEFAULT_PRODUCT_FIELDS

  const keyword = params.keyword?.trim()
  if (keyword) {
    const wildcardTerms = keyword
      .split(/\s+/)
      .filter(Boolean)
      .map((term: string) => `*${term}*`)
      .join(' OR ')

    payload.json.query = `${wildcardTerms} OR "${keyword}"^100`
    payload.json.params.qf = params.queryFields || 'sku^100 upc^100 productName^50 internalName^40 productId groupId groupName'
    payload.json.params.defType = 'edismax'
  }

  if (params.filter) {
    params.filter
      .split(',')
      .map((filter: string) => filter.trim())
      .filter(Boolean)
      .forEach((filter: string) => payload.json.filter.push(filter))
  }

  if (params.filters) {
    Object.keys(params.filters).forEach((key) => {
      const filterConfig = params.filters?.[key]
      if (!filterConfig) return

      const filterValue = filterConfig.value
      if (Array.isArray(filterValue)) {
        const filterOperator = filterConfig.op || 'OR'
        payload.json.filter.push(`${key}: (${filterValue.join(` ${filterOperator} `)})`)
      } else {
        payload.json.filter.push(`${key}: ${filterValue}`)
      }
    })
  }

  return payload
}
