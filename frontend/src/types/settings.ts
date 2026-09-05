export interface ProgressWeights {
  /** Preparation weight (%). Migration weight is derived as 100 - preparation. */
  preparation: number
  /** Sub-weights of preparation; must sum to `preparation`. */
  setup: number
  survey: number
  signoff: number
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
  signoffEnabled: boolean
  progressWeights: ProgressWeights
  dataMigration: DataMigrationSettings
  provisionCidrParents?: ProvisionCidrParents
  /** Allowed prefix lengths for project zone CIDRs (e.g. [25, 26, 27]). Admin-overridable. */
  provisionAllowedPrefixes?: number[]
}

/** Parent CIDR blocks per environment × availability zone; project zone CIDRs (/26, /27)
 *  must be carved from these. Admin-overridable via /admin/provision-cidrs. */
export interface ProvisionCidrParents {
  dev: Record<'zoneA' | 'zoneB' | 'zoneC', string[]>
  prod: Record<'zoneA' | 'zoneB' | 'zoneC', string[]>
}

export interface CustomNavCardConfig {
  title: string
  description: string
  url: string
}
