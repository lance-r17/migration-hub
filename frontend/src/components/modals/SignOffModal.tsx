import { useState, useEffect } from 'react'
import { X, Wrench, CreditCard, Cloud, CheckCircle2, Loader2 } from 'lucide-react'
import { ApprovalTimeline } from './ApprovalTimeline'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import type { Approval, CloudResource } from '@/types'
import type { JiraSubtaskConfig } from '@/types/wave'

interface SignOffModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (role: string) => void
  onConfirmWithJira?: (role: string, config: JiraSubtaskConfig) => Promise<void>
  approvals: Approval[]
  currentUserRole: string | null
  cloudResources?: CloudResource[]
}

const roles = [
  { id: 'technical_lead', label: 'Technical Lead', icon: Wrench },
  { id: 'business_owner', label: 'Business Owner', icon: CreditCard },
  { id: 'platform_migration_lead', label: 'Platform Migration Lead', icon: Cloud },
]

function getSubtaskCount(
  mode: JiraSubtaskConfig['mode'],
  resources: CloudResource[],
  customIds: string[],
  getCategoryForProduct: (product?: string) => string,
): number {
  if (mode === 'resource-level') return resources.length
  if (mode === 'category-level') {
    const cats = new Set(resources.map(r => getCategoryForProduct(r.product)))
    return cats.size
  }
  if (mode === 'product-level') {
    const products = new Set(resources.map(r => r.product ?? 'Other'))
    return products.size
  }
  return customIds.length
}

export function SignOffModal({
  open,
  onClose,
  onConfirm,
  onConfirmWithJira,
  approvals,
  currentUserRole,
  cloudResources = [],
}: SignOffModalProps) {
  const [comment, setComment] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [jiraMode, setJiraMode] = useState<JiraSubtaskConfig['mode']>('resource-level')
  const [customIds, setCustomIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { getCategoryForProduct, getNameForProduct } = useProductCategoryMap()

  useEffect(() => {
    if (!open) {
      setComment('')
      setAcknowledged(false)
      setStep(1)
      setJiraMode('resource-level')
      setCustomIds([])
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  const matchedRole = roles.find(r => r.id === currentUserRole)
  const isPlatformLead = currentUserRole === 'platform_migration_lead'
  const inScopeResources = cloudResources.filter(r => r.needMigration !== false)
  const inScopeCategories = Array.from(new Set(inScopeResources.map(r => getCategoryForProduct(r.product))))
  const inScopeProducts = Array.from(new Set(inScopeResources.map(r => r.product ?? 'Other')))
  const subtaskCount = getSubtaskCount(jiraMode, inScopeResources, customIds, getCategoryForProduct)

  const handleStep1Confirm = () => {
    if (!acknowledged || !currentUserRole) return
    if (isPlatformLead) {
      setStep(2)
    } else {
      onConfirm(currentUserRole)
    }
  }

  const handleStep2Confirm = async () => {
    if (!currentUserRole || !onConfirmWithJira) return
    setSubmitting(true)
    const config: JiraSubtaskConfig = {
      mode: jiraMode,
      ...(jiraMode === 'custom' ? { selectedResourceIds: customIds } : {}),
      ...(jiraMode === 'category-level' ? { selectedCategories: inScopeCategories } : {}),
      ...(jiraMode === 'product-level' ? { selectedProducts: inScopeProducts } : {}),
    }
    try {
      await onConfirmWithJira(currentUserRole, config)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCustomId = (id: string) => {
    setCustomIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
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
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              {isPlatformLead && (
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Step {step} of 2
                </p>
              )}
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {step === 1 ? 'Authority Sign-off' : 'Configure Jira Sub-tasks'}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {step === 1
                  ? 'Provide your credentials and commentary'
                  : 'Select how cloud resources map to Jira sub-tasks'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted p-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Step 1: Sign-off form */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Role Display */}
              <div>
                <label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-3 block">
                  My Authority Role
                </label>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card border-2 border-primary shadow-sm">
                  {matchedRole ? <matchedRole.icon size={18} className="text-muted-foreground" /> : null}
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
                  onClick={handleStep1Confirm}
                  disabled={!acknowledged}
                  className="px-8 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {isPlatformLead ? 'Next: Configure Jira' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Jira sub-task configurator */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Mode toggle */}
              <div>
                <label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-3 block">
                  Sub-task Granularity
                </label>
                <ToggleGroup
                  type="single"
                  value={jiraMode}
                  onValueChange={v => { if (v) setJiraMode(v as JiraSubtaskConfig['mode']) }}
                  className="w-full grid grid-cols-4 gap-1"
                >
                  <ToggleGroupItem value="resource-level" className="text-xs">Per Resource</ToggleGroupItem>
                  <ToggleGroupItem value="product-level" className="text-xs">Per Product</ToggleGroupItem>
                  <ToggleGroupItem value="category-level" className="text-xs">Per Category</ToggleGroupItem>
                  <ToggleGroupItem value="custom" className="text-xs">Custom</ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Resource/Category/Custom list */}
              <div>
                <label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground mb-3 block">
                  Sub-tasks Preview
                </label>

                {jiraMode === 'resource-level' && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {inScopeResources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cloud resources defined.</p>
                    ) : inScopeResources.map(r => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <span className="text-foreground font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">{getCategoryForProduct(r.product)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {jiraMode === 'product-level' && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {inScopeProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cloud resources defined.</p>
                    ) : inScopeProducts.map(product => (
                      <div key={product} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <span className="text-foreground font-medium">{getNameForProduct(product)}</span>
                        <span className="text-xs text-muted-foreground">
                          {inScopeResources.filter(r => (r.product ?? 'Other') === product).length} resource(s)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {jiraMode === 'category-level' && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {inScopeCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cloud resources defined.</p>
                    ) : inScopeCategories.map(cat => (
                      <div key={cat} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <span className="text-foreground font-medium">{cat}</span>
                        <span className="text-xs text-muted-foreground">
                          {inScopeResources.filter(r => getCategoryForProduct(r.product) === cat).length} resource(s)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {jiraMode === 'custom' && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {inScopeResources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No cloud resources defined.</p>
                    ) : inScopeResources.map(r => (
                      <label key={r.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 cursor-pointer hover:bg-muted/80 transition-colors">
                        <input
                          type="checkbox"
                          checked={customIds.includes(r.id)}
                          onChange={() => toggleCustomId(r.id)}
                          className="h-4 w-4 rounded accent-primary"
                        />
                        <span className="text-sm text-foreground font-medium flex-1">{r.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">{getCategoryForProduct(r.product)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-task count */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
                <span className="font-semibold text-foreground">{subtaskCount}</span>
                <span className="text-muted-foreground"> sub-task{subtaskCount !== 1 ? 's' : ''} will be created</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Confirm}
                  disabled={submitting || (jiraMode === 'custom' && customIds.length === 0)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity min-w-[200px] justify-center"
                >
                  {submitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Creating Jira Story…</>
                  ) : 'Confirm & Create Jira Story'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
