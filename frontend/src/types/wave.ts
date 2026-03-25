export type WaveStatus = 'planned' | 'active' | 'completed'

export interface Wave {
  id: string
  name: string            // e.g. "Wave 3 – Q2 2026"
  startDate: string       // ISO date string e.g. "2026-04-01"
  cutoverDate: string     // ISO date string e.g. "2026-06-30"
  description?: string
  jiraProjectKey: string  // e.g. "MIG"
  jiraEpicKey?: string    // e.g. "MIG-42", populated after creation/import
  source: 'created' | 'imported'
  status: WaveStatus
  createdAt: string       // ISO 8601
}

export interface JiraSubtaskConfig {
  mode: 'resource-level' | 'category-level' | 'custom'
  selectedResourceIds?: string[]   // used when mode === 'custom'
  selectedCategories?: string[]    // used when mode === 'category-level'
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
