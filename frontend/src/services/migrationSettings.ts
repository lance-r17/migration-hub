import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { MigrationSettings } from '@/types/settings'

const ENDPOINT = '/api/v1/settings/migration'

interface MigrationSettingsApi {
  platform_period: { start_date?: string; end_date?: string } | null
  duration_options: number[]
}

function fromApi(raw: MigrationSettingsApi): MigrationSettings {
  return {
    platformPeriod: raw.platform_period
      ? {
          startDate: raw.platform_period.start_date ?? undefined,
          endDate: raw.platform_period.end_date ?? undefined,
        }
      : undefined,
    durationOptions: raw.duration_options,
  }
}

function toApi(config: MigrationSettings): MigrationSettingsApi {
  return {
    platform_period: config.platformPeriod
      ? {
          start_date: config.platformPeriod.startDate ?? undefined,
          end_date: config.platformPeriod.endDate ?? undefined,
        }
      : null,
    duration_options: config.durationOptions,
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
