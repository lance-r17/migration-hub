import type { Project, ResourceCategory } from '@/types'

export type SurveyInputType = 'short_text' | 'long_text' | 'long_text_with_upload' | 'select' | 'boolean' | 'string_array' | 'migration_window' | 'dependency_list' | 'date' | 'date_range' | 'migration_date_range' | 'checkbox_select' | 'file_upload' | 'effort_estimate' | 'effort_table'

export interface SurveyFieldDef {
  id: string                      // stable unique ID e.g. "appoverview__applicationName"
  sectionKey: keyof Project       // e.g. "applicationOverview"
  fieldPath: string               // dot-notation within section e.g. "applicationName" or "network.loadBalancerType"
  toFieldPath?: string            // second field path for 'date_range' (the "to" date)
  attachmentFieldPath?: string    // path within section where attachment IDs are stored (for long_text_with_upload)
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
  condition?: { fieldId: string; value: unknown }  // show only when answers[fieldId] === value (or includes value for arrays)
}

export interface SurveyConfig {
  isActive: boolean
  questions: SurveyQuestion[]
  updatedBy: string
  updatedAt: string
}

// ─── Resource Survey ──────────────────────────────────────────────────────────

// Input types supported for resource-level questions (simpler subset of SurveyInputType)
export type ResourceSurveyInputType = 'select' | 'short_text' | 'boolean' | 'string_array' | 'checkbox_select' | 'date' | 'date_range' | 'migration_date_range'

// A single question whose answer is written to resource.specs[specsKey]
export interface ResourceQuestionDef {
  id: string                          // stable unique ID, e.g. "redis__usage_pattern"
  specsKey: string                    // key written to resource.specs, e.g. "usage_pattern"
  label: string                       // question text shown to user
  hintText: string                    // sample answer / guidance
  inputType: ResourceSurveyInputType
  toSpecsKey?: string                 // second specs key for 'date_range' (the "to" date)
  options?: string[]                  // for 'select' and 'checkbox_select'
  required: boolean
  condition?: { specsKey: string; value: string }  // show only when answers[specsKey] === value
}

// How the group appears in the survey AND how updates are scoped on submit:
//   'resource'  → one step per matching resource (each resource updated individually)
//   'product'   → one step for all resources of a product (all updated together)
//   'category'  → one step for all resources in a category (all updated together)
export type ResourceQuestionLevel = 'resource' | 'product' | 'category'

// A group of questions. `level` controls both presentation in the survey and update scope.
// Scope filters determine which resources are targeted (at most one is set):
//   level:'resource' + product:'redis'    → per-resource step for every redis resource
//   level:'resource' + resourceId:'x'    → step for that one resource only
//   level:'product'  + product:'redis'   → one step for all redis resources
//   level:'category' + category:'Database' → one step for all Database resources
export interface ResourceQuestionGroup {
  id: string
  level: ResourceQuestionLevel
  product?: string                    // filter by a single product name
  products?: string[]                 // filter by multiple product names (alternative to product)
  category?: ResourceCategory         // filter by resource category
  resourceId?: string                 // filter by exact resource ID (level:'resource' only)
  questions: ResourceQuestionDef[]
}

// Top-level config stored and fetched alongside SurveyConfig
export interface ResourceSurveyConfig {
  groups: ResourceQuestionGroup[]
  updatedBy: string
  updatedAt: string
}
