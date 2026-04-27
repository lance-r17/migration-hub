import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { BillingThresholdConfig } from '@/types/finance'

const ENDPOINT = '/api/v1/settings/billing-thresholds'

// ─── Raw API shape ────────────────────────────────────────────────────────────

interface BillingThresholdConfigApi {
  healthy_at_risk_threshold: number
  at_risk_over_threshold: number
  currency: string
  baseline_month: string | null
  ytd_start_month: string | null
}

function fromApi(raw: BillingThresholdConfigApi): BillingThresholdConfig {
  return {
    healthyAtRiskThreshold: raw.healthy_at_risk_threshold,
    atRiskOverThreshold: raw.at_risk_over_threshold,
    currency: raw.currency ?? 'CNY',
    baselineMonth: raw.baseline_month ?? undefined,
    ytdStartMonth: raw.ytd_start_month ?? undefined,
  }
}

function toApi(config: BillingThresholdConfig): BillingThresholdConfigApi {
  return {
    healthy_at_risk_threshold: config.healthyAtRiskThreshold,
    at_risk_over_threshold: config.atRiskOverThreshold,
    currency: config.currency,
    baseline_month: config.baselineMonth ?? null,
    ytd_start_month: config.ytdStartMonth ?? null,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getBillingThresholdConfig(): Promise<BillingThresholdConfig> {
  if (USE_MOCK) { await delay(); return store.getBillingThresholdConfig() }
  const raw = await apiClient.get<BillingThresholdConfigApi>(ENDPOINT)
  return fromApi(raw)
}

export async function saveBillingThresholdConfig(config: BillingThresholdConfig): Promise<BillingThresholdConfig> {
  if (USE_MOCK) { await delay(300); return store.setBillingThresholdConfig(config) }
  const raw = await apiClient.put<BillingThresholdConfigApi>(ENDPOINT, toApi(config))
  return fromApi(raw)
}
