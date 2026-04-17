import { useState, useEffect } from 'react'
import { fetchProductCategoryMap } from '@/services/productCategory'
import type { ProductCategoryEntry, ResourceCategory } from '@/types'

export function useProductCategoryMap() {
  const [entries, setEntries] = useState<ProductCategoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchProductCategoryMap()
      .then(data => { if (!cancelled) { setEntries(data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const map: Record<string, ResourceCategory> = {}
  const nameMap: Record<string, string> = {}
  for (const e of entries) {
    map[e.product] = e.category
    nameMap[e.product] = e.product_name
  }

  function getCategoryForProduct(product?: string): ResourceCategory {
    return (product ? (map[product] ?? 'computing') : 'computing')
  }

  function getNameForProduct(product?: string): string {
    return (product ? (nameMap[product] ?? product) : '—')
  }

  return { map, loading, getCategoryForProduct, getNameForProduct }
}
