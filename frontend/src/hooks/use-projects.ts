import { useState, useEffect, useCallback } from 'react'
import { getProjects, getProjectsForUser, getProject, updateProject } from '@/services/projects'
import { appendAuditEntryMock } from '@/services/auditLog'
import { diffObjects } from '@/utils/diff'
import { useCurrentUser } from '@/context/UserContext'
import type { Project } from '@/types'
import type { AuditLogEntry, AuditEventType, AuditEntityType, AuditChange } from '@/types/audit'

// ─── Section label maps ───────────────────────────────────────────────────────
// Maps Project section keys → human-readable labels for the drawer header.
const SECTION_LABELS: Partial<Record<keyof Project, string>> = {
  applicationOverview:    'Application Overview',
  currentInfrastructure:  'Current Infrastructure',
  availability:           'Availability & Resilience',
  dataPersistence:        'Data & Persistence',
  dependencies:           'Dependencies',
  nfrs:                   'Non-Functional Requirements',
  migrationConstraints:   'Migration Constraints',
  targetArchitecture:     'Target Architecture',
  risks:                  'Risks & Blockers',
  approvals:              'Sign-off',
  status:                 'Project Status',
  waveId:                 'Wave Assignment',
  jiraSubtaskConfig:      'Jira Configuration',
}

// Field label maps per section key
const FIELD_LABEL_MAPS: Partial<Record<keyof Project, Record<string, string>>> = {
  applicationOverview: {
    applicationName:  'App Name',
    shortName:        'Short Name',
    businessFunction: 'Business Function',
    applicationTier:  'App Tier',
    eimId:            'EIM ID',
    userBase:         'User Base',
  },
  availability: {
    rto:                     'RTO',
    rpo:                     'RPO',
    availabilitySla:         'Availability SLA',
    currentAzPattern:        'Current AZ Pattern',
    azAwareToday:            'AZ Aware Today',
    azFailureBehaviour:      'AZ Failure Behaviour',
    azReadiness3Az:          '3-AZ Readiness',
    healthCheckEndpoints:    'Health Check Endpoints',
    currentTopologyDescription: 'Topology Description',
  },
  dataPersistence: {
    databaseTypes:        'Database Types',
    totalDataVolume:      'Total Data Volume',
    dataGrowthRate:       'Data Growth Rate',
    replicationTopology:  'Replication Topology',
    backupMethod:         'Backup Method',
    lastRestoreTest:      'Last Restore Test',
    dataResidency:        'Data Residency',
    encryptionAtRest:     'Encryption At Rest',
    piiData:              'PII Data',
    statefulComponents:   'Stateful Components',
  },
  nfrs: {
    peakLoad:            'Peak Load',
    autoscaling:         'Autoscaling',
    seasonalPatterns:    'Seasonal Patterns',
    latencySensitivity:  'Latency Sensitivity',
    monitoring:          'Monitoring',
    logAggregation:      'Log Aggregation',
    compliance:          'Compliance',
    licensing:           'Licensing',
  },
  migrationConstraints: {
    migrationWindow:      'Migration Window',
    blackoutDates:        'Blackout Dates',
    changeFreezePeriods:  'Change Freeze Periods',
    maxCutoverWindow:     'Max Cutover Window',
    cutoverApproach:      'Cutover Approach',
    rollbackPlan:         'Rollback Plan',
    stakeholderComms:     'Stakeholder Comms',
    preMigrationTesting:  'Pre-Migration Testing',
  },
  targetArchitecture: {
    summary:               'Summary',
    constraints:           'Constraints',
    reArchitectureNeeded:  'Re-Architecture Needed',
    topology3Az:           '3-AZ Topology',
    replicationChanges:    'Replication Changes',
    dnsIpChanges:          'DNS / IP Changes',
    newServicesRequired:   'New Services Required',
  },
  status: { status: 'Status' },
  waveId: { waveId: 'Wave' },
  jiraSubtaskConfig: { mode: 'Sub-task Mode' },
}

// ─── Event classification helpers ────────────────────────────────────────────

function classifyApprovalEvent(
  prevApprovals: Project['approvals'],
  nextApprovals: Project['approvals'],
): { changes: AuditChange[]; entityId?: string; entityLabel?: string } | null {
  if (!prevApprovals || !nextApprovals) return null
  for (const next of nextApprovals) {
    const prev = prevApprovals.find(a => a.id === next.id)
    if (!prev) continue
    if (prev.status !== next.status && next.status === 'approved') {
      return {
        entityId: next.id,
        entityLabel: `${next.role} Sign-off`,
        changes: [
          { field: 'status', label: 'Status', oldValue: prev.status, newValue: next.status },
          { field: 'approver', label: 'Approver', oldValue: prev.approver, newValue: next.approver },
          { field: 'timestamp', label: 'Timestamp', oldValue: prev.timestamp, newValue: next.timestamp },
        ].filter(c => c.oldValue !== c.newValue),
      }
    }
  }
  return null
}

interface RiskEvent {
  eventType: AuditEventType
  entityId: string
  entityLabel: string
  changes: AuditChange[]
}

function classifyRiskEvents(
  prevRisks: Project['risks'],
  nextRisks: Project['risks'],
): RiskEvent[] {
  const events: RiskEvent[] = []
  const prevMap = new Map((prevRisks ?? []).map(r => [r.id, r]))
  const nextMap = new Map((nextRisks ?? []).map(r => [r.id, r]))

  // Created
  for (const [id, risk] of nextMap) {
    if (!prevMap.has(id)) {
      events.push({
        eventType: 'risk_created',
        entityId: id,
        entityLabel: risk.title,
        changes: [
          { field: 'title', label: 'Title', oldValue: undefined, newValue: risk.title },
          { field: 'severity', label: 'Severity', oldValue: undefined, newValue: risk.severity },
          ...(risk.owner ? [{ field: 'owner', label: 'Owner', oldValue: undefined, newValue: risk.owner }] : []),
        ],
      })
    }
  }

  // Deleted
  for (const [id, risk] of prevMap) {
    if (!nextMap.has(id)) {
      events.push({
        eventType: 'risk_deleted',
        entityId: id,
        entityLabel: risk.title,
        changes: [
          { field: 'title', label: 'Title', oldValue: risk.title, newValue: undefined },
          { field: 'severity', label: 'Severity', oldValue: risk.severity, newValue: undefined },
        ],
      })
    }
  }

  // Updated
  for (const [id, next] of nextMap) {
    const prev = prevMap.get(id)
    if (!prev) continue
    const changes = diffObjects(prev, next, { title: 'Title', severity: 'Severity', mitigation: 'Mitigation', owner: 'Owner', riskStatus: 'Risk Status', description: 'Description' })
    if (changes.length > 0) {
      events.push({ eventType: 'risk_updated', entityId: id, entityLabel: next.title, changes })
    }
  }

  return events
}

interface ResourceEvent {
  eventType: AuditEventType
  entityId: string
  entityLabel: string
  changes: AuditChange[]
}

function classifyResourceEvents(
  prevInfra: Project['currentInfrastructure'],
  nextInfra: Project['currentInfrastructure'],
): ResourceEvent[] {
  const events: ResourceEvent[] = []
  const prevResources = prevInfra?.resources ?? []
  const nextResources = nextInfra?.resources ?? []
  const prevMap = new Map(prevResources.map(r => [r.id, r]))
  const nextMap = new Map(nextResources.map(r => [r.id, r]))

  const resLabelMap: Record<string, string> = {
    name: 'Name', category: 'Category', existingStatus: 'Existing Status',
    targetStatus: 'Target Status', syncStatus: 'Sync Status', specs: 'Specs',
    quantity: 'Quantity', availabilityZones: 'Availability Zones', needMigration: 'In Migration Scope',
  }

  for (const [id, next] of nextMap) {
    const prev = prevMap.get(id)
    if (!prev) continue
    const changes = diffObjects(prev, next, resLabelMap)
    if (changes.length === 0) continue
    const isSyncComplete = changes.some(c => c.field === 'syncStatus' && c.newValue === 'synced')
    events.push({
      eventType: isSyncComplete ? 'resource_sync_completed' : 'resource_updated',
      entityId: id,
      entityLabel: next.name,
      changes,
    })
  }

  return events
}

// ─── Audit entry builder ──────────────────────────────────────────────────────

function buildEntry(
  id: string,
  projectId: string,
  actorId: string,
  actorName: string,
  actorInitials: string,
  eventType: AuditEventType,
  entityType: AuditEntityType,
  sectionKey: keyof Project,
  changes: AuditChange[],
  extra: { entityId?: string; entityLabel?: string } = {},
): AuditLogEntry {
  return {
    id,
    projectId,
    timestamp: new Date().toISOString(),
    actor: { id: actorId, name: actorName, initials: actorInitials },
    eventType,
    entityType,
    sectionKey: String(sectionKey),
    sectionLabel: SECTION_LABELS[sectionKey],
    changes,
    ...extra,
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

interface ProjectsState {
  projects: Project[]
  loading: boolean
  error: string | null
}

export function useProjects(): ProjectsState {
  const [state, setState] = useState<ProjectsState>({
    projects: [],
    loading: true,
    error: null,
  })

  const { user } = useCurrentUser()
  const isPlatformLead = user?.role === 'Platform Migration Lead'

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const fetch = isPlatformLead
      ? getProjects()
      : getProjectsForUser(user.id)

    fetch
      .then(projects => {
        if (!cancelled) setState({ projects, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({
          projects: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load projects',
        })
      })

    return () => { cancelled = true }
  }, [user?.id, user?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

interface ProjectState {
  project: Project | undefined
  loading: boolean
  error: string | null
  saveSection: <K extends keyof Project>(key: K, value: Project[K]) => Promise<void>
  refreshProject: () => Promise<void>
}

export function useProject(id: string | undefined): ProjectState {
  const [project, setProject] = useState<Project | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useCurrentUser()

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getProject(id)
      .then(data => {
        if (!cancelled) {
          setProject(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load project')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [id])

  // Poll every 5s while a Jira job is pending or processing
  useEffect(() => {
    if (!id || !project) return
    const status = project.jiraJobStatus
    if (status !== 'pending' && status !== 'processing') return

    const interval = setInterval(async () => {
      const updated = await getProject(id)
      if (updated) setProject(updated)
    }, 5_000)

    return () => clearInterval(interval)
  }, [id, project?.jiraJobStatus])

  const saveSection = useCallback(async <K extends keyof Project>(
    key: K,
    value: Project[K],
  ): Promise<void> => {
    if (!id || !project) return

    // Snapshot before optimistic update
    const previous = project
    setProject(prev => prev ? { ...prev, [key]: value } : prev)

    try {
      const updated = await updateProject(id, key, value)
      setProject(updated)

      // ─── Audit log ───────────────────────────────────────────────────────────
      const actorId = user?.id ?? 'unknown'
      const actorName = user?.name ?? 'Unknown User'
      const actorInitials = user?.initials ?? '??'
      const entryId = `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      if (key === 'approvals') {
        const result = classifyApprovalEvent(
          previous.approvals,
          value as Project['approvals'],
        )
        if (result && result.changes.length > 0) {
          appendAuditEntryMock(buildEntry(
            entryId, id, actorId, actorName, actorInitials,
            'approval_submitted', 'approval', key,
            result.changes, { entityId: result.entityId, entityLabel: result.entityLabel },
          ))
        }
      } else if (key === 'risks') {
        const riskEvents = classifyRiskEvents(
          previous.risks,
          value as Project['risks'],
        )
        for (const ev of riskEvents) {
          appendAuditEntryMock(buildEntry(
            `${entryId}-${ev.entityId}`, id, actorId, actorName, actorInitials,
            ev.eventType, 'risk', key,
            ev.changes, { entityId: ev.entityId, entityLabel: ev.entityLabel },
          ))
        }
      } else if (key === 'currentInfrastructure') {
        const resEvents = classifyResourceEvents(
          previous.currentInfrastructure,
          value as Project['currentInfrastructure'],
        )
        for (const ev of resEvents) {
          appendAuditEntryMock(buildEntry(
            `${entryId}-${ev.entityId}`, id, actorId, actorName, actorInitials,
            ev.eventType, 'cloud_resource', key,
            ev.changes, { entityId: ev.entityId, entityLabel: ev.entityLabel },
          ))
        }
        // Also diff network config if changed
        const netChanges = diffObjects(
          previous.currentInfrastructure?.network,
          (value as Project['currentInfrastructure'])?.network,
          { loadBalancerType: 'Load Balancer', vipDnsNames: 'VIP DNS Names', firewallZones: 'Firewall Zones', bandwidthRequirements: 'Bandwidth', hardcodedIps: 'Hardcoded IPs', privateConnectivity: 'Private Connectivity' },
        )
        if (netChanges.length > 0) {
          appendAuditEntryMock(buildEntry(
            `${entryId}-net`, id, actorId, actorName, actorInitials,
            'resource_updated', 'cloud_resource', key,
            netChanges, { entityLabel: 'Network Configuration' },
          ))
        }
      } else if (key === 'status') {
        const changes: AuditChange[] = [{
          field: 'status',
          label: 'Status',
          oldValue: previous.status,
          newValue: value,
        }]
        appendAuditEntryMock(buildEntry(
          entryId, id, actorId, actorName, actorInitials,
          'status_changed', 'project', key,
          changes,
        ))
      } else if (key === 'waveId') {
        appendAuditEntryMock(buildEntry(
          entryId, id, actorId, actorName, actorInitials,
          'wave_assigned', 'wave', key,
          [{ field: 'waveId', label: 'Wave', oldValue: previous.waveId, newValue: value }],
        ))
      } else if (key === 'jiraSubtaskConfig') {
        const cfg = value as Project['jiraSubtaskConfig']
        appendAuditEntryMock(buildEntry(
          entryId, id, actorId, actorName, actorInitials,
          'jira_story_created', 'project', key,
          [{ field: 'mode', label: 'Sub-task Mode', oldValue: previous.jiraSubtaskConfig?.mode, newValue: cfg?.mode }],
        ))
      } else {
        const labelMap = (FIELD_LABEL_MAPS[key] ?? {}) as Record<string, string>
        const changes = diffObjects(previous[key], value, labelMap)
        if (changes.length > 0) {
          appendAuditEntryMock(buildEntry(
            entryId, id, actorId, actorName, actorInitials,
            'section_updated', 'section', key,
            changes,
          ))
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

    } catch (err) {
      // Roll back on failure
      setProject(previous)
      throw err
    }
  }, [id, project, user])

  const refreshProject = useCallback(async () => {
    if (!id) return
    const updated = await getProject(id)
    if (updated) setProject(updated)
  }, [id])

  return { project, loading, error, saveSection, refreshProject }
}
