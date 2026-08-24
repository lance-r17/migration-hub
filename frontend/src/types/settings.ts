export interface SignoffConfig {
  enabled: boolean
}

export interface PlatformPeriod {
  startDate?: string
  endDate?: string
}

export interface CloudSetupPeriod {
  startDate?: string
  endDate?: string
}

export interface DataMigrationPeriod {
  startDate?: string
  endDate?: string
}

export interface DataMigrationSettings {
  cycleDurationDays: number
  minCycle: number
  maxCycle: number
  minDtsInstanceCount: number
  maxDtsInstanceCount: number
  cyclePeriod?: DataMigrationPeriod
  extendedAdjustmentPeriod?: DataMigrationPeriod
  cycleCapacity: number
  asrDrLicenseCapacity: number
  supportEmail?: string
}

export interface DataMigrationCycleBlock {
  startDate: string
  endDate: string
  bookedCount: number
}

export interface MigrationSettings {
  platformPeriod?: PlatformPeriod
  cloudSetupPeriod?: CloudSetupPeriod
  durationOptions: number[]
  bgiTierDepth?: number
  dataMigrationAdjustmentEnabled: boolean
  createJiraStoriesOnSignoff?: boolean
  dataMigration: DataMigrationSettings
}

export interface CustomNavCardConfig {
  title: string
  description: string
  url: string
}
