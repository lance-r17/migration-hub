export type WaveStatus = 'planned' | 'active' | 'completed'

export const WAVE_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#F43F5E', // rose
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#EC4899', // pink
] as const

export interface Wave {
  id: string
  name: string            // e.g. "Wave 3 – Q2 2026"
  startDate: string       // ISO date string e.g. "2026-04-01"
  cutoverDate: string     // ISO date string e.g. "2026-06-30"
  description?: string
  jiraProjectKey: string  // e.g. "MIG"
  jiraEpicKey?: string    // e.g. "MIG-42", populated after creation/import
  jiraBaseUrl?: string
  source: 'created' | 'imported'
  status: WaveStatus
  color?: string          // hex color from WAVE_COLORS
  projectOrder?: string[] // manual project ordering within the wave
  createdAt: string       // ISO 8601
}

export interface JiraSubtaskConfig {
  mode: 'resource-level' | 'category-level' | 'product-level' | 'custom'
  selectedResourceIds?: string[]   // used when mode === 'custom'
  selectedCategories?: string[]    // used when mode === 'category-level'
  selectedProducts?: string[]      // used when mode === 'product-level'
}

export interface JiraJobRequest {
  id: string
  projectId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  config: JiraSubtaskConfig
  requestedAt: string
  processedAt?: string
  storyKey?: string
  // Key semantics depend on config.mode:
  //   resource-level → { [resourceId]: subtaskKey }
  //   category-level → { [category]: subtaskKey }  (all resources in same cat share one key)
  //   custom          → { [resourceId]: subtaskKey }  (selected IDs only)
  subtaskKeys: Record<string, string>
}
