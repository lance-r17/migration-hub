import { apiClient } from '@/services/client'
import type { GbiHierarchy, GbiNode } from '@/types/gbi'

export async function getGbiHierarchy(): Promise<GbiNode | null> {
  const data = await apiClient.get<GbiNode | null>('/api/v1/gbi')
  return data
}

export async function setGbiHierarchy(root: GbiNode): Promise<GbiNode> {
  return apiClient.put<GbiNode>('/api/v1/gbi', { root })
}

export async function assignProjectsToGbi(gbi_id: string, project_ids: string[]): Promise<void> {
  return apiClient.post('/api/v1/gbi/assign-projects', { gbi_id, project_ids })
}

export async function unassignProjectsFromGbi(project_ids: string[]): Promise<void> {
  return apiClient.post('/api/v1/gbi/unassign-projects', { project_ids })
}
