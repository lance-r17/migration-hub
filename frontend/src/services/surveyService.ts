import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import { SURVEY_FIELD_DEFS } from '@/data/surveyFields'
import type { SurveyConfig, SurveyFieldDef } from '@/types/survey'

const ENDPOINTS = {
  survey: '/api/v1/settings/survey',
  surveyFieldDefs: '/api/v1/settings/survey/field-defs',
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
