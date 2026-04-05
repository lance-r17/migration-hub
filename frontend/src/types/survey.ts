import type { Project } from '@/types'

export type SurveyInputType = 'short_text' | 'long_text' | 'select' | 'boolean' | 'string_array' | 'migration_window' | 'dependency_list'

export interface SurveyFieldDef {
  id: string                      // stable unique ID e.g. "appoverview__applicationName"
  sectionKey: keyof Project       // e.g. "applicationOverview"
  fieldPath: string               // dot-notation within section e.g. "applicationName" or "network.loadBalancerType"
  label: string                   // human-readable field label
  sectionLabel: string            // human-readable section label
  inputType: SurveyInputType
  options?: string[]              // for 'select' type
  defaultQuestion: string         // default question text shown to user
  defaultHint: string             // sample answer / guidance text
}

export interface SurveyQuestion {
  fieldId: string                 // references SurveyFieldDef.id
  questionText: string            // platform-customised question
  hintText: string                // sample answer / guidance
  required: boolean
  order: number
}

export interface SurveyConfig {
  isActive: boolean
  questions: SurveyQuestion[]
  updatedBy: string
  updatedAt: string
}
