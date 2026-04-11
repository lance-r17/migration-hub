import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import { SURVEY_FIELD_DEFS } from '@/data/surveyFields'
import type { SurveyConfig, SurveyFieldDef, ResourceSurveyConfig } from '@/types/survey'

const ENDPOINTS = {
  survey: '/api/v1/settings/survey',
  surveyFieldDefs: '/api/v1/settings/survey/field-defs',
  resourceSurvey: '/api/v1/settings/resource-survey',
}

export async function getSurveyConfig(): Promise<SurveyConfig | null> {
  if (USE_MOCK) { await delay(); return store.getSurveyConfig() }
  return apiClient.get<SurveyConfig | null>(ENDPOINTS.survey)
}

export async function saveSurveyConfig(config: SurveyConfig): Promise<SurveyConfig> {
  if (USE_MOCK) { await delay(300); return store.setSurveyConfig(config) }
  return apiClient.post<SurveyConfig>(ENDPOINTS.survey, config)
}

export async function getSurveyFieldDefs(): Promise<SurveyFieldDef[]> {
  if (USE_MOCK) { await delay(); return SURVEY_FIELD_DEFS }
  return apiClient.get<SurveyFieldDef[]>(ENDPOINTS.surveyFieldDefs)
}

export async function getResourceSurveyConfig(): Promise<ResourceSurveyConfig> {
  if (USE_MOCK) { await delay(); return store.getResourceSurveyConfig() }
  return apiClient.get<ResourceSurveyConfig>(ENDPOINTS.resourceSurvey)
}

export async function saveResourceSurveyConfig(config: ResourceSurveyConfig): Promise<ResourceSurveyConfig> {
  if (USE_MOCK) { await delay(300); return store.setResourceSurveyConfig(config) }
  return apiClient.post<ResourceSurveyConfig>(ENDPOINTS.resourceSurvey, config)
}

export async function batchUpdateResourceSpecs(
  projectId: string,
  updates: { resourceId: string; specs: Record<string, unknown> }[]
): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    store.batchUpdateResourceSpecs(projectId, updates)
    return
  }
  await apiClient.post(`/api/v1/projects/${projectId}/resources/specs`, updates)
}
