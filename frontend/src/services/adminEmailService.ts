import { apiClient } from './client'

export interface EmailJob {
  id: string
  eventType: string
  templateId: string
  toAddrs: string[]
  subject: string
  status: 'pending' | 'processing' | 'sent' | 'failed'
  errorMessage?: string
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

export interface EmailEventConfig {
  cutover_reminder?: CutoverReminderConfig
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
