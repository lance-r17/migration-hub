import type { Project } from '@/types'

export type ProjectStage = 'setup' | 'survey' | 'sign-off' | 'migration' | 'completed'

export interface StageMeta {
  key: ProjectStage
  label: string
  colorVar: string
}

export const STAGE_META: StageMeta[] = [
  { key: 'setup', label: 'Setup', colorVar: 'var(--chart-1)' },
  { key: 'survey', label: 'Survey', colorVar: 'var(--chart-2)' },
  { key: 'sign-off', label: 'Sign-off', colorVar: 'var(--chart-3)' },
  { key: 'migration', label: 'Migration', colorVar: 'var(--chart-4)' },
  { key: 'completed', label: 'Completed', colorVar: 'var(--chart-5)' },
]

export function getProjectStage(project: Project): ProjectStage {
  if (project.status === 'completed') return 'completed'
  if (project.status === 'migrating' || (project.stageProgress?.migration ?? 0) > 0) return 'migration'
  if (project.status === 'signed-off' || (project.stageProgress?.signoff ?? 0) > 0) return 'sign-off'
  if ((project.stageProgress?.survey ?? 0) === 100 || project.surveySubmittedAt) return 'survey'
  return 'setup'
}
