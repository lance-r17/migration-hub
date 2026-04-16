import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, ArrowUpRight } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { getProject } from '@/services/projects'
import type { Project } from '@/types'

interface Props {
  projectId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <span className="w-36 shrink-0 font-medium pt-0.5">{label}</span>
      <span className="text-foreground">{value ?? <span className="italic text-muted-foreground/50">—</span>}</span>
    </div>
  )
}

export function ProjectPreviewDrawer({ projectId, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !projectId) {
      if (!open) setProject(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setProject(null)
    
    getProject(projectId)
      .then(data => { if (!cancelled) setProject(data ?? null) })
      .catch(() => { if (!cancelled) setError('Failed to load project details.') })
      .finally(() => { if (!cancelled) setLoading(false) })
      
    return () => { cancelled = true }
  }, [projectId, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[760px] sm:!max-w-[760px] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4 pr-12 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {loading ? (
                <Skeleton className="h-5 w-48 rounded mb-2" />
              ) : (
                <button
                  onClick={() => {
                    if (project) {
                      navigate(`/projects/${project.id}`)
                      onOpenChange(false)
                    }
                  }}
                  className="flex items-center gap-2 group/title text-left hover:text-primary transition-colors focus:outline-none min-w-0"
                  disabled={loading || !project}
                >
                  <SheetTitle className="text-base truncate group-hover/title:text-primary transition-colors">
                    {project?.name ?? '…'}
                  </SheetTitle>
                  {project && (
                    <ArrowUpRight size={16} className="shrink-0 text-muted-foreground group-hover/title:text-primary transition-colors" />
                  )}
                </button>
              )}
              <SheetDescription className="mt-1 flex items-center gap-3">
                {loading ? (
                  <Skeleton className="h-4 w-20 rounded-full" />
                ) : project ? (
                  <>
                    <StatusBadge status={project.status} />
                    {project.jiraStoryKey && (
                      <a
                        href={`${project.jiraBaseUrl || ''}/browse/${project.jiraStoryKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary font-mono hover:underline bg-primary/10 px-1.5 py-0.5 rounded"
                      >
                        <ExternalLink className="size-3" />
                        {project.jiraStoryKey}
                      </a>
                    )}
                  </>
                ) : null}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center px-6 py-10">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (projectId) {
                    setLoading(true)
                    setError(null)
                    getProject(projectId)
                      .then(d => setProject(d ?? null))
                      .catch(() => setError('Failed to load project details.'))
                      .finally(() => setLoading(false))
                  }
                }}
              >
                Retry
              </Button>
            </div>
          ) : project ? (
            <div>
              {/* ── Application Overview ── */}
              <div className="border-b bg-muted/50 sticky top-0 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Application Overview
                </p>
              </div>
              <div className="px-5 py-4 space-y-2.5 border-b border-border">
                <FieldRow label="Short Name" value={project.applicationOverview?.shortName} />
                <FieldRow label="Business Function" value={project.applicationOverview?.businessFunction} />
                <FieldRow label="App Tier" value={project.applicationOverview?.applicationTier} />
                <FieldRow label="EIM ID" value={project.applicationOverview?.eimId} />
                <FieldRow
                  label="User Base"
                  value={
                    project.applicationOverview?.userBase
                      ? `${project.applicationOverview.userBase.type}${project.applicationOverview.userBase.count ? ` (${project.applicationOverview.userBase.count})` : ''}`
                      : undefined
                  }
                />
                <FieldRow label="Service Line" value={project.applicationOverview?.serviceLine} />
                <FieldRow label="Migration Strategy" value={project.applicationOverview?.migrationStrategy} />
              </div>

              {/* ── Migration Constraints ── */}
              <div className="border-b bg-muted/50 sticky top-0 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Migration Constraints
                </p>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                <FieldRow
                  label="Maint. Window"
                  value={project.migrationConstraints?.regularMigrationWindow}
                />
                <FieldRow
                  label="Preferred Window"
                  value={
                    project.migrationConstraints?.preferredMigrationWindow?.length
                      ? project.migrationConstraints.preferredMigrationWindow.join(', ')
                      : undefined
                  }
                />
                <FieldRow
                  label="Earliest Start"
                  value={project.migrationConstraints?.earliestStartDate}
                />
                <FieldRow
                  label="Latest End"
                  value={project.migrationConstraints?.latestEndDate}
                />
                <FieldRow
                  label="CR Duration (hrs)"
                  value={project.migrationConstraints?.crDurationHours}
                />
                <FieldRow
                  label="SNOW CI Groups"
                  value={
                    project.migrationConstraints?.snowCiGroups?.length
                      ? project.migrationConstraints.snowCiGroups.join(', ')
                      : undefined
                  }
                />
                <FieldRow
                  label="Freeze Periods"
                  value={
                    project.migrationConstraints?.changeFreezePeriods?.length
                      ? project.migrationConstraints.changeFreezePeriods
                          .map(p => `${p.name ? p.name + ': ' : ''}${p.from}${p.to ? ' → ' + p.to : ''}`)
                          .join('; ')
                      : undefined
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
