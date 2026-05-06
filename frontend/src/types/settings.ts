export interface SignoffConfig {
  enabled: boolean
}

export interface PlatformPeriod {
  startDate?: string
  endDate?: string
}

export interface MigrationSettings {
  platformPeriod?: PlatformPeriod
  durationOptions: number[]
}
