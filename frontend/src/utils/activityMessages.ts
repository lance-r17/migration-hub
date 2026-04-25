import type { AuditLogEntry, AuditEventType } from '@/types/audit'
import type { ActivityType } from '@/types'

const TRUNCATE_LEN = 60

function fmt(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) {
    const joined = v.map(item =>
      typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>).name ?? JSON.stringify(item)
        : String(item)
    ).join(', ')
    return joined.length > TRUNCATE_LEN ? joined.slice(0, TRUNCATE_LEN) + '…' : joined
  }
  if (typeof v === 'object') {
    const s = JSON.stringify(v)
    return s.length > TRUNCATE_LEN ? s.slice(0, TRUNCATE_LEN) + '…' : s
  }
  const s = String(v)
  return s.length > TRUNCATE_LEN ? s.slice(0, TRUNCATE_LEN) + '…' : s
}

function formatChanges(changes: AuditLogEntry['changes']): string {
  if (!changes || changes.length === 0) return ''

  const parts = changes.map(c => {
    const oldStr = fmt(c.oldValue)
    const newStr = fmt(c.newValue)
    if (!oldStr && newStr) {
      return `${c.label} set to ${newStr}`
    }
    if (oldStr && !newStr) {
      return `${c.label} cleared (was ${oldStr})`
    }
    return `${c.label} changed from ${oldStr} → ${newStr}`
  })

  return parts.join(', ')
}

function eventTypeToActivityType(eventType: AuditEventType): ActivityType {
  switch (eventType) {
    case 'approval_submitted':
    case 'resource_sync_completed':
    case 'survey_submitted':
      return 'success'
    case 'risk_created':
    case 'risk_deleted':
      return 'error'
    default:
      return 'info'
  }
}

export function buildActivityMessage(
  entry: AuditLogEntry,
  projectName?: string,
): { message: string; type: ActivityType } {
  const actor = entry.actor.name
  const project = projectName ?? entry.projectId
  const changes = formatChanges(entry.changes)
  const changesSuffix = changes ? `: ${changes}` : ''

  switch (entry.eventType) {
    case 'section_updated': {
      const section = entry.sectionLabel ?? entry.sectionKey ?? 'section'
      const msg = `${actor} updated ${section} in ${project}${changesSuffix}`
      return { message: msg, type: 'info' }
    }

    case 'status_changed': {
      const statusChange = entry.changes.find(c => c.field === 'status')
      const detail = statusChange
        ? `: ${fmt(statusChange.oldValue)} → ${fmt(statusChange.newValue)}`
        : changesSuffix
      const msg = `${actor} changed project status in ${project}${detail}`
      return { message: msg, type: 'info' }
    }

    case 'approval_submitted': {
      const approval = entry.entityLabel ?? 'approval'
      const msg = `${actor} approved ${approval} in ${project}`
      return { message: msg, type: 'success' }
    }

    case 'risk_created': {
      const risk = entry.entityLabel ?? 'a new risk'
      const sev = entry.changes.find(c => c.field === 'severity')?.newValue
      const sevSuffix = sev ? ` (${fmt(sev)})` : ''
      const msg = `${actor} created risk '${risk}'${sevSuffix} in ${project}`
      return { message: msg, type: 'error' }
    }

    case 'risk_updated': {
      const risk = entry.entityLabel ?? 'risk'
      const msg = `${actor} updated risk '${risk}' in ${project}${changesSuffix}`
      return { message: msg, type: 'info' }
    }

    case 'risk_deleted': {
      const risk = entry.entityLabel ?? 'risk'
      const msg = `${actor} removed risk '${risk}' from ${project}`
      return { message: msg, type: 'error' }
    }

    case 'resource_updated': {
      const resource = entry.entityLabel ?? entry.entityId ?? 'resource'
      const msg = `${actor} updated ${resource} in ${project}${changesSuffix}`
      return { message: msg, type: 'info' }
    }

    case 'resource_sync_completed': {
      const resource = entry.entityLabel ?? entry.entityId ?? 'resource'
      const msg = `${actor} completed sync for ${resource} in ${project}`
      return { message: msg, type: 'success' }
    }

    case 'wave_assigned': {
      const wave = entry.entityLabel ?? entry.entityId ?? 'wave'
      const msg = `${wave} assigned to ${project}`
      return { message: msg, type: 'info' }
    }

    case 'wave_created': {
      const wave = entry.entityLabel ?? entry.entityId ?? 'Wave'
      const msg = `${wave} created`
      return { message: msg, type: 'info' }
    }

    case 'wave_imported': {
      const wave = entry.entityLabel ?? entry.entityId ?? 'Wave'
      const msg = `${wave} imported`
      return { message: msg, type: 'info' }
    }

    case 'jira_story_created': {
      const story = entry.entityLabel ?? entry.entityId ?? 'Jira story'
      const msg = `${story} created for ${project}`
      return { message: msg, type: 'success' }
    }

    case 'survey_submitted': {
      const msg = `Survey submitted for ${project}`
      return { message: msg, type: 'success' }
    }

    default:
      return {
        message: `${actor} performed ${entry.eventType} in ${project}`,
        type: 'info',
      }
  }
}
