import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { CategoryMilestone } from '@/types/categoryMilestone'

const ENDPOINTS = {
  categoryMilestones: '/api/v1/category-milestones',
  categoryMilestone: (id: string) => `/api/v1/category-milestones/${id}`,
  batchAssign: '/api/v1/category-milestones/batch-assign',
}

interface CategoryMilestoneApiRecord {
  id: string
  name: string
  start_date: string
  end_date: string
  color?: string
  icon?: string
  created_at: string
}

function fromApi(r: CategoryMilestoneApiRecord): CategoryMilestone {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
  }
}

function toApi(data: Omit<CategoryMilestone, 'id' | 'createdAt'>) {
  return {
    name: data.name,
    start_date: data.startDate,
    end_date: data.endDate,
    color: data.color,
    icon: data.icon,
  }
}

export async function getCategoryMilestones(): Promise<CategoryMilestone[]> {
  if (USE_MOCK) { await delay(); return store.getCategoryMilestones() }
  const records = await apiClient.get<CategoryMilestoneApiRecord[]>(ENDPOINTS.categoryMilestones)
  return records.map(fromApi)
}

export async function createCategoryMilestone(
  data: Omit<CategoryMilestone, 'id' | 'createdAt'>,
): Promise<CategoryMilestone> {
  if (USE_MOCK) {
    await delay(300)
    const cm: CategoryMilestone = {
      ...data,
      id: `cm-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    }
    return store.addCategoryMilestone(cm)
  }
  const record = await apiClient.post<CategoryMilestoneApiRecord>(ENDPOINTS.categoryMilestones, toApi(data))
  return fromApi(record)
}

export async function updateCategoryMilestone(
  id: string,
  patch: Partial<Omit<CategoryMilestone, 'id' | 'createdAt'>>,
): Promise<CategoryMilestone> {
  if (USE_MOCK) { await delay(300); return store.updateCategoryMilestone(id, patch) }
  const record = await apiClient.patch<CategoryMilestoneApiRecord>(ENDPOINTS.categoryMilestone(id), {
    name: patch.name,
    start_date: patch.startDate,
    end_date: patch.endDate,
    color: patch.color,
    icon: patch.icon,
  })
  return fromApi(record)
}

export async function deleteCategoryMilestone(id: string): Promise<void> {
  if (USE_MOCK) { await delay(200); store.deleteCategoryMilestone(id); return }
  await apiClient.delete<void>(ENDPOINTS.categoryMilestone(id))
}

export async function batchAssignCategoryMilestone(
  categoryMilestoneId: string,
  projectIds: string[],
  unassign: boolean = false,
): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    store.batchAssignCategoryMilestone(categoryMilestoneId, projectIds, unassign)
    return
  }
  await apiClient.post<void>(ENDPOINTS.batchAssign, {
    category_milestone_id: categoryMilestoneId,
    project_ids: projectIds,
    unassign,
  })
}
