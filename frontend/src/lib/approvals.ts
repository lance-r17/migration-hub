import type { Approval } from '@/types'

export const DEFAULT_APPROVAL_ROLES = [
  'technical_lead',
  'business_owner',
  'platform_migration_lead',
] as const

export function ensureAllRoles(approvals: Approval[]): Approval[] {
  const existing = new Map(approvals.map(a => [a.role, a]))
  return DEFAULT_APPROVAL_ROLES.map(role =>
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
