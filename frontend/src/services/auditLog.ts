import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { AuditLogEntry } from '@/types/audit'

const ENDPOINTS = {
  auditLog: (id: string) => `/api/v1/projects/${id}/audit-log`,
}

export async function getAuditLog(projectId: string): Promise<AuditLogEntry[]> {
  // TODO (backend): real API returns { entries, total, page, limit }
  if (USE_MOCK) { await delay(); return store.getAuditLog(projectId) }
  const res = await apiClient.get<{ entries: AuditLogEntry[] }>(ENDPOINTS.auditLog(projectId))
  return res.entries
}

// In mock mode, audit entries are appended client-side after each successful save.
// In production, the backend creates audit log rows as a transaction side-effect — no frontend POST needed.
export function appendAuditEntryMock(entry: AuditLogEntry): void {
  store.appendAuditEntry(entry)
}
