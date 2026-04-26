import { apiClient } from './client'
import type { AdminAttachment } from '@/types/attachment'

export interface Attachment {
  id: string
  filename: string
}

// ─── Project-scoped attachment operations ───────────────────────────────────

export async function uploadAttachment(projectId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  return apiClient.postForm<Attachment>(`/api/v1/projects/${projectId}/attachments`, form)
}

export async function getAttachments(projectId: string): Promise<Attachment[]> {
  return apiClient.get<Attachment[]>(`/api/v1/projects/${projectId}/attachments`)
}

export async function deleteAttachment(projectId: string, attachmentId: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/projects/${projectId}/attachments/${attachmentId}`)
}

// ─── Admin attachment management ────────────────────────────────────────────

interface AdminAttachmentApi {
  id: string
  project_id: string
  project_name: string
  filename: string
  file_path: string
  status: 'pending' | 'confirmed' | 'deleted'
  created_at: string | null
}

const ADMIN_ENDPOINT = '/api/v1/admin/attachments'

function mapAdminAttachment(raw: AdminAttachmentApi): AdminAttachment {
  return {
    id: raw.id,
    projectId: raw.project_id,
    projectName: raw.project_name,
    filename: raw.filename,
    filePath: raw.file_path,
    status: raw.status,
    createdAt: raw.created_at,
  }
}

export async function getAllAttachments(): Promise<AdminAttachment[]> {
  const raw = await apiClient.get<AdminAttachmentApi[]>(ADMIN_ENDPOINT)
  return raw.map(mapAdminAttachment)
}

export async function bulkDeleteAttachments(ids: string[]): Promise<{ deleted: number; notFound: string[] }> {
  return apiClient.post<{ deleted: number; notFound: string[] }>(`${ADMIN_ENDPOINT}/bulk-delete`, { ids })
}
