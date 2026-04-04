export type AuditEventType =
  | 'section_updated'
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

export type AuditEntityType =
  | 'project'
  | 'section'
  | 'approval'
  | 'risk'
  | 'cloud_resource'
  | 'wave'

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
  changes: AuditChange[]
}
