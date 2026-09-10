export type AuditEventType =
  | 'section_updated'
  | 'section_restored'
  | 'status_changed'
  | 'approval_submitted'
  | 'risk_created'
  | 'risk_updated'
  | 'risk_deleted'
  | 'resource_updated'
  | 'resource_sync_completed'
  | 'wave_assigned'
  | 'wave_created'
  | 'wave_imported'
  | 'jira_story_created'
  | 'survey_submitted'
  | 'data_migration_completed'
  | 'data_migration_reopened'
  | 'data_migration_scope_removed'

export type AuditEntityType =
  | 'project'
  | 'section'
  | 'approval'
  | 'risk'
  | 'cloud_resource'
  | 'wave'
  | 'data_migration'

export interface AuditChange {
  field: string       // technical key
  label: string       // human-readable label
  oldValue: unknown
  newValue: unknown
}

export interface AuditActor {
  id: string
  name: string
  initials: string
}

export interface AuditLogEntry {
  id: string
  projectId: string
  timestamp: string         // ISO 8601
  actor: AuditActor
  eventType: AuditEventType
  entityType: AuditEntityType
  entityId?: string         // risk.id, resource.id, approval.id
  entityLabel?: string      // human-readable entity name
  sectionKey?: string       // keyof Project being updated
  sectionLabel?: string     // e.g. "Application Overview"
  oldSnapshot?: Record<string, unknown>
  changes: AuditChange[]
}
