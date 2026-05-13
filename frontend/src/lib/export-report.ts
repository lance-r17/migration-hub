import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { getProjects } from '@/services/projects'
import { getEffortTypeLabel } from '@/components/project/EffortTableEditor'
import type { Project } from '@/types'

function calcTaskCost(effort?: number, effortTime?: number, rate?: number): number {
  return (effort ?? 0) * (effortTime ?? 0) * (rate ?? 0)
}

export async function exportEstimatedEffortReport() {
  const projects = await getProjects()

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
    toast.info('No estimated effort data found across projects.')
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
}
