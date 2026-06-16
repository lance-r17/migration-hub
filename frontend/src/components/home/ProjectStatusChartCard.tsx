import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { PieChart as PieChartIcon, ClipboardCheck, Database, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { getAssetStats } from '@/services/projects'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PieChart } from '@/components/shared/PieChart'
import { getProjectStage, STAGE_META } from '@/lib/project-stages'
import type { Project } from '@/types'

const ENGAGEMENT_STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'pending',   label: 'Pending',    color: '#F59E0B' },
  { key: 'scheduled', label: 'Scheduled',  color: '#3B82F6' },
  { key: 'waiting_confirmation', label: 'Waiting Confirmation', color: '#8B5CF6' },
  { key: 'completed', label: 'Completed',  color: '#10B981' },
  { key: 'cancelled', label: 'Cancelled',  color: '#EF4444' },
  { key: 'no_show',   label: 'No Show',    color: '#94A3B8' },
  { key: 'no_demand', label: 'No Demand',  color: '#9CA3AF' },
  { key: 'none',      label: 'Not Started',color: '#CBD5E1' },
]

interface ProjectStatusChartCardProps {
  projects: Project[]
  draftProjectIds?: string[]
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

export function ProjectStatusChartCard({ projects, draftProjectIds = [] }: ProjectStatusChartCardProps) {
  const [assetStats, setAssetStats] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    getAssetStats()
      .then(data => { if (!cancelled) setAssetStats(data) })
      .catch(() => { if (!cancelled) setAssetStats({}) })
    return () => { cancelled = true }
  }, [])

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

  const engagementData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const project of projects) {
      const key = project.engagement?.status ?? 'none'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return ENGAGEMENT_STATUS_META
      .map(meta => ({ label: meta.label, value: counts.get(meta.key) ?? 0, color: meta.color }))
      .filter(d => d.value > 0)
  }, [projects])

  const draftIdSet = useMemo(() => new Set(draftProjectIds), [draftProjectIds])

  const applicationSurveyData = useMemo(() => {
    const submitted = projects.filter(
      (p) => (p.stageProgress?.survey ?? 0) === 100 || !!p.surveySubmittedAt,
    ).length
    const draft = projects.filter(
      (p) => !((p.stageProgress?.survey ?? 0) === 100 || !!p.surveySubmittedAt) && draftIdSet.has(p.id),
    ).length
    const notSubmitted = projects.length - submitted - draft
    return [
      {
        label: 'Submitted',
        value: submitted,
        color: 'var(--chart-2)',
      },
      {
        label: 'Draft',
        value: draft,
        color: 'var(--chart-3)',
      },
      {
        label: 'Not Submitted',
        value: notSubmitted,
        color: 'var(--chart-4)',
      },
    ].filter((d) => d.value > 0)
  }, [projects, draftIdSet])

  const dataMigrationSurveyData = useMemo(() => {
    const submitted = projects.filter(
      (p) => !!p.dataMigrationSurveySubmittedAt,
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

  const SURVEY_PAGES = [
    { key: 'application', label: 'Application Survey', data: applicationSurveyData, caption: 'Projects that have submitted their application surveys' },
    { key: 'data_migration', label: 'Data Migration Survey', data: dataMigrationSurveyData, caption: 'Projects that have submitted their data migration surveys' },
  ]

  const [surveyPage, setSurveyPage] = useState(0)
  const [direction, setDirection] = useState(0)
  const surveyAreaRef = useRef<HTMLDivElement>(null)
  const isThrottled = useRef(false)
  const pendingDirection = useRef<number | null>(null)

  const goToPage = useCallback((idx: number) => {
    if (idx === surveyPage) return
    setDirection(idx > surveyPage ? 1 : -1)
    setSurveyPage(idx)
  }, [surveyPage])

  const runPageChange = useCallback((delta: number) => {
    const next = (surveyPage + delta + SURVEY_PAGES.length) % SURVEY_PAGES.length
    goToPage(next)
  }, [goToPage, surveyPage, SURVEY_PAGES.length])

  const schedulePageChange = useCallback((delta: number) => {
    if (isThrottled.current) {
      pendingDirection.current = delta
      return
    }

    runPageChange(delta)

    isThrottled.current = true
    window.setTimeout(() => {
      isThrottled.current = false
      const queued = pendingDirection.current
      pendingDirection.current = null
      if (queued !== null) {
        runPageChange(queued)
      }
    }, 400)
  }, [runPageChange])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const delta = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
    if (delta === 0) return

    schedulePageChange(delta)
  }, [schedulePageChange])

  const handleSurveyPageChange = (idx: number) => {
    pendingDirection.current = null
    isThrottled.current = false
    goToPage(idx)
  }

  const slideVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? 28 : -28,
      opacity: 0,
      scale: 0.96,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      y: dir > 0 ? -28 : 28,
      opacity: 0,
      scale: 0.96,
    }),
  }

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
            <TabsTrigger value="engagement" className="flex-1 gap-1.5">
              <Users size={14} />
              Engagement
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
          <TabsContent value="surveys" className="flex flex-row items-center gap-4 overflow-hidden">
            <div
              ref={surveyAreaRef}
              onWheel={handleWheel}
              className="flex-1 flex flex-col gap-2 relative min-h-[244px] cursor-ns-resize"
            >
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={SURVEY_PAGES[surveyPage].key}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex flex-col gap-2"
                >
                  <div className="w-full flex justify-center">
                    {SURVEY_PAGES[surveyPage].data.length > 0 ? (
                      <PieChart data={SURVEY_PAGES[surveyPage].data} size={180} title={SURVEY_PAGES[surveyPage].label} />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                        No project data available
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {SURVEY_PAGES[surveyPage].caption}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 self-stretch py-8">
              {SURVEY_PAGES.map((page, idx) => (
                <button
                  key={page.key}
                  type="button"
                  onClick={() => handleSurveyPageChange(idx)}
                  className={cn(
                    'size-2 rounded-full transition-colors',
                    idx === surveyPage ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                  aria-label={`Show ${page.label}`}
                  aria-current={idx === surveyPage ? 'true' : undefined}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="engagement" className="flex flex-col gap-2">
            <div className="w-full flex justify-center">
              {engagementData.length > 0 ? (
                <PieChart data={engagementData} size={180} />
              ) : (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  No engagement data available
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Distribution of project engagement statuses
            </p>
          </TabsContent>
          <TabsContent value="assets" className="flex flex-col gap-2">
            <div className="w-full flex justify-center">
              {assetStats && Object.keys(assetStats).length > 0 ? (
                <PieChart
                  data={Object.entries(assetStats)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, value]) => ({
                      label: category
                        .split('-')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' '),
                      value,
                      color: CATEGORY_COLORS[category] ?? '#94a3b8',
                    }))}
                  size={180}
                />
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
