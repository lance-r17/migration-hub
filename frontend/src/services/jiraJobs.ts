import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { CloudResource, ResourceCategory } from '@/types'
import type { JiraSubtaskConfig, JiraJobRequest } from '@/types/wave'

export interface JiraJobLog {
  id: string
  jobId: string
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  meta?: Record<string, unknown> | null
}

export interface AdminJiraJobRow extends JiraJobRequest {
  projectName: string
  logs: JiraJobLog[]
}

const ENDPOINTS = {
  jobs: '/api/v1/jira/jobs',
  job: (id: string) => `/api/v1/jira/jobs/${id}`,
  jobLogs: (id: string) => `/api/v1/jira/jobs/${id}/logs`,
  adminJobs: '/api/v1/admin/jira-jobs',
}

interface JiraJobApiResponse {
  id: string
  project_id: string
  status: string
  config: JiraSubtaskConfig
  requested_at: string | null
  processed_at: string | null
  story_key: string | null
  subtask_keys: Record<string, string>
}

interface JiraJobLogApiResponse {
  id: string
  job_id: string
  timestamp: string
  level: string
  message: string
  meta?: Record<string, unknown> | null
}

interface AdminJiraJobApiResponse extends JiraJobApiResponse {
  project_name: string
  logs: JiraJobLogApiResponse[]
}

function fromApi(r: JiraJobApiResponse): JiraJobRequest {
  return {
    id: r.id,
    projectId: r.project_id,
    status: r.status as JiraJobRequest['status'],
    config: r.config,
    requestedAt: r.requested_at ?? new Date().toISOString(),
    processedAt: r.processed_at ?? undefined,
    storyKey: r.story_key ?? undefined,
    subtaskKeys: r.subtask_keys ?? {},
  }
}

function fromApiLog(r: JiraJobLogApiResponse): JiraJobLog {
  return {
    id: r.id,
    jobId: r.job_id,
    timestamp: r.timestamp,
    level: r.level as JiraJobLog['level'],
    message: r.message,
    meta: r.meta,
  }
}

function getCategoryForProduct(product?: string): ResourceCategory {
  const map = store.getProductCategoryMap()
  const entry = map.find(e => e.product === (product ?? 'Other'))
  return entry?.category ?? 'Other'
}

// ─── getJiraJob ───────────────────────────────────────────────────────────────
export async function getJiraJob(jobId: string): Promise<JiraJobRequest> {
  if (USE_MOCK) { await delay(); return store.getJiraJob(jobId)! }
  const raw = await apiClient.get<JiraJobApiResponse>(ENDPOINTS.job(jobId))
  return fromApi(raw)
}

// ─── createJiraJob ────────────────────────────────────────────────────────────
// Dual-mode:
//   USE_MOCK=true  → client-side simulation via setTimeout (pending→processing→completed)
//   USE_MOCK=false → POST /api/v1/jira/jobs; backend BackgroundTask handles processing
//
export async function createJiraJob(
  projectId: string,
  config: JiraSubtaskConfig,
  resources: CloudResource[],
  waveEpicKey?: string,
): Promise<void> {
  if (!USE_MOCK) {
    // Await the POST so callers can refresh project state after job is queued.
    try {
      await apiClient.post<JiraJobApiResponse>(ENDPOINTS.jobs, {
        project_id: projectId,
        config,
        wave_epic_key: waveEpicKey ?? null,
      })
    } catch {
      // Swallowed — ProjectDetailsPage handles the error path via jiraJobStatus
    }
    return
  }

  // ── Mock simulation ───────────────────────────────────────────────────────
  const jobId = `jira-job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const job: JiraJobRequest = {
    id: jobId,
    projectId,
    status: 'pending',
    config,
    requestedAt: new Date().toISOString(),
    subtaskKeys: {},
  }
  store.addJiraJob(job)

  store.updateProject(projectId, 'jiraJobStatus', 'pending')

  setTimeout(() => {
    try {
      store.updateJiraJob(jobId, { status: 'processing' })
      store.updateProject(projectId, 'jiraJobStatus', 'processing')
    } catch {
      // job may have been cleaned up
    }
  }, 5_000)

  setTimeout(() => {
    try {
      const projectKey = waveEpicKey?.split('-')[0] ?? 'MIG'
      const storyNum = Math.floor(Math.random() * 900) + 100
      const storyKey = `${projectKey}-${storyNum}`

      const inScope = resources.filter(r => r.needMigration !== false)

      const subtaskKeys: Record<string, string> = {}
      let counter = storyNum + 1

      if (config.mode === 'category-level') {
        const categories = [...new Set(inScope.map(r => getCategoryForProduct(r.product)))]
        for (const cat of categories) {
          subtaskKeys[cat] = `${projectKey}-${counter++}`
        }
        const project = store.getProject(projectId)
        if (project?.currentInfrastructure) {
          const updatedResources = project.currentInfrastructure.resources.map(r =>
            inScope.some(s => s.id === r.id)
              ? { ...r, jiraSubtaskKey: subtaskKeys[getCategoryForProduct(r.product)] }
              : r
          )
          store.updateProject(projectId, 'currentInfrastructure', {
            ...project.currentInfrastructure,
            resources: updatedResources,
          })
        }
      } else if (config.mode === 'product-level') {
        const products = [...new Set(inScope.map(r => r.product ?? 'Other'))]
        for (const product of products) {
          subtaskKeys[product] = `${projectKey}-${counter++}`
        }
        const project = store.getProject(projectId)
        if (project?.currentInfrastructure) {
          const updatedResources = project.currentInfrastructure.resources.map(r =>
            inScope.some(s => s.id === r.id)
              ? { ...r, jiraSubtaskKey: subtaskKeys[r.product ?? 'Other'] }
              : r
          )
          store.updateProject(projectId, 'currentInfrastructure', {
            ...project.currentInfrastructure,
            resources: updatedResources,
          })
        }
      } else {
        const targetIds = config.mode === 'custom'
          ? (config.selectedResourceIds ?? [])
          : inScope.map(r => r.id)

        for (const id of targetIds) {
          subtaskKeys[id] = `${projectKey}-${counter++}`
        }

        const project = store.getProject(projectId)
        if (project?.currentInfrastructure) {
          const updatedResources = project.currentInfrastructure.resources.map(r =>
            subtaskKeys[r.id] ? { ...r, jiraSubtaskKey: subtaskKeys[r.id] } : r
          )
          store.updateProject(projectId, 'currentInfrastructure', {
            ...project.currentInfrastructure,
            resources: updatedResources,
          })
        }
      }

      store.updateProject(projectId, 'jiraStoryKey', storyKey)
      store.updateProject(projectId, 'jiraJobStatus', 'completed')

      store.updateJiraJob(jobId, {
        status: 'completed',
        processedAt: new Date().toISOString(),
        storyKey,
        subtaskKeys,
      })
    } catch {
      store.updateJiraJob(jobId, { status: 'failed' })
      store.updateProject(projectId, 'jiraJobStatus', 'failed')
    }
  }, 30_000)
}

// ─── retryJiraJob ─────────────────────────────────────────────────────────────
export async function retryJiraJob(projectId: string): Promise<JiraJobRequest> {
  if (USE_MOCK) { await delay(); throw new Error('Retry not supported in mock mode') }
  const raw = await apiClient.post<JiraJobApiResponse>(
    `/api/v1/jira/projects/${projectId}/retry-job`,
    {},
  )
  return fromApi(raw)
}

// ─── getJobLogs ───────────────────────────────────────────────────────────────
export async function getJobLogs(jobId: string): Promise<JiraJobLog[]> {
  if (USE_MOCK) { await delay(); return [] }
  const raw = await apiClient.get<JiraJobLogApiResponse[]>(ENDPOINTS.jobLogs(jobId))
  return raw.map(fromApiLog)
}

// ─── getAllJobsAdmin ──────────────────────────────────────────────────────────
export async function getAllJobsAdmin(): Promise<AdminJiraJobRow[]> {
  if (USE_MOCK) { await delay(); return [] }
  const raw = await apiClient.get<AdminJiraJobApiResponse[]>(ENDPOINTS.adminJobs)
  return raw.map(r => ({
    ...fromApi(r),
    projectName: r.project_name,
    logs: r.logs.map(fromApiLog),
  }))
}
