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
  for (const e of entries) map[e.product] = e.category

  function getCategoryForProduct(product?: string): ResourceCategory {
    return (product ? (map[product] ?? 'Other') : 'Other')
  }

  return { map, loading, getCategoryForProduct }
}
