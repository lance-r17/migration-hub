// Shared wave-planning milestone math, extracted from WaveGanttChart so both the
// Gantt chart and other surfaces (e.g. StageProgressStepper) compute identical results.
import type { LucideIcon } from 'lucide-react'
import { CloudUpload, Database, HardDrive, BarChart2, Cpu, ArrowRight, Sparkles, Pencil, DatabaseBackup } from 'lucide-react'
import type { Project, ProjectPlanning, PlanningMilestone, MilestoneType } from '@/types'
import type { CategoryMilestone } from '@/types/categoryMilestone'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

function parseDate(iso: string): Date { return new Date(iso + 'T00:00:00Z') }
function toIso(d: Date): string        { return d.toISOString().slice(0, 10) }

export function daysBetweenDates(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

/** Duration in days, matching the Gantt chart's formatDuration rule.
 *  End dates are inclusive: 8 Jun → 15 Jun spans 8 calendar days. */
export function milestoneDurationDays(start: string, end: string): number {
  return Math.max(1, daysBetweenDates(parseDate(start), parseDate(end)) + 1)
}

// ─── Id helpers ───────────────────────────────────────────────────────────────

/** Synthetic per-project row id for a category milestone instance. */
export function categoryMilestoneRowId(projectId: string, cmId: string): string {
  return `category-milestone-${projectId}-${cmId}`
}

/** Extracts the global CM id from a category-milestone row id (prefix slicing — cmIds contain dashes). */
export function parseCategoryMilestoneRowId(projectId: string, rowId: string): string | null {
  const prefix = `category-milestone-${projectId}-`
  return rowId.startsWith(prefix) ? rowId.slice(prefix.length) : null
}

/** Orders rows by a saved id list: known ids in saved order first, unknown ids appended in default order. */
export function orderByIdList<T extends { id: string }>(rows: T[], order?: string[]): T[] {
  if (!order?.length) return rows
  const idx = new Map(order.map((id, i) => [id, i]))
  const known = rows.filter(r => idx.has(r.id)).sort((a, b) => idx.get(a.id)! - idx.get(b.id)!)
  const unknown = rows.filter(r => !idx.has(r.id))
  return [...known, ...unknown]
}

// ─── Type colors (shared with the Gantt chart legend) ─────────────────────────

export const MILESTONE_TYPE_META: Record<MilestoneType, { bg: string; color: string; label: string; icon: LucideIcon }> = {
  'env-provision':          { bg: 'oklch(0.88 0.05 185)', color: 'oklch(0.35 0.10 185)', label: 'Env',    icon: CloudUpload },
  'dev-resource-provision': { bg: 'oklch(0.91 0.05 200)', color: 'oklch(0.35 0.12 200)', label: 'DevRes', icon: Cpu         },
  'dev-data-migration':     { bg: 'oklch(0.90 0.06 220)', color: 'oklch(0.35 0.13 260)', label: 'DevData', icon: Database    },
  'dev-big-data-migration': { bg: 'oklch(0.90 0.06 200)', color: 'oklch(0.35 0.13 230)', label: 'DevBigData', icon: DatabaseBackup },
  'dev-cutover':            { bg: 'oklch(0.92 0.04 290)', color: 'oklch(0.35 0.12 300)', label: 'DevCut', icon: ArrowRight  },
  'prd-resource-provision': { bg: 'oklch(0.91 0.05 20)',  color: 'oklch(0.40 0.14 20)',  label: 'PrdRes', icon: HardDrive   },
  'prd-data-migration':     { bg: 'oklch(0.92 0.04 240)', color: 'oklch(0.35 0.15 260)', label: 'PrdData', icon: BarChart2   },
  'prd-big-data-migration': { bg: 'oklch(0.91 0.05 320)', color: 'oklch(0.40 0.14 320)', label: 'PrdBigData', icon: DatabaseBackup },
  'prd-cutover':            { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)', label: 'PrdCut', icon: Sparkles    },
  'custom':                 { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)', label: 'Custom', icon: Pencil      },
  'category-milestone':     { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)', label: 'Category', icon: Pencil    },
  'data-migration-period':  { bg: 'oklch(0.88 0.06 300)', color: 'oklch(0.40 0.14 300)', label: 'DataMigration', icon: DatabaseBackup },
}

// ─── Auto-derived milestones ──────────────────────────────────────────────────

export function buildEnvironmentProvisionMilestones(p: Project): PlanningMilestone[] {
  const provision = p.environmentProvision
  if (!provision) return []

  const today = toIso(new Date())
  const result: PlanningMilestone[] = []
  for (const env of ['dev', 'prod'] as const) {
    const entry = provision[env]
    if (!entry?.date) continue
    let status: PlanningMilestone['status']
    if (entry.completedAt) status = 'done'
    else if (entry.date <= today) status = 'in-progress'
    else status = 'todo'
    result.push({
      id: `env-provision-date-${p.id}-${env}`,
      name: `Environment Provision (${env === 'dev' ? 'Dev' : 'Prod'})`,
      type: 'env-provision',
      start: entry.date,
      end: entry.date,
      status,
      deps: [],
      immutable: true,
    })
  }
  return result
}

export function buildDataMigrationPeriodMilestone(p: Project): PlanningMilestone | undefined {
  const plan = p.dataMigrationPlan ?? p.dataMigrationSchedule
  if (!plan) return undefined

  const candidates: { start?: string; end?: string }[] = []
  if (plan.startDate) candidates.push({ start: plan.startDate, end: plan.endDate })
  if (plan.cycleBlocks?.length) {
    for (const block of plan.cycleBlocks) {
      candidates.push({ start: block.startDate, end: block.endDate })
    }
  }
  if (candidates.length === 0) return undefined

  let start: string | undefined
  let end: string | undefined
  for (const c of candidates) {
    if (c.start && (!start || c.start < start)) start = c.start
    if (c.end && (!end || c.end > end)) end = c.end
  }
  if (!start || !end) return undefined

  const today = toIso(new Date())
  let status: PlanningMilestone['status']
  if (plan.completedAt) status = 'done'
  else if (today >= start && today <= end) status = 'in-progress'
  else status = 'todo'

  return {
    id: `data-migration-period-${p.id}`,
    name: 'Data Migration (Prod)',
    type: 'data-migration-period',
    start,
    end,
    status,
    deps: [],
  }
}

// ─── Milestone rows ───────────────────────────────────────────────────────────

/** Ordered milestone rows for a project: category milestones pinned first (creation order),
 *  then env-provision, data-migration period, and persisted milestones — saved
 *  milestoneRowOrder applied to the non-CM group. Pass a planning override to preview
 *  unsaved local edits (the Gantt chart passes its effective planning). */
export function getMilestoneRows(
  p: Project,
  categoryMilestones: CategoryMilestone[],
  planning?: ProjectPlanning,
): PlanningMilestone[] {
  const plan = planning ?? p.planning
  let milestones = plan?.milestones ?? []
  // Remove any category milestones already in planning to avoid duplication
  const assignedCmIds = new Set(p.categoryMilestoneIds ?? [])
  milestones = milestones.filter(m => !assignedCmIds.has(m.id))

  // Inject category milestones (with per-project overrides), sorted by creation date
  const assignedCMs = (p.categoryMilestoneIds ?? [])
    .map(cmId => categoryMilestones.find(cm => cm.id === cmId))
    .filter((cm): cm is CategoryMilestone => cm !== undefined)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(cm => {
      const override = plan?.categoryMilestoneOverrides?.[cm.id]
      return {
        id: categoryMilestoneRowId(p.id, cm.id),
        name: cm.name,
        type: 'category-milestone' as MilestoneType,
        start: override?.start ?? cm.startDate,
        end: override?.end ?? cm.endDate,
        status: override?.status ?? 'todo' as PlanningMilestone['status'],
        deps: [],
      }
    })

  const dmPeriod = buildDataMigrationPeriodMilestone(p)
  const envMilestones = buildEnvironmentProvisionMilestones(p)

  const savedOrder = plan?.milestoneRowOrder
  return [
    ...assignedCMs,
    ...orderByIdList([...envMilestones, ...(dmPeriod ? [dmPeriod] : []), ...milestones], savedOrder),
  ]
}

/** Effective dates of a milestone row: persisted planning edit or CM override wins. */
export function milestoneRowDates(
  p: Project,
  milestone: PlanningMilestone,
  planning?: ProjectPlanning,
): { start: string; end: string } {
  const plan = planning ?? p.planning
  const t = plan?.milestones?.find(lt => lt.id === milestone.id)
  if (t) return { start: t.start, end: t.end }
  const cmId = parseCategoryMilestoneRowId(p.id, milestone.id) ?? milestone.id
  const override = plan?.categoryMilestoneOverrides?.[cmId]
  if (override) return { start: override.start, end: override.end }
  return { start: milestone.start, end: milestone.end }
}

// ─── Duration stats ───────────────────────────────────────────────────────────

/** Total/completed milestone-duration stats for a project (Percentage column / stepper). */
export function projectMilestoneDurationStats(
  p: Project,
  categoryMilestones: CategoryMilestone[],
  planning?: ProjectPlanning,
): { total: number; done: number } | null {
  const msRows = getMilestoneRows(p, categoryMilestones, planning)
  if (msRows.length === 0) return null
  let total = 0
  let done = 0
  for (const r of msRows) {
    const d = milestoneRowDates(p, r, planning)
    const dur = milestoneDurationDays(d.start, d.end)
    total += dur
    if (r.status === 'done') done += dur
  }
  return { total, done }
}
