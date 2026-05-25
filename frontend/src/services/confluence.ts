import { apiClient } from './client'

export interface ConfluenceParentPage {
  id: string
  title: string
  spaceKey: string
  pageId: string
  createdAt?: string
  updatedAt?: string
}

export interface ConfluenceStatus {
  configured: boolean
  space?: {
    valid: boolean
    name?: string
    key?: string
    error?: string
  }
}

export async function getConfluenceStatus(): Promise<ConfluenceStatus> {
  return apiClient.get<ConfluenceStatus>('/api/v1/confluence/status')
}

export async function listParentPages(): Promise<ConfluenceParentPage[]> {
  return apiClient.get<ConfluenceParentPage[]>('/api/v1/confluence/parent-pages')
}

export async function searchConfluencePages(query: string): Promise<{ id: string; title: string }[]> {
  const q = new URLSearchParams({ query })
  return apiClient.get<{ id: string; title: string }[]>(`/api/v1/confluence/pages/search?${q}`)
}

export async function createParentPage(body: {
  id?: string
  title: string
  spaceKey?: string
  pageId: string
}): Promise<ConfluenceParentPage> {
  return apiClient.post<ConfluenceParentPage>('/api/v1/confluence/parent-pages', body)
}

export async function deleteParentPage(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/confluence/parent-pages/${id}`)
}

export async function getPageParentId(pageId: string): Promise<string | null> {
  const data = await apiClient.get<{ parentPageId: string | null }>(
    `/api/v1/confluence/pages/${pageId}/parent-page-id`
  )
  return data.parentPageId
}

export async function exportEngagementNotes(
  projectId: string,
  parentPageId: string | null
): Promise<{ confluencePageId: string; confluencePageUrl: string }> {
  return apiClient.post<{ confluencePageId: string; confluencePageUrl: string }>(
    `/api/v1/confluence/projects/${projectId}/engagement/export`,
    { parentPageId }
  )
}
