import { useState } from 'react'
import { X, Wrench, CreditCard, Cloud, CheckCircle2 } from 'lucide-react'
import { ApprovalTimeline } from './ApprovalTimeline'
import type { Approval } from '@/types'

interface SignOffModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (role: string) => void
  approvals: Approval[]
  currentUserRole: string | null
}

const roles = [
  { id: 'technical-lead', label: 'Technical Lead', icon: Wrench },
  { id: 'business-owner', label: 'Business Owner', icon: CreditCard },
  { id: 'platform-lead', label: 'Platform Migration Lead', icon: Cloud },
]

export function SignOffModal({ open, onClose, onConfirm, approvals, currentUserRole }: SignOffModalProps) {
  const [comment, setComment] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  if (!open) return null

  const matchedRole = roles.find(r => r.label === currentUserRole)

  const handleConfirm = () => {
    if (!acknowledged || !currentUserRole) return
    onConfirm(currentUserRole)
    setComment('')
    setAcknowledged(false)
  }

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Panel */}
        <div className="w-full md:w-80 bg-muted/50 p-8 flex flex-col overflow-y-auto">
          <ApprovalTimeline approvals={approvals} />
        </div>

        {/* Right Panel */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">Authority Sign-off</h3>
              <p className="text-muted-foreground text-sm mt-1">Provide your credentials and commentary</p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted p-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Role Display */}
            <div>
              <label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-3 block">
                My Authority Role
              </label>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-card border-2 border-primary shadow-sm">
                {matchedRole
                  ? <matchedRole.icon size={18} className="text-muted-foreground" />
                  : null
                }
                <span className="text-sm font-semibold text-foreground">
                  {currentUserRole ?? 'No role assigned for this project'}
                </span>
                {matchedRole && <CheckCircle2 size={18} className="text-primary ml-auto" />}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-3 block">
                Commentary / Justification
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Enter sign-off comments or risk mitigation notes..."
                className="w-full bg-card ring-1 ring-border focus:ring-2 focus:ring-primary/20 rounded-lg text-sm p-4 placeholder:text-muted-foreground/50 outline-none transition-all resize-none border-none text-foreground"
              />
            </div>

            {/* Acknowledgement */}
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <input
                type="checkbox"
                id="ack"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-primary flex-shrink-0 cursor-pointer"
              />
              <label htmlFor="ack" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
                I confirm that I have reviewed the migration readiness report and authorize the transition of all specified workloads to the destination platform.
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!acknowledged}
                className="px-8 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
