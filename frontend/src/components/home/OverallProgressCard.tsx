import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { BarChart } from '@/components/shared/BarChart'
import type { OverallStats, Project } from '@/types'
import type { Wave } from '@/types/wave'

interface OverallProgressCardProps {
  stats: OverallStats
  projects: Project[]
  waves: Wave[]
}

function getMonthlyMigrationActivity(projects: Project[], waves: Wave[]) {
  const waveMap = new Map(waves.map((w) => [w.id, w]))
  const months: { label: string; value: number }[] = []

  for (let year = 2026; year <= 2027; year++) {
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)

      let count = 0
      for (const project of projects) {
        if (!project.waveId) continue
        const wave = waveMap.get(project.waveId)
        if (!wave?.startDate || !wave?.cutoverDate) continue

        const waveStart = new Date(wave.startDate)
        const waveEnd = new Date(wave.cutoverDate)

        if (waveStart <= monthEnd && waveEnd >= monthStart) {
          count++
        }
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const label = `${monthNames[month]} '${year.toString().slice(-2)}`
      months.push({ label, value: count })
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
        <div className="flex gap-8">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Total Assets</div>
            <div className="text-xl font-medium text-foreground">{stats.totalAssets.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Target Cloud</div>
            <div className="text-xl font-medium text-foreground">{stats.targetCloud}</div>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Migration Activity
          </div>
          <div className="overflow-x-auto pb-2">
            <BarChart
              data={monthlyData}
              maxValue={maxValue}
              barWidth={32}
              gap={10}
              height={140}
              barColor="var(--primary)"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
