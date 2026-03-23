import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ProgressBar } from '@/components/shared/ProgressBar'
import type { OverallStats } from '@/types'

interface OverallProgressCardProps {
  stats: OverallStats
}

export function OverallProgressCard({ stats }: OverallProgressCardProps) {
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
      </CardContent>
    </Card>
  )
}
