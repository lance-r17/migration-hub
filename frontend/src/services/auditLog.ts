import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { AuditLogEntry } from '@/types/audit'
import type { Project } from '@/types'

const ENDPOINTS = {
  auditLog: (id: string) => `/api/v1/projects/${id}/audit-log`,
}

function fromApi(raw: Record<string, unknown>): AuditLogEntry {
  const changes = (raw.changes as Record<string, unknown>[] ?? []).map(c => ({
    field: c.field as string,
    label: c.label as string,
    oldValue: c.old_value,
    newValue: c.new_value,
  }))
  return {
    id: raw.id as string,
    projectId: raw.project_id as string,
    timestamp: raw.timestamp as string,
    actor: raw.actor as AuditLogEntry['actor'],
    eventType: raw.event_type as AuditLogEntry['eventType'],
    entityType: raw.entity_type as AuditLogEntry['entityType'],
    entityId: raw.entity_id as string | undefined,
    entityLabel: raw.entity_label as string | undefined,
    sectionKey: raw.section_key as string | undefined,
    sectionLabel: raw.section_label as string | undefined,
    oldSnapshot: raw.old_snapshot as Record<string, unknown> | undefined,
    changes,
  }
}

export async function getAuditLog(
  projectId: string,
  limit: number = 500,
  offset: number = 0,
): Promise<AuditLogEntry[]> {
  if (USE_MOCK) { await delay(); return store.getAuditLog(projectId) }
  const url = `${ENDPOINTS.auditLog(projectId)}?limit=${limit}&offset=${offset}`
  const res = await apiClient.get<{ entries: Record<string, unknown>[] }>(url)
  return res.entries.map(fromApi)
}

export async function restoreAuditEntry(projectId: string, entryId: string): Promise<void> {
  if (USE_MOCK) {
    await delay()
    const entries = store.getAuditLog(projectId)
    const entry = entries.find(e => e.id === entryId)
    if (!entry || !entry.oldSnapshot) {
      throw new Error('Audit entry not found or missing snapshot')
    }
    const currentProject = store.getProject(projectId)
    const current = currentProject?.applicationOverview ?? {}
    const restored = entry.oldSnapshot
    const allKeys = new Set([...Object.keys(current), ...Object.keys(restored)])
    const restoreChanges = Array.from(allKeys)
      .filter(k => (current as Record<string, unknown>)[k] !== (restored as Record<string, unknown>)[k])
      .map(k => ({
        field: k,
        label: k,
        oldValue: (current as Record<string, unknown>)[k],
        newValue: (restored as Record<string, unknown>)[k],
      }))
    store.updateProject(projectId, 'applicationOverview', restored as Project['applicationOverview'])
    const actor = { id: 'admin', name: 'Admin', initials: 'AD' }
    store.appendAuditEntry({
      id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      projectId,
      timestamp: new Date().toISOString(),
      actor,
      eventType: 'section_restored',
      entityType: 'section',
      sectionKey: 'applicationOverview',
      sectionLabel: 'Application Overview',
      changes: [
        { field: 'restored_from_entry', label: 'Restored from entry', oldValue: undefined, newValue: entryId },
        ...restoreChanges,
      ],
    })
    return
  }
  await apiClient.post(`/api/v1/projects/${projectId}/audit-log/${entryId}/restore`, {})
}

// In mock mode, audit entries are appended client-side after each successful save.
// In production, the backend creates audit log rows as a transaction side-effect — no frontend POST needed.
export function appendAuditEntryMock(entry: AuditLogEntry): void {
  store.appendAuditEntry(entry)
}
