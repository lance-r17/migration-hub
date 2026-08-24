import type { Approval } from '@/types'
import type { Project } from '@/types'

export const DEFAULT_APPROVAL_ROLES = [
  'technical_lead',
  'business_owner',
  'platform_migration_lead',
] as const

export const GBI_ROLES = ['gbi_champion', 'gbi_champion_delegate'] as const

export function getProjectApprovalSequence(project: Project): string[] {
  const gr = project.governanceRoles
  const gbiRoles: string[] = []
  if (gr?.gbiChampion) gbiRoles.push('gbi_champion')
  if (gr?.gbiChampionDelegate) gbiRoles.push('gbi_champion_delegate')
  const gbiRole = gbiRoles.length > 0 ? [gbiRoles[0]] : ['gbi_champion']
  return ['technical_lead', ...gbiRole, 'platform_migration_lead']
}

export function getGbiRoleForProject(project: Project): string | undefined {
  const gr = project.governanceRoles
  if (gr?.gbiChampion) return 'gbi_champion'
  if (gr?.gbiChampionDelegate) return 'gbi_champion_delegate'
  return undefined
}

export function ensureAllRoles(
  approvals: Approval[],
  expectedRoles: readonly string[] = DEFAULT_APPROVAL_ROLES,
): Approval[] {
  const existing = new Map(approvals.map(a => [a.role, a]))
  return expectedRoles.map(role =>
    existing.get(role) ?? {
      id: `default-${role}`,
      role,
      status: 'pending' as const,
      approver: undefined,
      timestamp: undefined,
      icon: '',
      userId: undefined,
    }
  )
}
