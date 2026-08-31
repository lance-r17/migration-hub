import { store } from '@/data/store'
import { USE_MOCK, delay, apiClient } from './client'
import type { DataMigrationPeriod, DataMigrationSettings, MigrationSettings, ProvisionCidrParents } from '@/types/settings'

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
  extended_adjustment_period: PeriodApi | null
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
  create_jira_stories_on_signoff: boolean
  data_migration: DataMigrationSettingsApi
  provision_cidr_parents?: ProvisionCidrParentsApi | null
  provision_allowed_prefixes?: number[] | null
}

interface ProvisionCidrZoneMapApi {
  zone_a?: string[]
  zone_b?: string[]
  zone_c?: string[]
}

interface ProvisionCidrParentsApi {
  dev?: ProvisionCidrZoneMapApi
  prod?: ProvisionCidrZoneMapApi
}

function provisionCidrParentsFromApi(raw: ProvisionCidrParentsApi | null | undefined): ProvisionCidrParents | undefined {
  if (!raw) return undefined
  const zoneMap = (m: ProvisionCidrZoneMapApi | undefined) => ({
    zoneA: m?.zone_a ?? [],
    zoneB: m?.zone_b ?? [],
    zoneC: m?.zone_c ?? [],
  })
  return { dev: zoneMap(raw.dev), prod: zoneMap(raw.prod) }
}

function provisionCidrParentsToApi(parents: ProvisionCidrParents | undefined): ProvisionCidrParentsApi | null {
  if (!parents) return null
  const zoneMap = (m: Record<'zoneA' | 'zoneB' | 'zoneC', string[]>) => ({
    zone_a: m.zoneA ?? [],
    zone_b: m.zoneB ?? [],
    zone_c: m.zoneC ?? [],
  })
  return { dev: zoneMap(parents.dev), prod: zoneMap(parents.prod) }
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
    extendedAdjustmentPeriod: periodFromApi(raw.extended_adjustment_period),
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
    extended_adjustment_period: dataMigrationPeriodToApi(settings.extendedAdjustmentPeriod),
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
    createJiraStoriesOnSignoff: raw.create_jira_stories_on_signoff ?? true,
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
    provisionCidrParents: provisionCidrParentsFromApi(raw.provision_cidr_parents),
    provisionAllowedPrefixes: raw.provision_allowed_prefixes ?? undefined,
  }
}

function toApi(config: MigrationSettings): MigrationSettingsApi {
  return {
    platform_period: periodToApi(config.platformPeriod),
    new_cloud_setup_period: periodToApi(config.cloudSetupPeriod),
    duration_options: config.durationOptions,
    bgi_tier_depth: config.bgiTierDepth ?? null,
    data_migration_adjustment_enabled: config.dataMigrationAdjustmentEnabled ?? true,
    create_jira_stories_on_signoff: config.createJiraStoriesOnSignoff ?? true,
    data_migration: config.dataMigration ? dataMigrationToApi(config.dataMigration) : dataMigrationToApi({
      cycleDurationDays: 7,
      minCycle: 1,
      maxCycle: 3,
      minDtsInstanceCount: 1,
      maxDtsInstanceCount: 5,
      cycleCapacity: 20,
      asrDrLicenseCapacity: 2,
    }),
    provision_cidr_parents: provisionCidrParentsToApi(config.provisionCidrParents),
    provision_allowed_prefixes: config.provisionAllowedPrefixes ?? null,
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
