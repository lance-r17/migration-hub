import { useMemo } from 'react'
import { BarChart3, ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PieChart } from '@/components/shared/PieChart'
import { getProjectStage, STAGE_META } from '@/lib/project-stages'
import type { Project } from '@/types'

interface ProjectStatusChartCardProps {
  projects: Project[]
}

export function ProjectStatusChartCard({ projects }: ProjectStatusChartCardProps) {
  const stageData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const project of projects) {
      const stage = getProjectStage(project)
      counts.set(stage, (counts.get(stage) ?? 0) + 1)
    }
    return STAGE_META.map((meta) => ({
      label: meta.label,
      value: counts.get(meta.key) ?? 0,
      color: meta.colorVar,
    })).filter((d) => d.value > 0)
  }, [projects])

  const surveyData = useMemo(() => {
    const submitted = projects.filter(
      (p) => (p.stageProgress?.survey ?? 0) === 100 || !!p.surveySubmittedAt,
    ).length
    const notSubmitted = projects.length - submitted
    return [
      {
        label: 'Submitted',
        value: submitted,
        color: 'var(--chart-2)',
      },
      {
        label: 'Not Submitted',
        value: notSubmitted,
        color: 'var(--chart-4)',
      },
    ].filter((d) => d.value > 0)
  }, [projects])

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Project Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stages">
          <TabsList variant="line" className="mb-4 w-full">
            <TabsTrigger value="stages" className="flex-1 gap-1.5">
              <BarChart3 size={14} />
              Stages
            </TabsTrigger>
            <TabsTrigger value="surveys" className="flex-1 gap-1.5">
              <ClipboardCheck size={14} />
              Surveys
            </TabsTrigger>
          </TabsList>
          <TabsContent value="stages" className="flex items-center justify-center">
            {stageData.length > 0 ? (
              <PieChart data={stageData} size={180} />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                No project data available
              </div>
            )}
          </TabsContent>
          <TabsContent value="surveys" className="flex items-center justify-center">
            {surveyData.length > 0 ? (
              <PieChart data={surveyData} size={180} />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                No project data available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
