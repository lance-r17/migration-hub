import { CheckCircle2, Clock, Hourglass, Wrench, CreditCard, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ensureAllRoles } from '@/lib/approvals'
import type { Approval } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  platform_migration_lead: 'Platform Migration Lead',
  technical_lead: 'Technical Lead',
  business_owner: 'Business Owner',
}
const roleLabel = (r: string) => ROLE_LABELS[r] ?? r

const ROLE_ICONS: Record<string, React.ElementType> = {
  technical_lead: Wrench,
  business_owner: CreditCard,
  platform_migration_lead: Cloud,
}

interface SignOffWorkflowBarProps {
  approvals: Approval[]
  pendingCount?: number
}

function ApprovalNode({ approval }: { approval: Approval }) {
  const isApproved = approval.status === 'approved'
  const isWaiting = approval.status === 'waiting'
  const isPending = approval.status === 'pending'
  const PendingIcon = ROLE_ICONS[approval.role] ?? Hourglass

  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div
        className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shadow-sm border-2 border-background',
          isApproved && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          isWaiting && 'bg-secondary text-secondary-foreground',
          isPending && 'bg-muted text-muted-foreground'
        )}
      >
        {isApproved && <CheckCircle2 size={20} />}
        {isWaiting && <Clock size={20} />}
        {isPending && <PendingIcon size={20} />}
      </div>
      <div className="text-center">
        <p className={cn('text-[11px] font-bold', isPending ? 'text-muted-foreground' : 'text-foreground')}>
          {roleLabel(approval.role)}
        </p>
        {isApproved && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Approved</p>}
        {isWaiting && <p className="text-[10px] text-secondary-foreground font-bold uppercase">In Review</p>}
        {isPending && <p className="text-[10px] text-muted-foreground font-bold uppercase">Pending</p>}
      </div>
    </div>
  )
}

export function SignOffWorkflowBar({ approvals, pendingCount }: SignOffWorkflowBarProps) {
  const allApprovals = ensureAllRoles(approvals)
  const remaining = pendingCount ?? allApprovals.filter(a => a.status !== 'approved').length
  return (
    <section className="mb-8 bg-card rounded-xl p-6 shadow-sm border border-border relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Multi-Role Sign-off Workflow</h2>
          <p className="text-xs text-muted-foreground">{remaining} of {allApprovals.length} approvals remaining for migration execution.</p>
        </div>
        <div className="flex flex-1 max-w-2xl items-center justify-between relative px-4">
          <div className="absolute h-0.5 top-5 left-10 right-10 bg-muted z-0" />
          {allApprovals.map((approval) => (
            <ApprovalNode key={approval.id} approval={approval} />
          ))}
        </div>
      </div>
    </section>
  )
}
