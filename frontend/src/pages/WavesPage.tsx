import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Waves, Download, Plus, Lock, GanttChart, Database, Tag, Link, Pencil, Trash2, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { CreateWaveDrawer } from '@/components/drawers/CreateWaveDrawer'
import { ImportWaveDrawer } from '@/components/drawers/ImportWaveDrawer'
import { useWaves } from '@/hooks/use-waves'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { useMigrationSettingsContext } from '@/context/MigrationSettingsContext'
import { EditWaveDrawer } from '@/components/drawers/EditWaveDrawer'
import { CategoryMilestoneDrawer } from '@/components/drawers/CategoryMilestoneDrawer'
import { AssignCategoryMilestoneDrawer } from '@/components/drawers/AssignCategoryMilestoneDrawer'
import { useCategoryMilestones } from '@/hooks/use-category-milestones'
import { updateProject } from '@/services/projects'
import { appendAuditEntryMock } from '@/services/auditLog'
import { USE_MOCK } from '@/services/client'
import { exportWavePlanningToExcel } from '@/lib/export-report'
import type { Wave } from '@/types/wave'
import type { CategoryMilestone } from '@/types/categoryMilestone'
import { CATEGORY_MILESTONE_ICON_MAP } from '@/lib/categoryMilestoneIcons'

function formatDate(iso: string) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[parseInt(month, 10) - 1]} ${year}`
}

export function WavesPage() {
  const { user } = useCurrentUser()
  const { settings } = useMigrationSettingsContext()
  const { waves, loading, createWave, importWave, deleteWave, restoreWave } = useWaves()
  const { projects: initialProjects } = useProjects({ fields: ['basic'] })
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedWave, setSelectedWave] = useState<Wave | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingWave, setDeletingWave] = useState<Wave | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoringWave, setRestoringWave] = useState<Wave | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)

  const [liveWaves, setLiveWaves] = useState(waves)
  const [liveProjects, setLiveProjects] = useState(initialProjects)

  const {
    categoryMilestones,
    loading: cmLoading,
    createCategoryMilestone,
    updateCategoryMilestone,
    deleteCategoryMilestone,
    batchAssign,
    refresh: refreshCM,
  } = useCategoryMilestones()

  const [cmDrawerOpen, setCmDrawerOpen] = useState(false)
  const [editingCM, setEditingCM] = useState<CategoryMilestone | null>(null)
  const [cmSaving, setCmSaving] = useState(false)

  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [assigningCM, setAssigningCM] = useState<CategoryMilestone | null>(null)
  const [assignLoading, setAssignLoading] = useState(false)

  const [cmDeleteDialogOpen, setCmDeleteDialogOpen] = useState(false)
  const [deletingCM, setDeletingCM] = useState<CategoryMilestone | null>(null)
  const [cmDeleteLoading, setCmDeleteLoading] = useState(false)
  
  useEffect(() => {
    setLiveProjects(initialProjects)
  }, [initialProjects])

  useEffect(() => {
    setLiveWaves(waves)
  }, [waves])

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const dataMigrationEnabled = settings?.dataMigrationAdjustmentEnabled ?? true
  
  const sortedWaves = useMemo(() => {
    const source = showDeleted ? liveWaves : liveWaves.filter(w => !w.deleted)
    return [...source].sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate)
      if (startCompare !== 0) return startCompare
      return a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [liveWaves, showDeleted])

  const handleWaveUpdated = useCallback((updated: Wave) => {
    setLiveWaves(prev => prev.map(w => w.id === updated.id ? updated : w))
    setSelectedWave(updated)
  }, [])

  const handleAssign = useCallback(async (projectIds: string[], waveId: string | undefined) => {
    setLiveProjects(prev => prev.map(p =>
      projectIds.includes(p.id) ? { ...p, waveId } : p
    ))
    
    try {
      await Promise.all(projectIds.map(async id => {
        const p = liveProjects.find(x => x.id === id)
        await updateProject(id, 'waveId', waveId)
        
        if (USE_MOCK && p) {
           appendAuditEntryMock({
              id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              projectId: id,
              timestamp: new Date().toISOString(),
              actor: { 
                id: user?.id ?? 'unknown', 
                name: user?.name ?? 'Unknown User', 
                initials: user?.initials ?? '??' 
              },
              eventType: 'wave_assigned',
              entityType: 'wave',
              sectionKey: 'waveId',
              sectionLabel: 'Wave Assignment',
              changes: [{ field: 'waveId', label: 'Wave', oldValue: p.waveId, newValue: waveId }],
           })
        }
      }))
      toast.success(projectIds.length === 1 ? 'Wave assigned' : `${projectIds.length} projects assigned to wave`)
    } catch {
      toast.error('Failed to assign wave. Reverting...')
      setLiveProjects(initialProjects)
    }
  }, [liveProjects, initialProjects, user])

  if (!isPlatformLead) {
    return (
      <AppShell title="Wave Planning">
        <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Waves className="size-5 text-muted-foreground" />
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Wave Planning</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Wave planning tools are only available to the Platform Migration Lead.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="lg" onClick={() => navigate('/waves/gantt')} className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary">
                <GanttChart className="size-4 mr-2" />
                Gantt Chart
              </Button>
              {dataMigrationEnabled && (
                <Button variant="outline" size="lg" onClick={() => navigate('/waves/data-migration')} className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary">
                  <Database className="size-4 mr-2" />
                  Data Migration
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center rounded-lg border border-border bg-muted/20 p-8">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Wave Management Restricted</p>
            <p className="text-muted-foreground text-sm">
              You can view the Gantt Chart{dataMigrationEnabled ? ' and Data Migration pages' : ' page'} above. Wave management is only accessible to the Platform Migration Lead.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  const projectCountByWave = (waveId: string) =>
    liveProjects.filter(p => p.waveId === waveId).length

  const projectCountByCM = (cmId: string) =>
    liveProjects.filter(p => p.categoryMilestoneIds?.includes(cmId)).length

  const handleCreateOrUpdateCM = async (data: Omit<CategoryMilestone, 'id' | 'createdAt'>) => {
    setCmSaving(true)
    try {
      if (editingCM) {
        await updateCategoryMilestone(editingCM.id, data)
        toast.success('Category milestone updated')
      } else {
        await createCategoryMilestone(data)
        toast.success('Category milestone created')
      }
      setCmDrawerOpen(false)
      setEditingCM(null)
    } catch {
      toast.error('Failed to save category milestone')
    } finally {
      setCmSaving(false)
    }
  }

  const handleDeleteCM = async () => {
    if (!deletingCM) return
    setCmDeleteLoading(true)
    try {
      await deleteCategoryMilestone(deletingCM.id)
      toast.success('Category milestone deleted')
    } catch {
      toast.error('Failed to delete category milestone')
    } finally {
      setCmDeleteLoading(false)
      setCmDeleteDialogOpen(false)
      setDeletingCM(null)
    }
  }

  const handleOpenAssign = (cm: CategoryMilestone) => {
    setAssigningCM(cm)
    setAssignDrawerOpen(true)
  }

  const handleBatchAssign = async (cmId: string, projectIds: string[], unassign: boolean) => {
    setAssignLoading(true)
    try {
      await batchAssign(cmId, projectIds, unassign)
      // Optimistically update local project state
      setLiveProjects(prev => prev.map(p => {
        if (!projectIds.includes(p.id)) return p
        const ids = new Set(p.categoryMilestoneIds ?? [])
        if (unassign) ids.delete(cmId)
        else ids.add(cmId)
        return { ...p, categoryMilestoneIds: Array.from(ids) }
      }))
      refreshCM()
    } catch {
      throw new Error('Failed to assign')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleCreated = (wave: Wave) => {
    toast.success(`Wave created`, {
      description: `${wave.name} — Jira epic ${wave.jiraEpicKey} created successfully.`,
    })
  }

  const handleImported = (wave: Wave) => {
    toast.success(`Wave imported`, {
      description: `${wave.name} imported from ${wave.jiraEpicKey}.`,
    })
  }

  const handleDeleteWave = useCallback(async () => {
    if (!deletingWave) return
    setDeleteLoading(true)
    const wave = deletingWave
    const projectIds = liveProjects.filter(p => p.waveId === wave.id).map(p => p.id)

    try {
      await deleteWave(wave.id)
      if (projectIds.length > 0) {
        setLiveProjects(prev => prev.map(p =>
          projectIds.includes(p.id) ? { ...p, waveId: undefined } : p
        ))
        await Promise.all(projectIds.map(id => updateProject(id, 'waveId', undefined)))
        toast.success(projectIds.length === 1 ? '1 project unassigned' : `${projectIds.length} projects unassigned`)
      }
      setLiveWaves(prev => prev.map(w => w.id === wave.id ? { ...w, deleted: true } : w))
      toast.success(`Wave "${wave.name}" deleted`)
    } catch {
      toast.error('Failed to delete wave. Reverting...')
      setLiveProjects(initialProjects)
    } finally {
      setDeleteLoading(false)
      setDeleteDialogOpen(false)
      setDeletingWave(null)
    }
  }, [deletingWave, liveProjects, initialProjects, deleteWave])

  const handleRestoreWave = useCallback(async () => {
    if (!restoringWave) return
    setRestoreLoading(true)
    try {
      const updated = await restoreWave(restoringWave.id)
      setLiveWaves(prev => prev.map(w => w.id === updated.id ? updated : w))
      toast.success(`Wave "${updated.name}" restored`)
    } catch {
      toast.error('Failed to restore wave')
    } finally {
      setRestoreLoading(false)
      setRestoreDialogOpen(false)
      setRestoringWave(null)
    }
  }, [restoringWave, restoreWave])

  return (
    <AppShell title="Wave Planning">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Waves className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Wave Planning</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage migration waves and their associated Jira epics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={() => navigate('/waves/gantt')} className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary">
              <GanttChart className="size-4 mr-2" />
              Gantt Chart
            </Button>
            {dataMigrationEnabled && (
              <Button variant="outline" size="lg" onClick={() => navigate('/waves/data-migration')} className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary">
                <Database className="size-4 mr-2" />
                Data Migration
              </Button>
            )}
            <div className="w-px h-8 bg-border mx-2" />
            <button
              className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2"
              onClick={() => exportWavePlanningToExcel(liveProjects, liveWaves)}
            >
              <Download size={14} /> Export
            </button>
            <Button variant="outline" size="lg" onClick={() => setImportOpen(true)}>
              <Download className="size-4 mr-2" />
              Import Wave
            </Button>
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-2" />
              Create Wave
            </Button>
          </div>
        </div>

        {/* Waves Table */}
        <div className="flex items-center justify-end gap-2 mb-2">
          <span className="text-sm text-muted-foreground">Show deleted</span>
          <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Wave</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Start Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Cutover Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Jira Epic</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Projects</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : waves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No waves yet. Create or import a wave to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedWaves.map((wave: Wave) => {
                  const isDeleted = wave.deleted
                  return (
                  <TableRow
                    key={wave.id}
                    className={isDeleted ? 'opacity-60 bg-muted/20' : 'hover:bg-muted/40'}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="shrink-0 size-3 rounded-full"
                          style={{ background: wave.color ?? '#3B82F6' }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={isDeleted ? 'font-medium text-muted-foreground line-through' : 'font-medium text-foreground'}>{wave.name}</p>
                          </div>
                          {wave.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wave.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(wave.startDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(wave.cutoverDate)}
                    </TableCell>
                    <TableCell>
                      {wave.jiraEpicKey ? (
                        wave.jiraBaseUrl ? (
                          <a
                            href={`${wave.jiraBaseUrl}/browse/${wave.jiraEpicKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline inline-flex items-center"
                          >
                            {wave.jiraEpicKey}
                          </a>
                        ) : (
                          <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">
                            {wave.jiraEpicKey}
                          </code>
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {projectCountByWave(wave.id)}
                    </TableCell>
                    <TableCell>
                      {isDeleted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-primary hover:text-primary"
                          onClick={() => { setRestoringWave(wave); setRestoreDialogOpen(true) }}
                          title="Restore"
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => { setSelectedWave(wave); setEditOpen(true) }}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => { setDeletingWave(wave); setDeleteDialogOpen(true) }}
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        {/* Category Milestones Table */}
        <div className="space-y-4" data-testid="category-milestones-section">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="size-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Category Milestones</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Maintain category milestones and batch-assign them to projects.
              </p>
            </div>
            <Button size="lg" onClick={() => { setEditingCM(null); setCmDrawerOpen(true) }} data-testid="create-category-milestone-btn">
              <Plus className="size-4 mr-2" />
              Create Category Milestone
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table data-testid="category-milestones-table">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Start Date</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">End Date</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider w-[60px]">Icon</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Projects</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cmLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : categoryMilestones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No category milestones yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...categoryMilestones].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((cm) => {
                    const Icon = cm.icon ? CATEGORY_MILESTONE_ICON_MAP[cm.icon] : null
                    return (
                    <TableRow key={cm.id} className="hover:bg-muted/40" data-testid="category-milestone-row">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="shrink-0 size-3 rounded-full"
                            style={{ background: cm.color ?? '#3B82F6' }}
                          />
                          <span className="font-medium text-foreground">{cm.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cm.startDate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cm.endDate)}
                      </TableCell>
                      <TableCell>
                        {Icon ? <Icon className="size-4 text-muted-foreground" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {projectCountByCM(cm.id)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleOpenAssign(cm)}
                            title="Assign projects"
                            data-testid="assign-category-milestone-btn"
                          >
                            <Link className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => { setEditingCM(cm); setCmDrawerOpen(true) }}
                            title="Edit"
                            data-testid="edit-category-milestone-btn"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => { setDeletingCM(cm); setCmDeleteDialogOpen(true) }}
                            title="Delete"
                            data-testid="delete-category-milestone-btn"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <CreateWaveDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
        onCreate={createWave}
      />
      <ImportWaveDrawer
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
        onImport={importWave}
      />

      <EditWaveDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        wave={selectedWave}
        onUpdated={handleWaveUpdated}
      />

      <CategoryMilestoneDrawer
        open={cmDrawerOpen}
        onOpenChange={setCmDrawerOpen}
        categoryMilestone={editingCM}
        onSave={handleCreateOrUpdateCM}
        saving={cmSaving}
      />

      <AssignCategoryMilestoneDrawer
        open={assignDrawerOpen}
        onOpenChange={setAssignDrawerOpen}
        categoryMilestone={assigningCM}
        projects={liveProjects}
        onAssign={handleBatchAssign}
        loading={assignLoading}
      />

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Wave</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore <strong>{restoringWave?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} disabled={restoreLoading}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleRestoreWave} disabled={restoreLoading}>
              {restoreLoading ? 'Restoring...' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wave</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingWave?.name}</strong>?
              {liveProjects.filter(p => p.waveId === deletingWave?.id).length > 0 && (
                <> All {liveProjects.filter(p => p.waveId === deletingWave?.id).length} project(s) assigned to this wave will be unassigned.</>
              )}
              {' '}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteWave} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cmDeleteDialogOpen} onOpenChange={setCmDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category Milestone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingCM?.name}</strong>?
              {' '}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCmDeleteDialogOpen(false)} disabled={cmDeleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCM} disabled={cmDeleteLoading}>
              {cmDeleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
