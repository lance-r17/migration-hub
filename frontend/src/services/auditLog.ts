import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { AuditLogEntry } from '@/types/audit'

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
    changes,
  }
}

export async function getAuditLog(projectId: string): Promise<AuditLogEntry[]> {
  if (USE_MOCK) { await delay(); return store.getAuditLog(projectId) }
  const res = await apiClient.get<{ entries: Record<string, unknown>[] }>(ENDPOINTS.auditLog(projectId))
  return res.entries.map(fromApi)
}

// In mock mode, audit entries are appended client-side after each successful save.
// In production, the backend creates audit log rows as a transaction side-effect — no frontend POST needed.
export function appendAuditEntryMock(entry: AuditLogEntry): void {
  store.appendAuditEntry(entry)
}
