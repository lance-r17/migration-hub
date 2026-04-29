import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { BarChart } from '@/components/shared/BarChart'
import { getSignoffCompletionDate } from '@/utils/dates'
import type { OverallStats, Project } from '@/types'
import type { Wave } from '@/types/wave'

interface OverallProgressCardProps {
  stats: OverallStats
  projects: Project[]
  waves: Wave[]
}

const ACTIVITY_COLORS: Record<string, string> = {
  survey: '#8B5CF6',
  signoff: '#F59E0B',
  migration: '#10B981',
}

function getMigrationWindow(project: Project, waveMap: Map<string, Wave>): { start: Date; end: Date } | null {
  // 1. Planned dates (highest priority)
  if (project.planning?.startDate && project.planning?.endDate) {
    const start = new Date(project.planning.startDate)
    const end = new Date(project.planning.endDate)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start, end }
    }
  }

  // 2. Estimated migration constraints
  if (project.migrationConstraints?.earliestStartDate && project.migrationConstraints?.latestEndDate) {
    const start = new Date(project.migrationConstraints.earliestStartDate)
    const end = new Date(project.migrationConstraints.latestEndDate)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start, end }
    }
  }

  // 3. Wave dates (fallback)
  if (project.waveId) {
    const wave = waveMap.get(project.waveId)
    if (wave?.startDate && wave?.cutoverDate) {
      const start = new Date(wave.startDate)
      const end = new Date(wave.cutoverDate)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end }
      }
    }
  }
  return null
}

function isDateInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  // Use UTC to avoid timezone shifting the date across month boundaries
  return d.getUTCFullYear() === year && d.getUTCMonth() === month
}

function monthOverlaps(
  year: number,
  month: number,
  startStr: string,
  endStr: string,
): boolean {
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false

  const monthStart = Date.UTC(year, month, 1)
  const monthEnd = Date.UTC(year, month + 1, 0, 23, 59, 59, 999)
  const s = start.getTime()
  const e = end.getTime()

  return s <= monthEnd && e >= monthStart
}

function getMonthlyMigrationActivity(projects: Project[], waves: Wave[]) {
  const waveMap = new Map(waves.map((w) => [w.id, w]))
  const months: {
    label: string
    value: number
    segments: { label: string; value: number; color: string }[]
  }[] = []

  for (let year = 2026; year <= 2027; year++) {
    for (let month = 0; month < 12; month++) {
      let survey = 0
      let signoff = 0
      let migration = 0

      for (const project of projects) {
        // Survey: shown in the month it was submitted (UTC)
        if (project.surveySubmittedAt) {
          if (isDateInMonth(project.surveySubmittedAt, year, month)) {
            survey++
          }
        }

        // Signoff: shown in the month it was completed (UTC)
        const signoffDate = getSignoffCompletionDate(project)
        if (signoffDate) {
          if (
            signoffDate.getUTCFullYear() === year &&
            signoffDate.getUTCMonth() === month
          ) {
            signoff++
          }
        }

        // Migration: shown across every month overlapping the planned window (UTC)
        const migWindow = getMigrationWindow(project, waveMap)
        if (
          migWindow &&
          monthOverlaps(year, month, migWindow.start.toISOString(), migWindow.end.toISOString())
        ) {
          migration++
        }
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const label = `${monthNames[month]} '${year.toString().slice(-2)}`

      const segments: { label: string; value: number; color: string }[] = []
      if (survey > 0) segments.push({ label: 'Survey', value: survey, color: ACTIVITY_COLORS.survey })
      if (signoff > 0) segments.push({ label: 'Signoff', value: signoff, color: ACTIVITY_COLORS.signoff })
      if (migration > 0) segments.push({ label: 'Migration', value: migration, color: ACTIVITY_COLORS.migration })

      months.push({
        label,
        value: survey + signoff + migration,
        segments,
      })
    }
  }

  return months
}

export function OverallProgressCard({ stats, projects, waves }: OverallProgressCardProps) {
  const monthlyData = getMonthlyMigrationActivity(projects, waves)
  const maxValue = Math.max(...monthlyData.map((d) => d.value), 1)

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Overall Migration Progress</CardTitle>
            <CardDescription>Track your cloud migration journey</CardDescription>
          </div>
          <CardTitle className="text-3xl">{stats.progress}%</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ProgressBar value={stats.progress} variant="primary" height="h-3" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Migration Activity
          </div>
          <div className="overflow-x-auto pb-2">
            <BarChart
              data={monthlyData}
              maxValue={maxValue}
              barWidth={56}
              gap={16}
              height={160}
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            {Object.entries(ACTIVITY_COLORS).map(([activity, color]) => (
              <div key={activity} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground capitalize">{activity}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
