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

export interface MigrationSettings {
  platformPeriod?: PlatformPeriod
  cloudSetupPeriod?: CloudSetupPeriod
  durationOptions: number[]
  bgiTierDepth?: number
}
