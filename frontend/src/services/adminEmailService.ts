import { apiClient } from './client'

export interface ResolvedRecipient {
  email: string
  badge: string
}

export interface MilestoneReminderMatch {
  projectId: string
  projectName: string
  waveId: string
  waveName: string
  milestoneId: string
  milestoneName: string
  milestoneStatus: string
  targetDate: string
  daysUntil: number
  toAddrs: string[]
  recipients: ResolvedRecipient[]
  subject: string
  onCooldown: boolean
  lastSentAt?: string
}

export async function scanMilestoneReminders(): Promise<{ items: MilestoneReminderMatch[] }> {
  return apiClient.get<{ items: MilestoneReminderMatch[] }>('/api/v1/admin/email/events/milestone-reminder/scan')
}

export async function enqueueMilestoneReminders(
  selections: { projectId: string; milestoneId: string; recipients?: string[] }[],
): Promise<{ enqueued: number; job_ids: string[] }> {
  return apiClient.post<{ enqueued: number; job_ids: string[] }>(
    '/api/v1/admin/email/events/milestone-reminder/enqueue',
    {
      selections: selections.map((s) => ({
        project_id: s.projectId,
        milestone_id: s.milestoneId,
        recipients: s.recipients,
      })),
    },
  )
}

export interface EmailJob {
  id: string
  eventType: string
  templateId: string
  toAddrs: string[]
  subject: string
  status: 'pending' | 'processing' | 'sent' | 'failed'
  errorMessage?: string
  attempts: number
  idempotencyKey?: string
  createdAt: string
  sentAt?: string
}

export interface EmailJobListResponse {
  items: EmailJob[]
  total: number
  limit: number
  offset: number
}

export interface CutoverReminderConfig {
  enabled?: boolean
  reminder_days?: number[]
  run_time_utc?: string
}

export interface MilestoneReminderConfig {
  enabled?: boolean
  reminder_days?: number[]
  frequency_days?: number
  run_time_utc?: string
  scopes?: { planning?: boolean; auto_derived?: boolean; category?: boolean }
}

export interface EmailEventConfig {
  cutover_reminder?: CutoverReminderConfig
  milestone_reminder?: MilestoneReminderConfig
}

export async function getEmailEventConfig(): Promise<EmailEventConfig> {
  return apiClient.get<EmailEventConfig>('/api/v1/admin/email/events/config')
}

export async function updateEmailEventConfig(config: EmailEventConfig): Promise<EmailEventConfig> {
  return apiClient.put<EmailEventConfig>('/api/v1/admin/email/events/config', config)
}

export async function triggerCutoverReminder(): Promise<{ enqueued: number; job_ids: string[] }> {
  return apiClient.post<{ enqueued: number; job_ids: string[] }>('/api/v1/admin/email/events/cutover-reminder/trigger', {})
}

export interface CutoverReminderMatch {
  waveId: string
  waveName: string
  cutoverDate: string
  daysUntil: number
  projectId: string
  projectName: string
  toAddrs: string[]
  recipients: ResolvedRecipient[]
  subject: string
  alreadyEnqueued: boolean
}

export async function scanCutoverReminders(): Promise<{ items: CutoverReminderMatch[] }> {
  return apiClient.get<{ items: CutoverReminderMatch[] }>('/api/v1/admin/email/events/cutover-reminder/scan')
}

export async function enqueueCutoverReminders(
  selections: { waveId: string; projectId: string; recipients?: string[] }[],
): Promise<{ enqueued: number; job_ids: string[] }> {
  return apiClient.post<{ enqueued: number; job_ids: string[] }>(
    '/api/v1/admin/email/events/cutover-reminder/enqueue',
    {
      selections: selections.map((s) => ({
        wave_id: s.waveId,
        project_id: s.projectId,
        recipients: s.recipients,
      })),
    },
  )
}

export async function listEmailJobs(params?: {
  status?: string
  eventType?: string
  limit?: number
  offset?: number
}): Promise<EmailJobListResponse> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.eventType) query.set('event_type', params.eventType)
  if (params?.limit !== undefined) query.set('limit', String(params.limit))
  if (params?.offset !== undefined) query.set('offset', String(params.offset))
  return apiClient.get<EmailJobListResponse>(`/api/v1/admin/email/jobs?${query.toString()}`)
}

export async function retryEmailJob(jobId: string): Promise<{ status: string; job_id: string }> {
  return apiClient.post<{ status: string; job_id: string }>(`/api/v1/admin/email/jobs/${jobId}/retry`, {})
}

export interface EmailJobPreview {
  id: string
  subject: string
  toAddrs: string[]
  htmlBody: string
}

export async function previewEmailJob(jobId: string): Promise<EmailJobPreview> {
  return apiClient.get<EmailJobPreview>(`/api/v1/admin/email/jobs/${jobId}/preview`)
}
