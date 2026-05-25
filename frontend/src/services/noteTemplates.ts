import type { NoteTemplate, NoteTemplateVersion } from '@/types'
import {
  getAllNoteTemplates,
  getNoteTemplateById,
  upsertNoteTemplate,
  deleteNoteTemplate as storeDelete,
  createBlankNoteTemplate,
} from '@/data/noteTemplates'
import { USE_MOCK, apiClient } from './client'

const delay = (ms = 300) => new Promise(res => setTimeout(res, ms))

export async function getNoteTemplates(label?: string): Promise<NoteTemplate[]> {
  if (USE_MOCK) {
    await delay()
    const all = getAllNoteTemplates()
    if (!label) return all
    return all.filter(t => t.labels.includes(label))
  }
  const params = label ? `?label=${encodeURIComponent(label)}` : ''
  return apiClient.get<NoteTemplate[]>(`/api/v1/note-templates${params}`)
}

export async function getNoteTemplate(id: string): Promise<NoteTemplate> {
  if (USE_MOCK) {
    await delay()
    const t = getNoteTemplateById(id)
    if (!t) throw new Error(`Template ${id} not found`)
    return t
  }
  return apiClient.get<NoteTemplate>(`/api/v1/note-templates/${id}`)
}

export async function createNoteTemplate(body: Partial<NoteTemplate>): Promise<NoteTemplate> {
  if (USE_MOCK) {
    await delay(200)
    const blank = createBlankNoteTemplate()
    const created = { ...blank, ...body, id: blank.id }
    upsertNoteTemplate(created)
    return created
  }
  return apiClient.post<NoteTemplate>('/api/v1/note-templates', body)
}

export async function updateNoteTemplate(id: string, body: Partial<NoteTemplate>): Promise<NoteTemplate> {
  if (USE_MOCK) {
    await delay(400)
    const existing = getNoteTemplateById(id)
    if (!existing) throw new Error(`Template ${id} not found`)
    const updated = { ...existing, ...body, id }
    return upsertNoteTemplate(updated)
  }
  return apiClient.put<NoteTemplate>(`/api/v1/note-templates/${id}`, body)
}

export async function deleteNoteTemplate(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    storeDelete(id)
    return
  }
  await apiClient.delete<void>(`/api/v1/note-templates/${id}`)
}

// ─── Version Control ───────────────────────────────────────────────────────

export async function getTemplateVersions(templateId: string): Promise<NoteTemplateVersion[]> {
  if (USE_MOCK) {
    await delay(200)
    return []
  }
  return apiClient.get<NoteTemplateVersion[]>(`/api/v1/note-templates/${templateId}/versions`)
}

export async function restoreTemplateVersion(templateId: string, versionId: string): Promise<NoteTemplate> {
  if (USE_MOCK) {
    await delay(300)
    const t = getNoteTemplateById(templateId)
    if (!t) throw new Error(`Template ${templateId} not found`)
    return t
  }
  return apiClient.post<NoteTemplate>(`/api/v1/note-templates/${templateId}/versions/${versionId}/restore`, {})
}
