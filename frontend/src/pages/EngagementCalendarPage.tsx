import { useState, useMemo, useEffect } from 'react'
import { CalendarDays, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { MonthCalendar } from '@/components/engagement/MonthCalendar'
import { EngagementDrawer } from '@/components/engagement/EngagementDrawer'
import { AppShell } from '@/components/layout/AppShell'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { apiClient } from '@/services/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Project, User, Engagement } from '@/types'

function generateSlotId() {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildDefaultEngagement(date: Date, project: Project, startHour?: number | null): Engagement {
  const start = new Date(date)
  start.setHours(startHour ?? 10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(start.getHours() + 1, 0, 0, 0)
  const baId = project.applicationOverview?.baId
  const subject = baId
    ? `Migration Solution Review - ${project.id} - ${baId}`
    : `Migration Solution Review - ${project.id}`
  return {
    status: 'pending',
    interviewSubject: subject,
    plannedSlots: [{ id: generateSlotId(), start: start.toISOString(), end: end.toISOString(), isActual: true }],
    participantIds: [],
  }
}

export function EngagementCalendarPage() {
  const { user } = useCurrentUser()
  const { projects, loading, refresh } = useProjects({ fields: ['basic', 'engagement', 'team'] })
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [createDate, setCreateDate] = useState<Date | null>(null)
  const [createHour, setCreateHour] = useState<number | null>(null)
  const [createProjectId, setCreateProjectId] = useState<string>('')
  const [projectSearch, setProjectSearch] = useState('')
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [statusFilters, setStatusFilters] = useState<Engagement['status'][]>(['pending', 'scheduled', 'completed', 'cancelled', 'no_show'])

  // Fetch all users for participant/manager selection
  useEffect(() => {
    apiClient.get<User[]>('/api/v1/users').then(setAllUsers).catch(() => {})
  }, [])

  const projectsWithEngagement = useMemo(() => {
    return projects.filter(p => !!p.engagement)
  }, [projects])

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setDrawerOpen(true)
  }

  const handleSave = async (updatedProject: Project) => {
    try {
      await apiClient.patch(`/api/v1/projects/${updatedProject.id}/sections/engagement`, {
        value: updatedProject.engagement,
      })
      toast.success('Engagement saved')
      setDrawerOpen(false)
      setCreateDate(null)
      setCreateProjectId('')
      refresh()
    } catch {
      toast.error('Failed to save engagement')
    }
  }

  const handleSelectDate = (date: Date) => {
    setCreateDate(date)
    setCreateHour(null)
    setCreateProjectId('')
    setProjectSearch('')
  }

  const handleSelectDateTime = (date: Date, hour: number) => {
    setCreateDate(date)
    setCreateHour(hour)
    setCreateProjectId('')
    setProjectSearch('')
  }

  const handleCreateEngagement = () => {
    if (!createDate || !createProjectId) return
    const project = projects.find(p => p.id === createProjectId)
    if (!project) return
    const updated: Project = {
      ...project,
      engagement: buildDefaultEngagement(createDate, project, createHour),
    }
    setSelectedProject(updated)
    setDrawerOpen(true)
    setCreateDate(null)
    setCreateProjectId('')
    setProjectSearch('')
  }

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [projects, projectSearch])

  const selectedProjectName = useMemo(() => {
    return projects.find(p => p.id === createProjectId)?.name
  }, [projects, createProjectId])

  const selectedProjectHasEngagement = useMemo(() => {
    return projects.find(p => p.id === createProjectId)?.engagement != null
  }, [projects, createProjectId])

  const handleEditEngagement = (project: Project) => {
    setSelectedProject(project)
    setDrawerOpen(true)
    setCreateDate(null)
    setCreateProjectId('')
    setProjectPickerOpen(false)
  }

  const handleUpdateEngagement = async (project: Project, engagement: Engagement) => {
    try {
      await apiClient.patch(`/api/v1/projects/${project.id}/sections/engagement`, {
        value: engagement,
      })
      toast.success('Engagement updated')
      refresh()
    } catch {
      toast.error('Failed to update engagement')
    }
  }

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false

  return (
    <AppShell title="Engagement Calendar">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Engagement Calendar</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Schedule and manage migration interviews across all projects.
            </p>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading projects...
          </div>
        ) : (
          <MonthCalendar
            anchorDate={anchorDate}
            onAnchorChange={setAnchorDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            projects={projectsWithEngagement}
            onSelectProject={handleSelectProject}
            onSelectDate={handleSelectDate}
            onSelectDateTime={handleSelectDateTime}
            canCreate={isPlatformLead}
            statusFilters={statusFilters}
            onToggleStatus={status => {
              setStatusFilters(prev =>
                prev.includes(status)
                  ? prev.filter(s => s !== status)
                  : [...prev, status]
              )
            }}
            onUpdateEngagement={handleUpdateEngagement}
          />
        )}
      </div>

      {/* Create Engagement Dialog */}
      <Dialog open={!!createDate} onOpenChange={open => { if (!open) { setCreateDate(null); setCreateHour(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Engagement</DialogTitle>
            <DialogDescription>
              Select a project to schedule an engagement for {createDate ? createDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}.
            </DialogDescription>
          </DialogHeader>
          <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={projectPickerOpen}
                className="w-full justify-between font-normal"
              >
                {selectedProjectName ?? 'Select a project...'}
                <span className="text-muted-foreground ml-2">▼</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 max-h-[300px] overflow-hidden flex flex-col" side="bottom" sideOffset={4}>
              <Input
                placeholder="Search by project ID or name..."
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                className="mb-2 bg-background"
              />
              <div className="overflow-y-auto space-y-0.5">
                {filteredProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-3 text-center">
                    No projects found.
                  </p>
                ) : (
                  filteredProjects.map(p => {
                    const hasEngagement = !!p.engagement
                    const isSelected = createProjectId === p.id
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-md transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary'
                            : hasEngagement
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-muted cursor-pointer'
                        }`}
                      >
                        <button
                          className="flex-1 text-left text-sm min-w-0"
                          onClick={() => {
                            if (hasEngagement) return
                            setCreateProjectId(p.id)
                            setProjectPickerOpen(false)
                          }}
                          disabled={hasEngagement}
                        >
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{p.id}</div>
                        </button>
                        {hasEngagement && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-primary shrink-0"
                            title="Edit engagement"
                            onClick={() => handleEditEngagement(p)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDate(null); setCreateHour(null) }}>Cancel</Button>
            <Button
              onClick={handleCreateEngagement}
              disabled={!createProjectId || selectedProjectHasEngagement}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EngagementDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        project={selectedProject}
        allUsers={allUsers}
        onSave={handleSave}
        readOnly={!isPlatformLead}
      />
    </AppShell>
  )
}
