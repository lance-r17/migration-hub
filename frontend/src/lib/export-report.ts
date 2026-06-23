import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { getProjects } from '@/services/projects'
import { getBgiHierarchy } from '@/services/bgi'
import { getUsers } from '@/services/users'
import { getMigrationSettings } from '@/services/migrationSettings'
import { fetchProductCategoryMap } from '@/services/productCategory'
import { getEffortTypeLabel } from '@/components/project/EffortTableEditor'
import { getStatusLabel } from '@/components/shared/StatusBadge'
import { getBgiAncestry } from '@/lib/bgi-utils'
import type { Project, EngagementStatus } from '@/types'
import type { BgiNode } from '@/types/bgi'

const ENGAGEMENT_STATUS_META: { key: EngagementStatus | 'none'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'waiting_confirmation', label: 'Waiting Confirmation' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No Show' },
  { key: 'no_demand', label: 'No Demand' },
  { key: 'none', label: 'Not Started' },
]

function getEngagementStatusLabel(status?: EngagementStatus): string {
  const key = status ?? 'none'
  return ENGAGEMENT_STATUS_META.find(m => m.key === key)?.label ?? key
}

function calcTaskCost(effort?: number, effortTime?: number, rate?: number): number {
  return (effort ?? 0) * (effortTime ?? 0) * (rate ?? 0)
}

export async function exportEstimatedEffortReport() {
  const toastId = toast.loading('Generating estimated effort report...')

  try {
    const [projects, bgiRoot] = await Promise.all([
      getProjects(['basic', 'effort']),
      getBgiHierarchy().catch(() => null),
    ])

    const rows: Record<string, string | number>[] = []

    for (const project of projects) {
      const bgiAncestry = bgiRoot && project.bgi_id ? getBgiAncestry(bgiRoot, project.bgi_id) : null
      const tables = project.migrationEffortEstimation?.tables ?? []
      for (const table of tables) {
        for (const task of table.tasks) {
          rows.push({
            'Project ID': project.id,
            'Project Name': project.name,
            'BGI L2': bgiAncestry?.l2 ?? '',
            'BGI L3': bgiAncestry?.l3 ?? '',
            'BGI L4': bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName ?? project.bgi_id ?? '') : (project.bgi_id ?? ''),
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
      'BGI L2',
      'BGI L3',
      'BGI L4',
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
      { wch: 28 },
      { wch: 28 },
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
        Ref: `'Estimated Effort'!$A$1:$M$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `estimated-effort-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export async function exportProjectResourcesReport() {
  const toastId = toast.loading('Generating project resources report...')

  try {
    const [projects, categoryEntries, bgiRoot] = await Promise.all([
      getProjects(['basic', 'resources']),
      fetchProductCategoryMap(),
      getBgiHierarchy().catch(() => null),
    ])

    const categoryMap = new Map(categoryEntries.map(e => [e.product, e.category]))

    // Collect all unique spec keys across every resource
    const specKeys = new Set<string>()
    for (const project of projects) {
      for (const resource of project.currentInfrastructure?.resources ?? []) {
        for (const key of Object.keys(resource.specs ?? {})) {
          specKeys.add(key)
        }
      }
    }
    const sortedSpecKeys = Array.from(specKeys).sort()

    const baseHeaders = [
      'Project ID',
      'Project Name',
      'BGI L2',
      'BGI L3',
      'BGI L4',
      'Resource ID',
      'Resource Name',
      'Product',
      'Product Category',
      'Resource Set',
      'Sub Application',
      'Target Resource ID',
      'Sync Status',
      'Need Migration',
      'Migration Completed',
      'Jira Subtask Key',
    ]
    const specHeaders = sortedSpecKeys.map(k => `Spec: ${k}`)
    const headers = [...baseHeaders, ...specHeaders]

    const rows: Record<string, string | number>[] = []

    for (const project of projects) {
      const bgiAncestry = bgiRoot && project.bgi_id ? getBgiAncestry(bgiRoot, project.bgi_id) : null
      for (const resource of project.currentInfrastructure?.resources ?? []) {
        const row: Record<string, string | number> = {
          'Project ID': project.id,
          'Project Name': project.name,
          'BGI L2': bgiAncestry?.l2 ?? '',
          'BGI L3': bgiAncestry?.l3 ?? '',
          'BGI L4': bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName ?? project.bgi_id ?? '') : (project.bgi_id ?? ''),
          'Resource ID': resource.resourceId,
          'Resource Name': resource.name,
          'Product': resource.product ?? '',
          'Product Category': categoryMap.get(resource.product ?? '') ?? '',
          'Resource Set': resource.resourceSet ?? '',
          'Sub Application': resource.subApplication ?? '',
          'Target Resource ID': resource.targetResourceId ?? '',
          'Sync Status': resource.syncStatus,
          'Need Migration': resource.needMigration ? 'Yes' : 'No',
          'Migration Completed': resource.migrationCompleted ? 'Yes' : 'No',
          'Jira Subtask Key': resource.jiraSubtaskKey ?? '',
        }
        for (const key of sortedSpecKeys) {
          const val = resource.specs?.[key]
          row[`Spec: ${key}`] = val !== undefined && val !== null ? String(val) : ''
        }
        rows.push(row)
      }
    }

    if (rows.length === 0) {
      toast.info('No resource data found across projects.', { id: toastId })
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)

    const lastRow = rows.length + 1
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }

    worksheet['!cols'] = headers.map(h => {
      if (h.startsWith('Spec:')) return { wch: 20 }
      if (h === 'Project Name') return { wch: 28 }
      if (h.startsWith('BGI')) return { wch: 28 }
      if (h === 'Resource Name') return { wch: 28 }
      if (h === 'Product Category') return { wch: 18 }
      if (h === 'Resource Set') return { wch: 28 }
      if (h === 'Sub Application') return { wch: 20 }
      if (h === 'Jira Subtask Key') return { wch: 18 }
      return { wch: 14 }
    })

    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Resources')

    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'ResourcesData',
        Ref: `'Project Resources'!$A$1:$${lastCol}$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `project-resources-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export async function exportProjectDependenciesReport() {
  const toastId = toast.loading('Generating project dependencies report...')

  try {
    const [projects, bgiRoot] = await Promise.all([
      getProjects(['basic', 'dependencies']),
      getBgiHierarchy().catch(() => null),
    ])

    const rows: Record<string, string | number>[] = []

    for (const project of projects) {
      const bgiAncestry = bgiRoot && project.bgi_id ? getBgiAncestry(bgiRoot, project.bgi_id) : null
      const bgiL2 = bgiAncestry?.l2 ?? ''
      const bgiL3 = bgiAncestry?.l3 ?? ''
      const bgiL4 = bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName ?? project.bgi_id ?? '') : (project.bgi_id ?? '')
      for (const dep of project.dependencies?.upstream ?? []) {
        rows.push({
          'Project ID': project.id,
          'Project Name': project.name,
          'BGI L2': bgiL2,
          'BGI L3': bgiL3,
          'BGI L4': bgiL4,
          'Dependency Type': 'Upstream',
          'Dependency ID': dep.id,
          'Dependency Name': dep.name,
          'BA ID': dep.baId ?? '',
          'Contact Email': dep.contactEmail ?? '',
          'Hosting': dep.hosting ?? '',
          'Notes': dep.notes ?? '',
        })
      }
      for (const dep of project.dependencies?.downstream ?? []) {
        rows.push({
          'Project ID': project.id,
          'Project Name': project.name,
          'BGI L2': bgiL2,
          'BGI L3': bgiL3,
          'BGI L4': bgiL4,
          'Dependency Type': 'Downstream',
          'Dependency ID': dep.id,
          'Dependency Name': dep.name,
          'BA ID': dep.baId ?? '',
          'Contact Email': dep.contactEmail ?? '',
          'Hosting': dep.hosting ?? '',
          'Notes': dep.notes ?? '',
        })
      }
    }

    if (rows.length === 0) {
      toast.info('No dependency data found across projects.', { id: toastId })
      return
    }

    const headers = [
      'Project ID',
      'Project Name',
      'BGI L2',
      'BGI L3',
      'BGI L4',
      'Dependency Type',
      'Dependency ID',
      'Dependency Name',
      'BA ID',
      'Contact Email',
      'Hosting',
      'Notes',
    ]

    const worksheet = XLSX.utils.json_to_sheet(rows)

    const lastRow = rows.length + 1
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }

    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 36 },
    ]

    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Dependencies')

    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'DependenciesData',
        Ref: `'Project Dependencies'!$A$1:$L$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `project-dependencies-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export async function exportDataMigrationReport() {
  const toastId = toast.loading('Generating data migration report...')

  try {
    const [projects, bgiRoot, users, settings] = await Promise.all([
      getProjects(['basic']),
      getBgiHierarchy().catch(() => null),
      getUsers().catch(() => []),
      getMigrationSettings().catch(() => null),
    ])

    const minCycle = settings?.dataMigration?.minCycle ?? 1
    const userMap = new Map(users.map(u => [u.id, u]))
    const rows: Record<string, string | number>[] = []

    for (const project of projects) {
      const schedule = project.dataMigrationSchedule
      if (!schedule) continue

      const bgiAncestry = bgiRoot && project.bgi_id ? getBgiAncestry(bgiRoot, project.bgi_id) : null
      const lead = schedule.bgiCloudLeadId ? userMap.get(schedule.bgiCloudLeadId) : undefined

      const cycleCountDisplay = schedule.cycleCountOption === 'more'
        ? `> ${minCycle}`
        : (schedule.cycleCount ?? '')

      rows.push({
        'Project ID': project.id,
        'Project Name': project.name,
        'BGI L2': bgiAncestry?.l2 ?? '',
        'BGI L3': bgiAncestry?.l3 ?? '',
        'BGI L4': bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName ?? project.bgi_id ?? '') : (project.bgi_id ?? ''),
        'Migration Start Date': schedule.startDate ? formatDate(schedule.startDate) : '',
        'Migration End Date': schedule.endDate ? formatDate(schedule.endDate) : '',
        'Cycle Count': cycleCountDisplay,
        'Cycle Justification': schedule.cycleJustification ?? '',
        'DTS Instance Count': schedule.dtsInstanceCount ?? '',
        'DTS Justification': schedule.dtsJustification ?? '',
        'ASR-DR Requested': schedule.needAsrDr ? 'Yes' : schedule.needAsrDr === false ? 'No' : '',
        'ASR-DR Justification': schedule.asrDrJustification ?? '',
        'BGI Cloud Lead': lead ? `${lead.name} (${lead.email})` : '',
        'Submitted At': project.dataMigrationSurveySubmittedAt ? formatDate(project.dataMigrationSurveySubmittedAt) : '',
        'Submitted By': project.dataMigrationSurveySubmittedBy ? (userMap.get(project.dataMigrationSurveySubmittedBy)?.name ?? project.dataMigrationSurveySubmittedBy) : '',
        'Accepts Time Adjustment': schedule.acceptsTimeAdjustment ? 'Yes' : schedule.acceptsTimeAdjustment === false ? 'No' : '',
      })
    }

    if (rows.length === 0) {
      toast.info('No data migration schedules found across projects.', { id: toastId })
      return
    }

    const headers = [
      'Project ID',
      'Project Name',
      'BGI L2',
      'BGI L3',
      'BGI L4',
      'Migration Start Date',
      'Migration End Date',
      'Cycle Count',
      'Cycle Justification',
      'DTS Instance Count',
      'DTS Justification',
      'ASR-DR Requested',
      'ASR-DR Justification',
      'BGI Cloud Lead',
      'Submitted At',
      'Submitted By',
      'Accepts Time Adjustment',
    ]

    const worksheet = XLSX.utils.json_to_sheet(rows)

    const lastRow = rows.length + 1
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }

    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 36 },
      { wch: 18 },
      { wch: 36 },
      { wch: 16 },
      { wch: 36 },
      { wch: 32 },
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
    ]

    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Migration')

    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'DataMigrationData',
        Ref: `'Data Migration'!$A$1:$${lastCol}$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `data-migration-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export async function exportProjectDetailsReport() {
  const toastId = toast.loading('Generating project details report...')

  try {
    const projects = await getProjects([
      'basic',
      'itso',
      'itso_delegate',
      'governance',
      'availability',
      'data_persistence',
      'nfrs',
      'target_architecture',
    ])

    // Determine max change-freeze periods for dynamic columns
    let maxFreezePeriods = 0
    for (const project of projects) {
      const count = project.migrationConstraints?.changeFreezePeriods?.length ?? 0
      if (count > maxFreezePeriods) maxFreezePeriods = count
    }

    const baseHeaders = [
      'Project ID',
      'Project Name',
      'BGI L2',
      'BGI L3',
      'BGI L4',
      'Status',
      'Blocked Reason',
      'Description',
      'Migration Wave',
      'Jira Story Key',
      'Survey Submitted At',
      'Data Migration Survey Submitted At',
      'ITSO',
      'ITSO Email',
      'ITSO Delegate',
      'ITSO Delegate Email',
      'Application Name',
      'Short Name',
      'Business Function',
      'User Base Type',
      'User Base Count',
      'Application Tier',
      'BA ID',
      'IBS',
      'BPS',
      'IITA Applicability',
      'Software Origin',
      'Migration Strategy',
      'Service Line',
      'Technical Lead Name',
      'Technical Lead Email',
      'Business Owner Name',
      'Business Owner Email',
      'DBA Data Owner Name',
      'DBA Data Owner Email',
      'RTO',
      'RPO',
      '3-AZ Readiness',
      'Health Check Endpoints',
      'Database Types',
      'Total Data Volume',
      'Data Growth Rate',
      'Backup Required During Migration',
      'Last Restore Test',
      'Data Residency',
      'Encryption At Rest',
      'Stateful Components',
      'Peak Load',
      'Autoscaling',
      'Licensing',
      'Regular Migration Window',
      'Preferred Migration Window',
      'Earliest Start Date',
      'Latest End Date',
      'CR Duration (hours)',
      'SNOW CI Groups',
      'Re-Architecture Needed',
      '3-AZ Topology',
      'DNS / IP Changes',
      'New Services Required',
      'Architecture Diagram',
    ]

    const freezeHeaders: string[] = []
    for (let i = 1; i <= maxFreezePeriods; i++) {
      freezeHeaders.push(`Change Freeze ${i} Name`, `Change Freeze ${i} From`, `Change Freeze ${i} To`)
    }

    const headers = [...baseHeaders, ...freezeHeaders]

    const bgiRoot = await getBgiHierarchy().catch(() => null)

    const rows: Record<string, string | number>[] = []

    for (const project of projects) {
      const ao = project.applicationOverview
      const gr = project.governanceRoles
      const av = project.availability
      const dp = project.dataPersistence
      const nfr = project.nfrs
      const mc = project.migrationConstraints
      const ta = project.targetArchitecture

      const bgiAncestry = bgiRoot && project.bgi_id ? getBgiAncestry(bgiRoot, project.bgi_id) : null
      const row: Record<string, string | number> = {
        'Project ID': project.id,
        'Project Name': project.name,
        'BGI L2': bgiAncestry?.l2 ?? '',
        'BGI L3': bgiAncestry?.l3 ?? '',
        'BGI L4': bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName ?? project.bgi_id ?? '') : (project.bgi_id ?? ''),
        'Status': project.status,
        'Blocked Reason': project.blockedReason ?? '',
        'Description': project.description ?? '',
        'Migration Wave': project.migrationWave ?? '',
        'Jira Story Key': project.jiraStoryKey ?? '',
        'Survey Submitted At': project.surveySubmittedAt ? formatDate(project.surveySubmittedAt) : '',
        'Data Migration Survey Submitted At': project.dataMigrationSurveySubmittedAt ? formatDate(project.dataMigrationSurveySubmittedAt) : '',
        'ITSO': project.itso ?? '',
        'ITSO Email': project.itsoEmail ?? '',
        'ITSO Delegate': project.itsoDelegate ?? '',
        'ITSO Delegate Email': project.itsoDelegateEmail ?? '',
        'Application Name': ao?.applicationName ?? '',
        'Short Name': ao?.shortName ?? '',
        'Business Function': ao?.businessFunction ?? '',
        'User Base Type': ao?.userBase?.type ?? '',
        'User Base Count': ao?.userBase?.count ?? '',
        'Application Tier': ao?.applicationTier ?? '',
        'BA ID': ao?.baId ?? '',
        'IBS': ao?.systemImportanceClassification?.includes('IBS') ? 'Yes' : 'No',
        'BPS': ao?.systemImportanceClassification?.includes('BPS') ? 'Yes' : 'No',
        'IITA Applicability': ao?.iitaApplicability ? 'Yes' : 'No',
        'Software Origin': ao?.softwareOrigin ?? '',
        'Migration Strategy': ao?.migrationStrategy ?? '',
        'Service Line': ao?.serviceLine ?? '',
        'Technical Lead Name': gr?.technicalLead?.name ?? '',
        'Technical Lead Email': gr?.technicalLead?.email ?? '',
        'Business Owner Name': gr?.businessOwner?.name ?? '',
        'Business Owner Email': gr?.businessOwner?.email ?? '',
        'DBA Data Owner Name': gr?.dbaDataOwner?.name ?? '',
        'DBA Data Owner Email': gr?.dbaDataOwner?.email ?? '',
        'RTO': av?.rto ?? '',
        'RPO': av?.rpo ?? '',
        '3-AZ Readiness': av?.azReadiness3Az ?? '',
        'Health Check Endpoints': (av?.healthCheckEndpoints ?? []).join(', '),
        'Database Types': (dp?.databaseTypes ?? []).join(', '),
        'Total Data Volume': dp?.totalDataVolume ?? '',
        'Data Growth Rate': dp?.dataGrowthRate ?? '',
        'Backup Required During Migration': dp?.backupRequiredDuringMigration ? 'Yes' : 'No',
        'Last Restore Test': dp?.lastRestoreTest ?? '',
        'Data Residency': dp?.dataResidency ?? '',
        'Encryption At Rest': dp?.encryptionAtRest ?? '',
        'Stateful Components': (dp?.statefulComponents ?? []).join(', '),
        'Peak Load': nfr?.peakLoad ?? '',
        'Autoscaling': nfr?.autoscaling ?? '',
        'Licensing': nfr?.licensing ?? '',
        'Regular Migration Window': mc?.regularMigrationWindow ?? '',
        'Preferred Migration Window': (mc?.preferredMigrationWindow ?? []).join(', '),
        'Earliest Start Date': mc?.earliestStartDate ?? '',
        'Latest End Date': mc?.latestEndDate ?? '',
        'CR Duration (hours)': mc?.crDurationHours ?? '',
        'SNOW CI Groups': (mc?.snowCiGroups ?? []).join(', '),
        'Re-Architecture Needed': ta?.reArchitectureNeeded ? 'Yes' : 'No',
        '3-AZ Topology': ta?.topology3Az ?? '',
        'DNS / IP Changes': ta?.dnsIpChanges ?? '',
        'New Services Required': (ta?.newServicesRequired ?? []).join(', '),
        'Architecture Diagram': ta?.architectureDiagram ?? '',
      }

      const freezePeriods = mc?.changeFreezePeriods ?? []
      for (let i = 0; i < maxFreezePeriods; i++) {
        const fp = freezePeriods[i]
        const idx = i + 1
        row[`Change Freeze ${idx} Name`] = fp?.name ?? ''
        row[`Change Freeze ${idx} From`] = fp?.from ?? ''
        row[`Change Freeze ${idx} To`] = fp?.to ?? ''
      }

      rows.push(row)
    }

    if (rows.length === 0) {
      toast.info('No project data found.', { id: toastId })
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)

    const lastRow = rows.length + 1
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }

    worksheet['!cols'] = headers.map(h => {
      if (h.startsWith('Change Freeze')) return { wch: 18 }
      if (h === 'Project Name') return { wch: 28 }
      if (h === 'Description') return { wch: 36 }
      if (h === 'Blocked Reason') return { wch: 28 }
      if (h === 'Application Name') return { wch: 28 }
      if (h === 'Business Function') return { wch: 24 }
      if (h === 'Migration Strategy') return { wch: 18 }
      if (h === 'Service Line') return { wch: 24 }
      if (h === 'Health Check Endpoints') return { wch: 28 }
      if (h === 'Last Restore Test') return { wch: 28 }
      if (h === 'Architecture Diagram') return { wch: 28 }
      if (h === 'Regular Migration Window') return { wch: 24 }
      if (h === 'Preferred Migration Window') return { wch: 24 }
      if (h === 'SNOW CI Groups') return { wch: 24 }
      if (h === 'New Services Required') return { wch: 28 }
      if (h === 'DNS / IP Changes') return { wch: 24 }
      if (h.endsWith('Email')) return { wch: 28 }
      if (h.endsWith('Name')) return { wch: 24 }
      return { wch: 14 }
    })

    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Details')

    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'ProjectDetailsData',
        Ref: `'Project Details'!$A$1:$${lastCol}$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `project-details-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
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

export async function exportProjectRisksAndBlockersReport() {
  const toastId = toast.loading('Generating project risks & blockers report...')

  try {
    const [projects, bgiRoot] = await Promise.all([
      getProjects(['basic', 'risks']),
      getBgiHierarchy().catch(() => null),
    ])

    const rows: Record<string, string | number>[] = []
    for (const project of projects) {
      const bgiAncestry = bgiRoot && project.bgi_id ? getBgiAncestry(bgiRoot, project.bgi_id) : null
      const bgiL2 = bgiAncestry?.l2 ?? ''
      const bgiL3 = bgiAncestry?.l3 ?? ''
      const bgiL4 = bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName ?? project.bgi_id ?? '') : (project.bgi_id ?? '')
      const risks = project.risks ?? []
      if (risks.length === 0) {
        rows.push({
          'Project ID': project.id,
          'Project Name': project.name,
          'BGI L2': bgiL2,
          'BGI L3': bgiL3,
          'BGI L4': bgiL4,
          'Risk Title': '—',
          'Risk Description': '—',
          'Severity': '—',
          'Mitigation': '—',
          'Owner': '—',
          'Risk Status': '—',
        })
      } else {
        for (const risk of risks) {
          rows.push({
            'Project ID': project.id,
            'Project Name': project.name,
            'BGI L2': bgiL2,
            'BGI L3': bgiL3,
            'BGI L4': bgiL4,
            'Risk Title': risk.title,
            'Risk Description': risk.description,
            'Severity': risk.severity,
            'Mitigation': risk.mitigation ?? '',
            'Owner': risk.owner ?? '',
            'Risk Status': risk.riskStatus ?? '',
          })
        }
      }
    }

    if (rows.length === 0) {
      toast.info('No risk data found across projects.', { id: toastId })
      return
    }

    const headers = [
      'Project ID',
      'Project Name',
      'BGI L2',
      'BGI L3',
      'BGI L4',
      'Risk Title',
      'Risk Description',
      'Severity',
      'Mitigation',
      'Owner',
      'Risk Status',
    ]

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const lastRow = rows.length
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 },
      { wch: 32 }, { wch: 40 }, { wch: 10 }, { wch: 32 }, { wch: 20 }, { wch: 12 },
    ]
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Risks')

    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'RisksData',
        Ref: `'Risks'!$A$1:$${lastCol}$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `project-risks-blockers-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export async function exportProjectEngagementReport() {
  const toastId = toast.loading('Generating project engagement report...')

  try {
    const projects = await getProjects(['basic', 'engagement'])

    const rows: Record<string, string>[] = projects.map(project => ({
      'Project ID': project.id,
      'Project Name': project.name,
      'Engagement Status': getEngagementStatusLabel(project.engagement?.status),
    }))

    if (rows.length === 0) {
      toast.info('No project engagement data found.', { id: toastId })
      return
    }

    const headers = ['Project ID', 'Project Name', 'Engagement Status']

    const worksheet = XLSX.utils.json_to_sheet(rows)

    const lastRow = rows.length + 1
    const lastCol = XLSX.utils.encode_col(headers.length - 1)
    worksheet['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }
    worksheet['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 22 }]
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Engagement')

    workbook.Workbook = workbook.Workbook || {}
    workbook.Workbook.Names = [
      {
        Name: 'ProjectEngagementData',
        Ref: `'Project Engagement'!$A$1:$${lastCol}$${lastRow}`,
        Sheet: 0,
      },
    ]

    XLSX.writeFile(workbook, `project-engagement-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}

export function exportProjectsToExcel(projects: Project[], draftProjectIds: string[], bgiRoot?: BgiNode | null) {
  const toastId = toast.loading('Generating projects report...')

  try {
    const rows = projects.map((p) => {
      const { start, end } = getMigrationDates(p)
      const days = getMigrationPeriodDays(p)
      const period = !start && !end ? '—' : `${formatDate(start)} → ${formatDate(end)}${days !== null ? ` (${days} days)` : ''}`
      const { totalCost } = getMigrationEffortSummary(p)
      const bgiAncestry = bgiRoot && p.bgi_id ? getBgiAncestry(bgiRoot, p.bgi_id) : null
      return {
        'Name': p.name,
        'ID': p.id,
        'New Project ID': p.applicationOverview?.newProjectId ?? '—',
        'Application Name': p.applicationOverview?.applicationName ?? '—',
        'BGI L2': bgiAncestry?.l2 ?? '—',
        'BGI L3': bgiAncestry?.l3 ?? '—',
        'BGI L4': bgiAncestry ? (bgiAncestry.l4 ?? bgiAncestry.leafName) : (p.bgi_id ?? '—'),
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
        'Survey Submitted At': p.surveySubmittedAt ? formatDate(p.surveySubmittedAt) : '—',
        'Data Migration Survey Submitted At': p.dataMigrationSurveySubmittedAt ? formatDate(p.dataMigrationSurveySubmittedAt) : '—',
        'Migration Story': p.jiraStoryKey ?? '—',
      }
    })

    if (rows.length === 0) {
      toast.info('No projects to export.', { id: toastId })
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 },
      { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 36 }, { wch: 18 },
      { wch: 24 }, { wch: 32 }, { wch: 14 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects')
    XLSX.writeFile(workbook, `projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success('Report downloaded', { id: toastId })
  } catch {
    toast.error('Failed to generate report', { id: toastId })
  }
}
