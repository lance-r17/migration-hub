import { apiClient } from '@/services/client'
import type { BgiNode } from '@/types/bgi'

export async function getBgiHierarchy(): Promise<BgiNode | null> {
  const data = await apiClient.get<BgiNode | null>('/api/v1/bgi')
  return data
}

export async function setBgiHierarchy(root: BgiNode): Promise<BgiNode> {
  return apiClient.put<BgiNode>('/api/v1/bgi', { root })
}

export async function assignProjectsToBgi(bgi_id: string, project_ids: string[]): Promise<void> {
  return apiClient.post('/api/v1/bgi/assign-projects', { bgi_id, project_ids })
}

export async function unassignProjectsFromBgi(project_ids: string[]): Promise<void> {
  return apiClient.post('/api/v1/bgi/unassign-projects', { project_ids })
}
