import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import { appendAuditEntryMock } from './auditLog'
import { diffObjects } from '@/utils/diff'
import { SURVEY_FIELD_DEFS } from '@/data/surveyFields'
import type { SurveyConfig, SurveyQuestion, SurveyFieldDef, ResourceSurveyConfig, ResourceQuestionGroup } from '@/types/survey'

const ENDPOINTS = {
  survey: '/api/v1/settings/survey',
  surveyFieldDefs: '/api/v1/settings/survey/field-defs',
  resourceSurvey: '/api/v1/settings/resource-survey',
}

function surveyConfigFromApi(raw: Record<string, unknown>): SurveyConfig {
  return {
    isActive: raw.is_active as boolean,
    questions: (raw.questions ?? []) as SurveyQuestion[],
    updatedBy: (raw.updated_by ?? '') as string,
    updatedAt: (raw.updated_at ?? '') as string,
  }
}

function surveyConfigToApi(config: SurveyConfig): Record<string, unknown> {
  return {
    is_active: config.isActive,
    questions: config.questions,
    updated_by: config.updatedBy,
    updated_at: config.updatedAt,
  }
}

function resourceSurveyConfigFromApi(raw: Record<string, unknown>): ResourceSurveyConfig {
  return {
    groups: (raw.groups ?? []) as ResourceQuestionGroup[],
    updatedBy: (raw.updated_by ?? '') as string,
    updatedAt: (raw.updated_at ?? '') as string,
  }
}

function resourceSurveyConfigToApi(config: ResourceSurveyConfig): Record<string, unknown> {
  return {
    groups: config.groups,
    updated_by: config.updatedBy,
    updated_at: config.updatedAt,
  }
}

export async function getSurveyConfig(): Promise<SurveyConfig | null> {
  if (USE_MOCK) { await delay(); return store.getSurveyConfig() }
  const raw = await apiClient.get<Record<string, unknown>>(ENDPOINTS.survey)
  return raw ? surveyConfigFromApi(raw) : null
}

export async function saveSurveyConfig(config: SurveyConfig): Promise<SurveyConfig> {
  if (USE_MOCK) { await delay(300); return store.setSurveyConfig(config) }
  const raw = await apiClient.put<Record<string, unknown>>(ENDPOINTS.survey, surveyConfigToApi(config))
  return surveyConfigFromApi(raw)
}

export async function getSurveyFieldDefs(): Promise<SurveyFieldDef[]> {
  return SURVEY_FIELD_DEFS
}

export async function getResourceSurveyConfig(): Promise<ResourceSurveyConfig> {
  if (USE_MOCK) { await delay(); return store.getResourceSurveyConfig() }
  const raw = await apiClient.get<Record<string, unknown>>(ENDPOINTS.resourceSurvey)
  return resourceSurveyConfigFromApi(raw)
}

export async function saveResourceSurveyConfig(config: ResourceSurveyConfig): Promise<ResourceSurveyConfig> {
  if (USE_MOCK) { await delay(300); return store.setResourceSurveyConfig(config) }
  const raw = await apiClient.put<Record<string, unknown>>(ENDPOINTS.resourceSurvey, resourceSurveyConfigToApi(config))
  return resourceSurveyConfigFromApi(raw)
}

export async function batchUpdateResourceSpecs(
  projectId: string,
  updates: { resourceId: string; specs: Record<string, unknown> }[]
): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    const project = store.getProject(projectId)
    const resources = project?.currentInfrastructure?.resources ?? []
    const oldSpecsMap = Object.fromEntries(resources.map(r => [r.resourceId, r.specs ?? {}]))
    store.batchUpdateResourceSpecs(projectId, updates)
    const u = store.getCurrentUser()
    for (const { resourceId, specs } of updates) {
      const resource = resources.find(r => r.resourceId === resourceId)
      if (!resource) continue
      const resourceChanges = diffObjects(
        oldSpecsMap[resourceId] ?? {},
        { ...(oldSpecsMap[resourceId] ?? {}), ...specs },
      )
      if (resourceChanges.length > 0) {
        appendAuditEntryMock({
          id: crypto.randomUUID(),
          projectId,
          timestamp: new Date().toISOString(),
          actor: { id: u.id, name: u.name, initials: u.initials },
          eventType: 'resource_updated',
          entityType: 'resource',
          entityId: resourceId,
          entityLabel: resource.name,
          changes: resourceChanges,
        })
      }
    }
    return
  }
  await apiClient.post(`/api/v1/projects/${projectId}/resources/specs`, updates)
}
