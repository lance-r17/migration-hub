import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { MigrationSettings } from '@/types/settings'

const ENDPOINT = '/api/v1/settings/migration'

interface PeriodApi {
  start_date?: string
  end_date?: string
}

interface MigrationSettingsApi {
  platform_period: PeriodApi | null
  new_cloud_setup_period: PeriodApi | null
  duration_options: number[]
  gbi_tier_depth: number | null
}

function periodFromApi(raw: PeriodApi | null): { startDate?: string; endDate?: string } | undefined {
  if (!raw) return undefined
  return {
    startDate: raw.start_date ?? undefined,
    endDate: raw.end_date ?? undefined,
  }
}

function periodToApi(period: { startDate?: string; endDate?: string } | undefined): PeriodApi | null {
  if (!period) return null
  return {
    start_date: period.startDate ?? undefined,
    end_date: period.endDate ?? undefined,
  }
}

function fromApi(raw: MigrationSettingsApi): MigrationSettings {
  return {
    platformPeriod: periodFromApi(raw.platform_period),
    cloudSetupPeriod: periodFromApi(raw.new_cloud_setup_period),
    durationOptions: raw.duration_options,
    gbiTierDepth: raw.gbi_tier_depth ?? undefined,
  }
}

function toApi(config: MigrationSettings): MigrationSettingsApi {
  return {
    platform_period: periodToApi(config.platformPeriod),
    new_cloud_setup_period: periodToApi(config.cloudSetupPeriod),
    duration_options: config.durationOptions,
    gbi_tier_depth: config.gbiTierDepth ?? null,
  }
}

export async function getMigrationSettings(): Promise<MigrationSettings> {
  if (USE_MOCK) {
    await delay()
    return store.getMigrationSettings()
  }
  const raw = await apiClient.get<MigrationSettingsApi>(ENDPOINT)
  return fromApi(raw)
}

export async function saveMigrationSettings(config: MigrationSettings): Promise<MigrationSettings> {
  if (USE_MOCK) {
    await delay(300)
    return store.setMigrationSettings(config)
  }
  const raw = await apiClient.put<MigrationSettingsApi>(ENDPOINT, toApi(config))
  return fromApi(raw)
}
