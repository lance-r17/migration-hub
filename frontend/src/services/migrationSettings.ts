import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { DataMigrationPeriod, DataMigrationSettings, MigrationSettings } from '@/types/settings'

const ENDPOINT = '/api/v1/settings/migration'

interface PeriodApi {
  start_date?: string
  end_date?: string
}

interface DataMigrationSettingsApi {
  cycle_duration_days: number
  min_cycle: number
  max_cycle: number
  min_dts_instance_count: number
  max_dts_instance_count: number
  cycle_period: PeriodApi | null
  cycle_capacity: number
  asr_dr_license_capacity: number
  support_email: string | null
}

interface MigrationSettingsApi {
  platform_period: PeriodApi | null
  new_cloud_setup_period: PeriodApi | null
  duration_options: number[]
  bgi_tier_depth: number | null
  data_migration_adjustment_enabled: boolean
  data_migration: DataMigrationSettingsApi
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

function dataMigrationPeriodToApi(period?: DataMigrationPeriod): PeriodApi | null {
  if (!period) return null
  return {
    start_date: period.startDate ?? undefined,
    end_date: period.endDate ?? undefined,
  }
}

function dataMigrationFromApi(raw: DataMigrationSettingsApi): DataMigrationSettings {
  return {
    cycleDurationDays: raw.cycle_duration_days,
    minCycle: raw.min_cycle,
    maxCycle: raw.max_cycle,
    minDtsInstanceCount: raw.min_dts_instance_count,
    maxDtsInstanceCount: raw.max_dts_instance_count,
    cyclePeriod: periodFromApi(raw.cycle_period),
    cycleCapacity: raw.cycle_capacity,
    asrDrLicenseCapacity: raw.asr_dr_license_capacity,
    supportEmail: raw.support_email ?? undefined,
  }
}

function dataMigrationToApi(settings: DataMigrationSettings): DataMigrationSettingsApi {
  return {
    cycle_duration_days: settings.cycleDurationDays,
    min_cycle: settings.minCycle,
    max_cycle: settings.maxCycle,
    min_dts_instance_count: settings.minDtsInstanceCount,
    max_dts_instance_count: settings.maxDtsInstanceCount,
    cycle_period: dataMigrationPeriodToApi(settings.cyclePeriod),
    cycle_capacity: settings.cycleCapacity,
    asr_dr_license_capacity: settings.asrDrLicenseCapacity,
    support_email: settings.supportEmail ?? null,
  }
}

function fromApi(raw: MigrationSettingsApi): MigrationSettings {
  return {
    platformPeriod: periodFromApi(raw.platform_period),
    cloudSetupPeriod: periodFromApi(raw.new_cloud_setup_period),
    durationOptions: raw.duration_options,
    bgiTierDepth: raw.bgi_tier_depth ?? undefined,
    dataMigrationAdjustmentEnabled: raw.data_migration_adjustment_enabled ?? true,
    dataMigration: raw.data_migration
      ? dataMigrationFromApi(raw.data_migration)
      : {
          cycleDurationDays: 7,
          minCycle: 1,
          maxCycle: 3,
          minDtsInstanceCount: 1,
          maxDtsInstanceCount: 5,
          cycleCapacity: 20,
          asrDrLicenseCapacity: 2,
        },
  }
}

function toApi(config: MigrationSettings): MigrationSettingsApi {
  return {
    platform_period: periodToApi(config.platformPeriod),
    new_cloud_setup_period: periodToApi(config.cloudSetupPeriod),
    duration_options: config.durationOptions,
    bgi_tier_depth: config.bgiTierDepth ?? null,
    data_migration_adjustment_enabled: config.dataMigrationAdjustmentEnabled ?? true,
    data_migration: config.dataMigration ? dataMigrationToApi(config.dataMigration) : dataMigrationToApi({
      cycleDurationDays: 7,
      minCycle: 1,
      maxCycle: 3,
      minDtsInstanceCount: 1,
      maxDtsInstanceCount: 5,
      cycleCapacity: 20,
      asrDrLicenseCapacity: 2,
    }),
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
