import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getBillingThresholdConfig, saveBillingThresholdConfig } from '@/services/billingConfig'
import type { BillingThresholdConfig } from '@/types/finance'

const DEFAULTS: BillingThresholdConfig = { healthyAtRiskThreshold: 100, atRiskOverThreshold: 120 }

export function BillingSettingsPage() {
  const navigate = useNavigate()

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [config, setConfig]     = useState<BillingThresholdConfig>(DEFAULTS)
  const [errors, setErrors]     = useState<{ healthy?: string; atRisk?: string }>({})

  useEffect(() => {
    getBillingThresholdConfig()
      .then(setConfig)
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false))
  }, [])

  function validate(cfg: BillingThresholdConfig): { healthy?: string; atRisk?: string } {
    const errs: { healthy?: string; atRisk?: string } = {}
    if (!Number.isFinite(cfg.healthyAtRiskThreshold) || cfg.healthyAtRiskThreshold <= 0)
      errs.healthy = 'Must be a positive number.'
    if (!Number.isFinite(cfg.atRiskOverThreshold) || cfg.atRiskOverThreshold <= 0)
      errs.atRisk = 'Must be a positive number.'
    if (!errs.healthy && !errs.atRisk && cfg.healthyAtRiskThreshold >= cfg.atRiskOverThreshold)
      errs.atRisk = 'Must be greater than the Healthy / At Risk boundary.'
    return errs
  }

  const handleSave = async () => {
    const errs = validate(config)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      await saveBillingThresholdConfig(config)
      toast.success('Thresholds saved', {
        description: `Healthy < ${config.healthyAtRiskThreshold}% · At Risk ${config.healthyAtRiskThreshold}–${config.atRiskOverThreshold}% · Over > ${config.atRiskOverThreshold}%`,
      })
    } catch {
      toast.error('Failed to save thresholds')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/settings')} className="cursor-pointer">
              Settings
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Billing Configuration</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing Configuration</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Adjust the ratio thresholds that classify resource sets as Healthy, At Risk, or Over budget.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 max-w-sm">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-24" />
        </div>
      ) : (
        <div className="space-y-6 max-w-sm">
          <div className="rounded-lg border border-border bg-card p-5 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="healthy-threshold">Healthy / At Risk boundary (%)</Label>
              <p className="text-xs text-muted-foreground">
                Ratios below this value are classified as <span className="font-semibold text-emerald-600 dark:text-emerald-400">Healthy</span>.
              </p>
              <Input
                id="healthy-threshold"
                type="number"
                min={1}
                value={config.healthyAtRiskThreshold}
                onChange={e => setConfig(prev => ({ ...prev, healthyAtRiskThreshold: parseFloat(e.target.value) }))}
                className={errors.healthy ? 'border-destructive' : ''}
              />
              {errors.healthy && (
                <p className="text-xs text-destructive">{errors.healthy}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="atrisk-threshold">At Risk / Over boundary (%)</Label>
              <p className="text-xs text-muted-foreground">
                Ratios above this value are classified as <span className="font-semibold text-red-600 dark:text-red-400">Over</span>. Values in between are <span className="font-semibold text-amber-600 dark:text-amber-400">At Risk</span>.
              </p>
              <Input
                id="atrisk-threshold"
                type="number"
                min={1}
                value={config.atRiskOverThreshold}
                onChange={e => setConfig(prev => ({ ...prev, atRiskOverThreshold: parseFloat(e.target.value) }))}
                className={errors.atRisk ? 'border-destructive' : ''}
              />
              {errors.atRisk && (
                <p className="text-xs text-destructive">{errors.atRisk}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save thresholds'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setConfig(DEFAULTS); setErrors({}) }}
              disabled={saving}
            >
              Reset to defaults
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
