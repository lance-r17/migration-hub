import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Calendar } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getBillingThresholdConfig, saveBillingThresholdConfig } from '@/services/billingConfig'
import { MonthPicker } from '@/components/ui/month-picker'
import type { BillingThresholdConfig } from '@/types/finance'

const DEFAULTS: BillingThresholdConfig = { healthyAtRiskThreshold: 100, atRiskOverThreshold: 120, currency: 'CNY' }

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: 'CNY — Chinese Yuan (¥)' },
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar (HK$)' },
]

export function BillingSettingsPage() {
  const navigate = useNavigate()

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [config, setConfig]     = useState<BillingThresholdConfig>(DEFAULTS)
  const [errors, setErrors]     = useState<{ healthy?: string; atRisk?: string; currency?: string }>({})

  useEffect(() => {
    getBillingThresholdConfig()
      .then(setConfig)
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false))
  }, [])

  function validate(cfg: BillingThresholdConfig): { healthy?: string; atRisk?: string; currency?: string } {
    const errs: { healthy?: string; atRisk?: string; currency?: string } = {}
    if (!Number.isFinite(cfg.healthyAtRiskThreshold) || cfg.healthyAtRiskThreshold <= 0)
      errs.healthy = 'Must be a positive number.'
    if (!Number.isFinite(cfg.atRiskOverThreshold) || cfg.atRiskOverThreshold <= 0)
      errs.atRisk = 'Must be a positive number.'
    if (!errs.healthy && !errs.atRisk && cfg.healthyAtRiskThreshold >= cfg.atRiskOverThreshold)
      errs.atRisk = 'Must be greater than the Healthy / At Risk boundary.'
    if (!cfg.currency)
      errs.currency = 'Please select a currency.'
    return errs
  }

  const handleSave = async () => {
    const errs = validate(config)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      await saveBillingThresholdConfig(config)
      toast.success('Billing configuration saved', {
        description: `Healthy < ${config.healthyAtRiskThreshold}% · At Risk ${config.healthyAtRiskThreshold}–${config.atRiskOverThreshold}% · Over > ${config.atRiskOverThreshold}% · Currency: ${config.currency}`,
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

            <div className="space-y-1.5">
              <Label htmlFor="currency">Billing Currency</Label>
              <p className="text-xs text-muted-foreground">
                Currency used to display cost amounts across the Finance page.
              </p>
              <Select
                value={config.currency ?? 'CNY'}
                onValueChange={val => setConfig(prev => ({ ...prev, currency: val }))}
              >
                <SelectTrigger id="currency" className={errors.currency ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-xs text-destructive">{errors.currency}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="baseline-month">Baseline Month</Label>
              <p className="text-xs text-muted-foreground">
                The dedicated existing-cloud month used as the cost baseline.
              </p>
              <MonthPicker
                id="baseline-month"
                value={config.baselineMonth ?? ''}
                onChange={val => setConfig(prev => ({ ...prev, baselineMonth: val || undefined }))}
                placeholder="Select baseline month"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ytd-start-month">YTD Start Month</Label>
              <p className="text-xs text-muted-foreground">
                The start month for year-to-date cost accumulation.
              </p>
              <MonthPicker
                id="ytd-start-month"
                value={config.ytdStartMonth ?? ''}
                onChange={val => setConfig(prev => ({ ...prev, ytdStartMonth: val || undefined }))}
                placeholder="Select YTD start month"
              />
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
