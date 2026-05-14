import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { getProjects } from '@/services/projects'
import { getEffortTypeLabel } from '@/components/project/EffortTableEditor'
import { getStatusLabel } from '@/components/shared/StatusBadge'
import type { Project } from '@/types'

function calcTaskCost(effort?: number, effortTime?: number, rate?: number): number {
  return (effort ?? 0) * (effortTime ?? 0) * (rate ?? 0)
}

export async function exportEstimatedEffortReport() {
  const toastId = toast.loading('Generating estimated effort report...')

  try {
    const projects = await getProjects(['basic', 'effort'])

    const rows: Record<string, string | number>[] = []

    for (const project of projects) {
      const tables = project.migrationEffortEstimation?.tables ?? []
      for (const table of tables) {
        for (const task of table.tasks) {
          rows.push({
            'Project ID': project.id,
            'Project Name': project.name,
            'BA ID': table.baId ?? '',
            'Effort Type': getEffortTypeLabel(task.effortType),
            'Effort Unit (FTE)': task.effort ?? 0,
            'Effort Time (Month)': task.effortTime ?? 0,
            'Rate (Monthly Cost USD)': task.rate ?? 0,
            'Cost (USD)': calcTaskCost(task.effort, task.effortTime, task.rate),
            'Third Party': task.thirdParty === true ? 'Yes' : task.thirdParty === false ? 'No' : '',
            'Remarks': task.remarks ?? '',
          })
        }
      }
    }

    if (rows.length === 0) {
      toast.info('No estimated effort data found across projects.', { id: toastId })
      return
    }

    const headers = [
      'Project ID',
      'Project Name',
      'BA ID',
      'Effort Type',
      'Effort Unit (FTE)',
      'Effort Time (Month)',
      'Rate (Monthly Cost USD)',
      'Cost (USD)',
      'Third Party',
      'Remarks',
    ]

    const worksheet = XLSX.utils.json_to_sheet(rows)

    // Autofilter on header row
    const lastRow = rows.length + 1
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }

    // Column widths
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 14 },
      { wch: 36 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 30 },
    ]

    // Freeze header row
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estimated Effort')

    // Named range on the raw data so finance users can create real pivot tables
    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'EffortData',
        Ref: `'Estimated Effort'!$A$1:$J$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `estimated-effort-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export function formatDate(value: string | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getMigrationDates(project: Project) {
  const p = project.planning
  const mc = project.migrationConstraints
  const start = p?.startDate || mc?.earliestStartDate
  const end = p?.endDate || mc?.latestEndDate
  return { start, end }
}

export function getMigrationPeriodDays(project: Project): number | null {
  const { start, end } = getMigrationDates(project)
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
  const diffTime = e.getTime() - s.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getMigrationEffortSummary(project: Project): {
  totalCost: number
  groups: {
    baId: string
    tasks: { type: string; effort: number; effortTime: number; rate: number; cost: number; thirdParty?: boolean; remarks?: string }[]
    subTotalCost: number
  }[]
} {
  const tables = project.migrationEffortEstimation?.tables ?? []
  const groupMap = new Map<string, typeof tables[number]['tasks']>()
  for (const table of tables) {
    const baId = table.baId || 'No BA'
    const existing = groupMap.get(baId) ?? []
    groupMap.set(baId, existing.concat(table.tasks ?? []))
  }

  const groups: {
    baId: string
    tasks: { type: string; effort: number; effortTime: number; rate: number; cost: number; thirdParty?: boolean; remarks?: string }[]
    subTotalCost: number
  }[] = []

  for (const [baId, tasks] of groupMap) {
    const breakdown = tasks.map(task => {
      const effort = task.effort ?? 0
      const effortTime = task.effortTime ?? 0
      const rate = task.rate ?? 0
      const cost = effort * effortTime * rate
      return { type: task.effortType, effort, effortTime, rate, cost, thirdParty: task.thirdParty, remarks: task.remarks }
    })
    const subTotalCost = breakdown.reduce((sum, t) => sum + t.cost, 0)
    groups.push({ baId, tasks: breakdown, subTotalCost })
  }

  const totalCost = groups.reduce((sum, g) => sum + g.subTotalCost, 0)
  return { totalCost, groups }
}

export function exportProjectsToExcel(projects: Project[], draftProjectIds: string[]) {
  const toastId = toast.loading('Generating projects report...')

  try {
    const rows = projects.map((p) => {
      const { start, end } = getMigrationDates(p)
      const days = getMigrationPeriodDays(p)
      const period = !start && !end ? '—' : `${formatDate(start)} → ${formatDate(end)}${days !== null ? ` (${days} days)` : ''}`
      const { totalCost } = getMigrationEffortSummary(p)
      return {
        'Name': p.name,
        'ID': p.id,
        'Status': getStatusLabel(p.status, p.stageProgress, draftProjectIds.includes(p.id)),
        'Progress (%)': p.progress,
        'ITSO': p.itso ?? '—',
        'ITSO Delegate': p.itsoDelegate ?? '—',
        'BPS': p.applicationOverview?.systemImportanceClassification?.includes('BPS') ? 'Yes' : 'No',
        'IBS': p.applicationOverview?.systemImportanceClassification?.includes('IBS') ? 'Yes' : 'No',
        'IITA': p.applicationOverview?.iitaApplicability ? 'Yes' : 'No',
        'Migration Strategy': p.applicationOverview?.migrationStrategy ?? '—',
        'Migration Period': period,
        'Migration Effort': totalCost > 0 ? `$${Math.round(totalCost).toLocaleString()}` : '—',
        'Migration Story': p.jiraStoryKey ?? '—',
      }
    })

    if (rows.length === 0) {
      toast.info('No projects to export.', { id: toastId })
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
      { wch: 24 }, { wch: 24 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 14 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects')
    XLSX.writeFile(workbook, `projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}
