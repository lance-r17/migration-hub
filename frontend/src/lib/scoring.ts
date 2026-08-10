import type { ApplicationTier, CloudResource, Project } from '@/types'

export type InfraFootprintLevel = 'Lightweight' | 'Mid-tier' | 'Large' | 'Extended'
export type MigrationDriverLevel = 'Low' | 'Medium' | 'High'

export interface InfraFootprintResult {
  score: InfraFootprintLevel | null
  ecsCount: number
  ecsLevel: InfraFootprintLevel | null
  dataVolumeTb: number
  dataVolumeLevel: InfraFootprintLevel | null
  maxcomputeCount: number
  maxcomputeLevel: InfraFootprintLevel | null
}

export interface MigrationDriverResult {
  score: MigrationDriverLevel | null
  tierLevel: MigrationDriverLevel | null
  applicationTier: ApplicationTier | undefined
  iitaApplicability: boolean | undefined
  thirdPartyEffort: number
  thirdPartyLevel: MigrationDriverLevel | null
  dependencyCount: number
  dependencyLevel: MigrationDriverLevel | null
  externalUserCount: number
  externalUserLevel: MigrationDriverLevel | null
  internalUserCount: number
  internalUserLevel: MigrationDriverLevel | null
  appCount: number
  appLevel: MigrationDriverLevel | null
}

// Mirrors backend/app/services/product_category_service.py
const PRODUCT_TO_CATEGORY: Record<string, string> = {
  ecs: 'computing',
  ess: 'computing',
  cs: 'computing',
  'cr-ee': 'computing',
  kms: 'security',
  vpc: 'networking',
  slb: 'networking',
  clouddns: 'networking',
  polardb: 'database',
  rds: 'database',
  'r-kvstore': 'database',
  dds: 'database',
  oss: 'storage',
  sls: 'storage',
  rocketmq: 'middleware',
  dataworks: 'analytics-computing',
  'quickbi-public': 'analytics-computing',
  maxcompute: 'analytics-computing',
  cms: 'monitoring',
}

function getCategoryForProduct(product?: string): string {
  return (product ? PRODUCT_TO_CATEGORY[product] : undefined) ?? 'computing'
}

function isProdResource(resource: CloudResource): boolean {
  return resource.resourceSet ? resource.resourceSet.endsWith('-prod') : false
}

function parseFirstNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const str = String(value)
  const match = str.match(/(\d[\d,]*(?:\.\d+)?)\s*(K|M|B)?/i)
  if (!match) return null
  const normalized = match[1].replace(/,/g, '')
  const num = Number(normalized)
  if (!Number.isFinite(num)) return null
  const suffix = match[2]?.toUpperCase()
  if (suffix === 'K') return num * 1_000
  if (suffix === 'M') return num * 1_000_000
  if (suffix === 'B') return num * 1_000_000_000
  return num
}

function parseTbFromSpecs(specs?: Record<string, unknown>): number {
  if (!specs) return 0
  let total = 0
  for (const [key, value] of Object.entries(specs)) {
    const lower = key.toLowerCase()
    const num = parseFirstNumber(value)
    if (num === null) continue
    if (lower.endsWith('_tb') || lower === 'capacity_tb' || lower === 'storage_tb' || lower === 'size_tb') {
      total += num
    } else if (lower.endsWith('_gb') || lower === 'capacity_gb' || lower === 'storage_gb' || lower === 'size_gb') {
      total += num / 1024
    }
  }
  return total
}

function ecsLevel(count: number): InfraFootprintLevel | null {
  if (count <= 0) return null
  if (count <= 10) return 'Lightweight'
  if (count <= 20) return 'Mid-tier'
  if (count <= 30) return 'Large'
  return 'Extended'
}

function maxcomputeLevel(count: number): InfraFootprintLevel | null {
  if (count === 0) return 'Lightweight'
  if (count <= 20) return 'Mid-tier'
  if (count <= 50) return 'Large'
  return 'Extended'
}

function dataVolumeLevel(tb: number): InfraFootprintLevel | null {
  if (tb < 1) return 'Lightweight'
  if (tb < 10) return 'Mid-tier'
  if (tb <= 100) return 'Large'
  return 'Extended'
}

function driverLevel(value: number, lowMax: number, mediumMax: number): MigrationDriverLevel | null {
  if (value <= 0) return null
  if (value <= lowMax) return 'Low'
  if (value <= mediumMax) return 'Medium'
  return 'High'
}

function maxInfraLevel(a: InfraFootprintLevel | null, b: InfraFootprintLevel | null): InfraFootprintLevel | null {
  if (!a) return b
  if (!b) return a
  const order: InfraFootprintLevel[] = ['Lightweight', 'Mid-tier', 'Large', 'Extended']
  return order[Math.max(order.indexOf(a), order.indexOf(b))]
}

function maxDriverLevel(a: MigrationDriverLevel | null, b: MigrationDriverLevel | null): MigrationDriverLevel | null {
  if (!a) return b
  if (!b) return a
  const order: MigrationDriverLevel[] = ['Low', 'Medium', 'High']
  return order[Math.max(order.indexOf(a), order.indexOf(b))]
}

export function getInfraFootprintScore(project: Project): InfraFootprintResult {
  const resources = project.currentInfrastructure?.resources ?? []
  const prodResources = resources.filter(isProdResource)

  const ecsCount = prodResources.filter(r => r.product === 'ecs').length
  const maxcomputeCount = prodResources.filter(r => r.product === 'maxcompute').length

  const dataVolumeTb = prodResources.reduce((sum, r) => {
    const category = getCategoryForProduct(r.product)
    if (category !== 'database' && r.product !== 'oss') return sum
    return sum + parseTbFromSpecs(r.specs)
  }, 0)

  const ecsLevelValue = ecsLevel(ecsCount)
  const dataVolumeLevelValue = dataVolumeLevel(dataVolumeTb)
  const maxcomputeLevelValue = maxcomputeLevel(maxcomputeCount)

  let score: InfraFootprintLevel | null = null
  score = maxInfraLevel(score, ecsLevelValue)
  score = maxInfraLevel(score, dataVolumeLevelValue)
  score = maxInfraLevel(score, maxcomputeLevelValue)

  if (prodResources.length === 0) {
    score = 'Lightweight'
  }

  return {
    score,
    ecsCount,
    ecsLevel: ecsLevelValue,
    dataVolumeTb,
    dataVolumeLevel: dataVolumeLevelValue,
    maxcomputeCount,
    maxcomputeLevel: maxcomputeLevelValue,
  }
}

function getTierLevel(tier: ApplicationTier | undefined, iita: boolean | undefined): MigrationDriverLevel | null {
  if (!tier) return 'Low'
  if (tier === 'T3') return 'Low'
  if (tier === 'T2') return iita ? 'Medium' : 'Low'
  if (tier === 'T1') return iita ? 'High' : 'Medium'
  if (tier === 'T0') return 'High'
  return 'Low'
}

export function getMigrationDriverScore(project: Project): MigrationDriverResult {
  const overview = project.applicationOverview
  const tables = project.migrationEffortEstimation?.tables ?? []
  const dependencies = project.dependencies

  const applicationTier = overview?.applicationTier
  const iitaApplicability = overview?.iitaApplicability
  const tierLevel = getTierLevel(applicationTier, iitaApplicability)

  const thirdPartyEffort = tables.reduce((sum, table) => {
    const tasks = table.tasks ?? []
    return sum + tasks.reduce((taskSum, task) => {
      return task.thirdParty ? taskSum + (task.effort ?? 0) : taskSum
    }, 0)
  }, 0)
  const thirdPartyLevel = driverLevel(thirdPartyEffort, 2, 4)

  const dependencyCount = (dependencies?.upstream?.length ?? 0) + (dependencies?.downstream?.length ?? 0)
  const dependencyLevel = driverLevel(dependencyCount, 4, 10)

  const userBase = overview?.userBase
  const userBaseCount = parseFirstNumber(userBase?.count) ?? 0
  const userBaseType = userBase?.type

  let externalUserCount = 0
  let internalUserCount = 0
  if (userBaseType === 'Both') {
    externalUserCount = userBaseCount
    internalUserCount = userBaseCount
  } else if (userBaseType === 'External') {
    externalUserCount = userBaseCount
  } else if (userBaseType === 'Internal') {
    internalUserCount = userBaseCount
  }

  const externalUserLevel = driverLevel(externalUserCount, 1000, 10000)
  const internalUserLevel = driverLevel(internalUserCount, 1000, 5000)

  const appCount = tables.length
  const appLevel = driverLevel(appCount, 1, 5)

  let score: MigrationDriverLevel | null = null
  score = maxDriverLevel(score, tierLevel)
  score = maxDriverLevel(score, thirdPartyLevel)
  score = maxDriverLevel(score, dependencyLevel)
  score = maxDriverLevel(score, externalUserLevel)
  score = maxDriverLevel(score, internalUserLevel)
  score = maxDriverLevel(score, appLevel)

  return {
    score,
    tierLevel,
    applicationTier,
    iitaApplicability,
    thirdPartyEffort,
    thirdPartyLevel,
    dependencyCount,
    dependencyLevel,
    externalUserCount,
    externalUserLevel,
    internalUserCount,
    internalUserLevel,
    appCount,
    appLevel,
  }
}

export function formatTb(value: number): string {
  if (value === 0) return '0 TB'
  if (value < 0.01) return '<0.01 TB'
  if (value < 1) return `${value.toFixed(2)} TB`
  if (value < 10) return `${value.toFixed(1)} TB`
  return `${Math.round(value).toLocaleString()} TB`
}
