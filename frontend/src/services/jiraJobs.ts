import { store } from '@/data/store'
import type { CloudResource, ResourceCategory } from '@/types'
import type { JiraSubtaskConfig, JiraJobRequest } from '@/types/wave'

function getCategoryForProduct(product?: string): ResourceCategory {
  const map = store.getProductCategoryMap()
  const entry = map.find(e => e.product === (product ?? 'Other'))
  return entry?.category ?? 'Other'
}

// ─── createJiraJob ────────────────────────────────────────────────────────────
// Simulates the event-driven async Jira job queue:
//   immediately  → writes job record (status: 'pending'), sets project.jiraJobStatus='pending'
//   ~5s later    → job + project status → 'processing'
//   ~30s later   → generates story key + subtask keys, writes them back to resources + project
//
export function createJiraJob(
  projectId: string,
  config: JiraSubtaskConfig,
  resources: CloudResource[],
  waveEpicKey?: string,
): JiraJobRequest {
  const jobId = `jira-job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // Write initial job record
  const job: JiraJobRequest = {
    id: jobId,
    projectId,
    status: 'pending',
    config,
    requestedAt: new Date().toISOString(),
    subtaskKeys: {},
  }
  store.addJiraJob(job)

  // Set project status to pending
  store.updateProject(projectId, 'jiraJobStatus', 'pending')

  // ~5s: transition to processing
  setTimeout(() => {
    try {
      store.updateJiraJob(jobId, { status: 'processing' })
      store.updateProject(projectId, 'jiraJobStatus', 'processing')
    } catch {
      // job may have been cleaned up
    }
  }, 5_000)

  // ~30s: complete — generate keys and write back
  setTimeout(() => {
    try {
      const projectKey = waveEpicKey?.split('-')[0] ?? 'MIG'
      const storyNum = Math.floor(Math.random() * 900) + 100
      const storyKey = `${projectKey}-${storyNum}`

      // Determine in-scope resources
      const inScope = resources.filter(r => r.needMigration !== false)

      // Build subtaskKeys and write back jiraSubtaskKey to each CloudResource
      const subtaskKeys: Record<string, string> = {}
      let counter = storyNum + 1

      if (config.mode === 'category-level') {
        // One sub-task per unique category; derived from product→category mapping
        const categories = [...new Set(inScope.map(r => getCategoryForProduct(r.product)))]
        for (const cat of categories) {
          subtaskKeys[cat] = `${projectKey}-${counter++}`
        }
        // Write back to each resource
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
        // One sub-task per unique product
        const products = [...new Set(inScope.map(r => r.product ?? 'Other'))]
        for (const product of products) {
          subtaskKeys[product] = `${projectKey}-${counter++}`
        }
        // Write back to each resource
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
        // resource-level or custom: one sub-task per resource
        const targetIds = config.mode === 'custom'
          ? (config.selectedResourceIds ?? [])
          : inScope.map(r => r.id)

        for (const id of targetIds) {
          subtaskKeys[id] = `${projectKey}-${counter++}`
        }

        // Write back to each resource
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

      // Write story key + completed status to project
      store.updateProject(projectId, 'jiraStoryKey', storyKey)
      store.updateProject(projectId, 'jiraJobStatus', 'completed')

      // Update job record
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

  return job
}
