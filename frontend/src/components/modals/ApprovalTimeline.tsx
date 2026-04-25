import { Check, Clock, Circle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Approval } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  platform_migration_lead: 'Platform Migration Lead',
  technical_lead: 'Technical Lead',
  business_owner: 'Business Owner',
}
const roleLabel = (r: string) => ROLE_LABELS[r] ?? r

interface ApprovalTimelineProps {
  approvals: Approval[]
}

function StepDot({ status }: { status: Approval['status'] }) {
  if (status === 'approved') {
    return (
      <div className="z-10 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
        <Check size={14} strokeWidth={2.5} />
      </div>
    )
  }
  if (status === 'waiting') {
    return (
      <div className="z-10 w-6 h-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground ring-4 ring-primary/10 flex-shrink-0">
        <Clock size={12} />
      </div>
    )
  }
  return (
    <div className="z-10 w-6 h-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground flex-shrink-0">
      <Circle size={14} />
    </div>
  )
}

export function ApprovalTimeline({ approvals }: ApprovalTimelineProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold text-foreground mb-8">Approval Status</h2>
      <div className="space-y-10 relative flex-1">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        {approvals.map((approval) => (
          <div key={approval.id} className="relative flex gap-4">
            <StepDot status={approval.status} />
            <div>
              <p className={cn(
                'text-sm font-semibold',
                approval.status === 'pending' && 'text-muted-foreground'
              )}>
                {roleLabel(approval.role)}
              </p>
              {approval.status === 'approved' && (
                <>
                  <p className="text-xs text-muted-foreground">Approved by {approval.approver}</p>
                  {approval.timestamp && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-tighter">
                      {approval.timestamp}
                    </p>
                  )}
                </>
              )}
              {approval.status === 'waiting' && (
                <p className="text-xs text-primary font-medium italic">Waiting for input...</p>
              )}
              {approval.status === 'pending' && (
                <p className="text-xs text-muted-foreground/60">Final Authorization</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-8">
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-secondary-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Context</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Once all roles confirm, the ledger will be immutable and the transition window will execute.
          </p>
        </div>
      </div>
    </div>
  )
}
