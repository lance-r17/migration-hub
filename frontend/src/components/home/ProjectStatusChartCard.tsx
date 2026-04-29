import { useMemo } from 'react'
import { PieChart as PieChartIcon, ClipboardCheck, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PieChart } from '@/components/shared/PieChart'
import { getProjectStage, STAGE_META } from '@/lib/project-stages'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import type { Project } from '@/types'

interface ProjectStatusChartCardProps {
  projects: Project[]
}

const CATEGORY_COLORS: Record<string, string> = {
  computing: '#3B82F6',
  security: '#F43F5E',
  networking: '#8B5CF6',
  database: '#10B981',
  storage: '#F59E0B',
  middleware: '#06B6D4',
  'analytics-computing': '#EC4899',
  monitoring: '#6366F1',
}

export function ProjectStatusChartCard({ projects }: ProjectStatusChartCardProps) {
  const { getCategoryForProduct } = useProductCategoryMap()

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

  const assetData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const project of projects) {
      for (const resource of project.currentInfrastructure?.resources ?? []) {
        const cat = getCategoryForProduct(resource.product)
        counts[cat] = (counts[cat] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value]) => ({
        label: category
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        value,
        color: CATEGORY_COLORS[category] ?? '#94a3b8',
      }))
  }, [projects, getCategoryForProduct])

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
              <PieChartIcon size={14} />
              Stages
            </TabsTrigger>
            <TabsTrigger value="surveys" className="flex-1 gap-1.5">
              <ClipboardCheck size={14} />
              Surveys
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex-1 gap-1.5">
              <Database size={14} />
              Assets
            </TabsTrigger>
          </TabsList>
          <TabsContent value="stages" className="flex flex-col gap-2">
            <div className="w-full flex justify-center">
              {stageData.length > 0 ? (
                <PieChart data={stageData} size={180} />
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  No project data available
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Distribution of projects across migration stages
            </p>
          </TabsContent>
          <TabsContent value="surveys" className="flex flex-col gap-2">
            <div className="w-full flex justify-center">
              {surveyData.length > 0 ? (
                <PieChart data={surveyData} size={180} />
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  No project data available
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Projects that have submitted their migration surveys
            </p>
          </TabsContent>
          <TabsContent value="assets" className="flex flex-col gap-2">
            <div className="w-full flex justify-center">
              {assetData.length > 0 ? (
                <PieChart data={assetData} size={180} />
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  No asset data available
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Breakdown of cloud resources by resource category
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
