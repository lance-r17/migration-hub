import type { Project } from '@/types'

export type ProjectStage = 'setup' | 'survey' | 'sign-off' | 'migration' | 'completed'

export interface StageMeta {
  key: ProjectStage
  label: string
  colorVar: string
}

export const STAGE_META: StageMeta[] = [
  { key: 'setup', label: 'Setup', colorVar: '#3B82F6' },
  { key: 'survey', label: 'Survey', colorVar: '#8B5CF6' },
  { key: 'sign-off', label: 'Sign-off', colorVar: '#F59E0B' },
  { key: 'migration', label: 'Migration', colorVar: '#10B981' },
  { key: 'completed', label: 'Completed', colorVar: '#94a3b8' },
]

export function getProjectStage(project: Project): ProjectStage {
  if (project.status === 'completed') return 'completed'
  if (project.status === 'migrating' || (project.stageProgress?.migration ?? 0) > 0) return 'migration'
  if (project.status === 'signed-off' || (project.stageProgress?.signoff ?? 0) > 0) return 'sign-off'
  if ((project.stageProgress?.survey ?? 0) === 100 || project.surveySubmittedAt) return 'survey'
  return 'setup'
}
