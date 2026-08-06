import { getInfraFootprintScore, getMigrationDriverScore, type InfraFootprintLevel, type MigrationDriverLevel } from '../src/lib/scoring'
import { mockProjects } from '../src/data/mock'
import type { Project } from '../src/types'

function assertEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertScore<T>(label: string, actual: T | null, expected: T) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function findProject(id: string): Project {
  const p = mockProjects.find(p => p.id === id)
  if (!p) throw new Error(`Mock project ${id} not found`)
  return p
}

// ─── Real project cases from mock data ───────────────────────────────────────

const alphaCore = findProject('PRJ-2024-ALPHA')
const alphaInfra = getInfraFootprintScore(alphaCore)
assertEqual('Alpha Core ECS count', alphaInfra.ecsCount, 6)
assertEqual('Alpha Core MaxCompute count', alphaInfra.maxcomputeCount, 0)
assertEqual('Alpha Core data volume ~TB', Math.round(alphaInfra.dataVolumeTb * 1000), 29223)
assertScore('Alpha Core infra score', alphaInfra.score, 'Large' as InfraFootprintLevel)

const alphaDriver = getMigrationDriverScore(alphaCore)
assertEqual('Alpha Core third-party effort', alphaDriver.thirdPartyEffort, 2)
assertEqual('Alpha Core dependency count', alphaDriver.dependencyCount, 6)
assertEqual('Alpha Core internal users', alphaDriver.internalUserCount, 2400)
assertEqual('Alpha Core external users', alphaDriver.externalUserCount, 0)
assertEqual('Alpha Core app count', alphaDriver.appCount, 1)
assertScore('Alpha Core driver score', alphaDriver.score, 'High' as MigrationDriverLevel)

const authLegacy = findProject('M-11029')
const authInfra = getInfraFootprintScore(authLegacy)
assertEqual('Auth Legacy ECS count', authInfra.ecsCount, 2)
assertEqual('Auth Legacy data volume <1TB', authInfra.dataVolumeTb < 1, true)
assertScore('Auth Legacy infra score', authInfra.score, 'Lightweight' as InfraFootprintLevel)

const authDriver = getMigrationDriverScore(authLegacy)
assertEqual('Auth Legacy dependency count', authDriver.dependencyCount, 3)
assertEqual('Auth Legacy internal users', authDriver.internalUserCount, 800)
assertScore('Auth Legacy driver score', authDriver.score, 'Low' as MigrationDriverLevel)

const emptyProject = findProject('M-88271')
const emptyInfra = getInfraFootprintScore(emptyProject)
assertScore('Empty project infra score', emptyInfra.score, null)
const emptyDriver = getMigrationDriverScore(emptyProject)
assertScore('Empty project driver score (missing tier → Low)', emptyDriver.score, 'Low' as MigrationDriverLevel)

const edgeDns = findProject('M-77122')
const edgeInfra = getInfraFootprintScore(edgeDns)
assertEqual('Edge DNS ECS count', edgeInfra.ecsCount, 2)
assertScore('Edge DNS infra score', edgeInfra.score, 'Lightweight' as InfraFootprintLevel)
const edgeDriver = getMigrationDriverScore(edgeDns)
assertEqual('Edge DNS dependency count', edgeDriver.dependencyCount, 5)
assertEqual('Edge DNS external users', edgeDriver.externalUserCount, 4000000)
assertScore('Edge DNS driver score', edgeDriver.score, 'High' as MigrationDriverLevel)

// ─── Synthetic boundary cases ──────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'synthetic',
    name: 'Synthetic',
    status: 'planning',
    progress: 0,
    team: [],
    risks: [],
    approvals: [],
    ...overrides,
  } as Project
}

// ECS boundary: 10 → Lightweight, 11 → Mid-tier
const ecs10 = makeProject({
  currentInfrastructure: { resources: Array.from({ length: 10 }, (_, i) => ({
    resourceId: `i-${i}`, name: `vm-${i}`, product: 'ecs', resourceSet: 'rs-prod', syncStatus: 'synced',
  })) },
})
assertScore('ECS 10 → Lightweight', getInfraFootprintScore(ecs10).score, 'Lightweight' as InfraFootprintLevel)

const ecs11 = makeProject({
  currentInfrastructure: { resources: Array.from({ length: 11 }, (_, i) => ({
    resourceId: `i-${i}`, name: `vm-${i}`, product: 'ecs', resourceSet: 'rs-prod', syncStatus: 'synced',
  })) },
})
assertScore('ECS 11 → Mid-tier', getInfraFootprintScore(ecs11).score, 'Mid-tier' as InfraFootprintLevel)

const ecs30 = makeProject({
  currentInfrastructure: { resources: Array.from({ length: 30 }, (_, i) => ({
    resourceId: `i-${i}`, name: `vm-${i}`, product: 'ecs', resourceSet: 'rs-prod', syncStatus: 'synced',
  })) },
})
assertScore('ECS 30 → Large', getInfraFootprintScore(ecs30).score, 'Large' as InfraFootprintLevel)

const ecs31 = makeProject({
  currentInfrastructure: { resources: Array.from({ length: 31 }, (_, i) => ({
    resourceId: `i-${i}`, name: `vm-${i}`, product: 'ecs', resourceSet: 'rs-prod', syncStatus: 'synced',
  })) },
})
assertScore('ECS 31 → Extended', getInfraFootprintScore(ecs31).score, 'Extended' as InfraFootprintLevel)

// Data volume boundaries: <1TB, 1TB, 5TB, 10TB, 100TB, 101TB
function makeDataProject(tb: number): Project {
  return makeProject({
    currentInfrastructure: {
      resources: [{
        resourceId: 'r-1', name: 'DB', product: 'rds', resourceSet: 'rs-prod', syncStatus: 'synced',
        specs: { storage_tb: tb },
      }],
    },
  })
}
assertScore('Data <1TB → Lightweight', getInfraFootprintScore(makeDataProject(0.5)).score, 'Lightweight' as InfraFootprintLevel)
assertScore('Data 1TB → Mid-tier', getInfraFootprintScore(makeDataProject(1)).score, 'Mid-tier' as InfraFootprintLevel)
assertScore('Data 5TB → Mid-tier', getInfraFootprintScore(makeDataProject(5)).score, 'Mid-tier' as InfraFootprintLevel)
assertScore('Data 10TB → Large', getInfraFootprintScore(makeDataProject(10)).score, 'Large' as InfraFootprintLevel)
assertScore('Data 100TB → Large', getInfraFootprintScore(makeDataProject(100)).score, 'Large' as InfraFootprintLevel)
assertScore('Data 101TB → Extended', getInfraFootprintScore(makeDataProject(101)).score, 'Extended' as InfraFootprintLevel)

// MaxCompute boundaries: 0 → Lightweight, 1 → Mid-tier, 20 → Mid-tier, 21 → Large, 50 → Large, 51 → Extended
function makeMaxcomputeProject(count: number): Project {
  return makeProject({
    currentInfrastructure: {
      resources: [
        ...Array.from({ length: count }, (_, i) => ({
          resourceId: `mc-${i}`, name: `mc-${i}`, product: 'maxcompute' as const, resourceSet: 'rs-prod', syncStatus: 'synced' as const,
        })),
        {
          resourceId: 'lb-1', name: 'LB', product: 'slb' as const, resourceSet: 'rs-prod', syncStatus: 'synced' as const,
        },
      ],
    },
  })
}
assertScore('MaxCompute 0 → Lightweight', getInfraFootprintScore(makeMaxcomputeProject(0)).score, 'Lightweight' as InfraFootprintLevel)
assertScore('MaxCompute 1 → Mid-tier', getInfraFootprintScore(makeMaxcomputeProject(1)).score, 'Mid-tier' as InfraFootprintLevel)
assertScore('MaxCompute 20 → Mid-tier', getInfraFootprintScore(makeMaxcomputeProject(20)).score, 'Mid-tier' as InfraFootprintLevel)
assertScore('MaxCompute 21 → Large', getInfraFootprintScore(makeMaxcomputeProject(21)).score, 'Large' as InfraFootprintLevel)
assertScore('MaxCompute 50 → Large', getInfraFootprintScore(makeMaxcomputeProject(50)).score, 'Large' as InfraFootprintLevel)
assertScore('MaxCompute 51 → Extended', getInfraFootprintScore(makeMaxcomputeProject(51)).score, 'Extended' as InfraFootprintLevel)

// Dev resources should be excluded
const devOnly = makeProject({
  currentInfrastructure: { resources: [{
    resourceId: 'i-1', name: 'dev-vm', product: 'ecs', resourceSet: 'rs-dev', syncStatus: 'synced',
  }] },
})
assertScore('Dev-only ECS excluded → N/A', getInfraFootprintScore(devOnly).score, null)

// Migration Driver tier mapping
function makeDriverProject(tier: Project['applicationOverview']['applicationTier'], iita: boolean, deps: number, users: number): Project {
  return makeProject({
    applicationOverview: {
      applicationTier: tier,
      iitaApplicability: iita,
      userBase: { type: 'Internal', count: String(users) },
    },
    dependencies: {
      upstream: Array.from({ length: deps }, (_, i) => ({ id: `d-${i}`, name: `dep-${i}` })),
      downstream: [],
    },
    migrationEffortEstimation: { tables: [{ baId: 'BA', tasks: [] }] },
  } as Project)
}
assertScore('T3 no IITA → Low', getMigrationDriverScore(makeDriverProject('T3', false, 1, 100)).score, 'Low' as MigrationDriverLevel)
assertScore('T2 no IITA → Low', getMigrationDriverScore(makeDriverProject('T2', false, 1, 100)).score, 'Low' as MigrationDriverLevel)
assertScore('T2 + IITA → Medium', getMigrationDriverScore(makeDriverProject('T2', true, 1, 100)).score, 'Medium' as MigrationDriverLevel)
assertScore('T1 no IITA → Medium', getMigrationDriverScore(makeDriverProject('T1', false, 1, 100)).score, 'Medium' as MigrationDriverLevel)
assertScore('T1 + IITA → High', getMigrationDriverScore(makeDriverProject('T1', true, 1, 100)).score, 'High' as MigrationDriverLevel)
assertScore('T0 → High', getMigrationDriverScore(makeDriverProject('T0', false, 1, 100)).score, 'High' as MigrationDriverLevel)

// Driver numeric boundaries
function makeNumericDriverProject(thirdParty: number, deps: number, users: number, apps: number): Project {
  return makeProject({
    applicationOverview: { userBase: { type: 'External', count: String(users) } },
    dependencies: {
      upstream: Array.from({ length: deps }, (_, i) => ({ id: `d-${i}`, name: `dep-${i}` })),
      downstream: [],
    },
    migrationEffortEstimation: {
      tables: Array.from({ length: apps }, (_, i) => ({
        baId: `BA-${i}`,
        tasks: [{ effortType: 'third_party_services', effort: thirdParty, effortTime: 1, rate: 1000, thirdParty: true }],
      })),
    },
  } as Project)
}
assertScore('Third party 2 FTE → Low', getMigrationDriverScore(makeNumericDriverProject(2, 0, 0, 1)).thirdPartyLevel, 'Low' as MigrationDriverLevel)
assertScore('Third party 3 FTE → Medium', getMigrationDriverScore(makeNumericDriverProject(3, 0, 0, 1)).thirdPartyLevel, 'Medium' as MigrationDriverLevel)
assertScore('Third party 5 FTE → High', getMigrationDriverScore(makeNumericDriverProject(5, 0, 0, 1)).thirdPartyLevel, 'High' as MigrationDriverLevel)
assertScore('Dependencies 4 → Low', getMigrationDriverScore(makeNumericDriverProject(0, 4, 0, 1)).dependencyLevel, 'Low' as MigrationDriverLevel)
assertScore('Dependencies 5 → Medium', getMigrationDriverScore(makeNumericDriverProject(0, 5, 0, 1)).dependencyLevel, 'Medium' as MigrationDriverLevel)
assertScore('Dependencies 11 → High', getMigrationDriverScore(makeNumericDriverProject(0, 11, 0, 1)).dependencyLevel, 'High' as MigrationDriverLevel)
assertScore('External users 1000 → Low', getMigrationDriverScore(makeNumericDriverProject(0, 0, 1000, 1)).externalUserLevel, 'Low' as MigrationDriverLevel)
assertScore('External users 1001 → Medium', getMigrationDriverScore(makeNumericDriverProject(0, 0, 1001, 1)).externalUserLevel, 'Medium' as MigrationDriverLevel)
assertScore('External users 10001 → High', getMigrationDriverScore(makeNumericDriverProject(0, 0, 10001, 1)).externalUserLevel, 'High' as MigrationDriverLevel)
assertScore('Apps 1 → Low', getMigrationDriverScore(makeNumericDriverProject(0, 0, 0, 1)).appLevel, 'Low' as MigrationDriverLevel)
assertScore('Apps 2 → Medium', getMigrationDriverScore(makeNumericDriverProject(0, 0, 0, 2)).appLevel, 'Medium' as MigrationDriverLevel)
assertScore('Apps 6 → High', getMigrationDriverScore(makeNumericDriverProject(0, 0, 0, 6)).appLevel, 'High' as MigrationDriverLevel)

console.log('All scoring assertions passed.')
