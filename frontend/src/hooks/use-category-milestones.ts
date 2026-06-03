import { useState, useEffect, useCallback } from 'react'
import {
  getCategoryMilestones,
  createCategoryMilestone as svcCreate,
  updateCategoryMilestone as svcUpdate,
  deleteCategoryMilestone as svcDelete,
  batchAssignCategoryMilestone as svcBatchAssign,
} from '@/services/categoryMilestones'
import type { CategoryMilestone } from '@/types/categoryMilestone'

interface CategoryMilestonesState {
  categoryMilestones: CategoryMilestone[]
  loading: boolean
  error: string | null
}

export function useCategoryMilestones(options?: { enabled?: boolean }): CategoryMilestonesState & {
  createCategoryMilestone: (data: Omit<CategoryMilestone, 'id' | 'createdAt'>) => Promise<CategoryMilestone>
  updateCategoryMilestone: (id: string, patch: Partial<Omit<CategoryMilestone, 'id' | 'createdAt'>>) => Promise<CategoryMilestone>
  deleteCategoryMilestone: (id: string) => Promise<void>
  batchAssign: (categoryMilestoneId: string, projectIds: string[], unassign?: boolean) => Promise<void>
  refresh: () => void
} {
  const enabled = options?.enabled !== false
  const [state, setState] = useState<CategoryMilestonesState>({
    categoryMilestones: [],
    loading: enabled,
    error: null,
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getCategoryMilestones()
      .then(cms => {
        if (!cancelled) setState({ categoryMilestones: cms, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          categoryMilestones: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load category milestones',
        })
      })
    return () => { cancelled = true }
  }, [enabled, refreshKey])

  const handleCreate = useCallback(async (data: Omit<CategoryMilestone, 'id' | 'createdAt'>) => {
    const cm = await svcCreate(data)
    setState(prev => ({ ...prev, categoryMilestones: [...prev.categoryMilestones, cm] }))
    return cm
  }, [])

  const handleUpdate = useCallback(async (id: string, patch: Partial<Omit<CategoryMilestone, 'id' | 'createdAt'>>) => {
    const updated = await svcUpdate(id, patch)
    setState(prev => ({
      ...prev,
      categoryMilestones: prev.categoryMilestones.map(cm => cm.id === id ? updated : cm),
    }))
    return updated
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await svcDelete(id)
    setState(prev => ({
      ...prev,
      categoryMilestones: prev.categoryMilestones.filter(cm => cm.id !== id),
    }))
  }, [])

  const handleBatchAssign = useCallback(async (categoryMilestoneId: string, projectIds: string[], unassign = false) => {
    await svcBatchAssign(categoryMilestoneId, projectIds, unassign)
  }, [])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  return {
    ...state,
    createCategoryMilestone: handleCreate,
    updateCategoryMilestone: handleUpdate,
    deleteCategoryMilestone: handleDelete,
    batchAssign: handleBatchAssign,
    refresh,
  }
}
