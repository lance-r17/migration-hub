import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { ProductCategoryEntry } from '@/types'

const ENDPOINTS = {
  productCategoryMap: '/api/v1/product-category-map',
}

export async function fetchProductCategoryMap(): Promise<ProductCategoryEntry[]> {
  if (USE_MOCK) { await delay(); return store.getProductCategoryMap() }
  return apiClient.get<ProductCategoryEntry[]>(ENDPOINTS.productCategoryMap)
}
