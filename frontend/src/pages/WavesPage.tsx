import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Waves, Download, Plus, Lock, GanttChart, AlertTriangle } from 'lucide-react'
import { isBefore, isAfter } from 'date-fns'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateWaveDrawer } from '@/components/drawers/CreateWaveDrawer'
import { ImportWaveDrawer } from '@/components/drawers/ImportWaveDrawer'
import { useWaves } from '@/hooks/use-waves'
import { useProjects } from '@/hooks/use-projects'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { useCurrentUser } from '@/context/UserContext'
import { EditWaveDrawer } from '@/components/drawers/EditWaveDrawer'
import { updateProject } from '@/services/projects'
import { appendAuditEntryMock } from '@/services/auditLog'
import { USE_MOCK } from '@/services/client'
import type { Wave, WaveStatus } from '@/types/wave'

function WaveStatusBadge({ status }: { status: WaveStatus }) {
  const config: Record<WaveStatus, { label: string; className: string }> = {
    planned: { label: 'Planned', className: 'bg-muted text-muted-foreground border-border' },
    active:  { label: 'Active',  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  }
  const { label, className } = config[status]
  return <Badge variant="outline" className={className}>{label}</Badge>
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[parseInt(month, 10) - 1]} ${year}`
}

function isWaveOutOfPeriod(wave: Wave, platformPeriod?: { startDate?: string; endDate?: string }): boolean {
  if (!platformPeriod?.startDate || !platformPeriod?.endDate) return false
  return isBefore(new Date(wave.startDate), new Date(platformPeriod.startDate)) ||
    isAfter(new Date(wave.cutoverDate), new Date(platformPeriod.endDate))
}

export function WavesPage() {
  const { user } = useCurrentUser()
  const { settings } = useMigrationSettings()
  const { waves, loading, createWave, importWave } = useWaves()
  const { projects: initialProjects } = useProjects()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedWave, setSelectedWave] = useState<Wave | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const [liveWaves, setLiveWaves] = useState(waves)
  const [liveProjects, setLiveProjects] = useState(initialProjects)
  
  useEffect(() => {
    setLiveProjects(initialProjects)
  }, [initialProjects])

  useEffect(() => {
    setLiveWaves(waves)
  }, [waves])

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  
  const sortedWaves = useMemo(() => {
    return [...liveWaves].sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate)
      if (startCompare !== 0) return startCompare
      return a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [liveWaves])

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
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm">
              Wave planning is only accessible to the Platform Migration Lead.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  const projectCountByWave = (waveId: string) =>
    liveProjects.filter(p => p.waveId === waveId).length

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
            <Button variant="outline" size="sm" onClick={() => navigate('/waves/gantt')} className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary">
              <GanttChart className="size-4 mr-2" />
              Gantt Chart
            </Button>
            <div className="w-px h-8 bg-border mx-2" />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Download className="size-4 mr-2" />
              Import Wave
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-2" />
              Create Wave
            </Button>
          </div>
        </div>

        {/* Waves Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Wave</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Start Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Cutover Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Jira Epic</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Projects</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
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
                sortedWaves.map((wave: Wave) => (
                  <TableRow
                    key={wave.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => { setSelectedWave(wave); setEditOpen(true) }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="shrink-0 size-3 rounded-full"
                          style={{ background: wave.color ?? '#3B82F6' }}
                        />
                        <div>
                          <p className="font-medium text-foreground">{wave.name}</p>
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
                      <div className="flex items-center gap-2">
                        <WaveStatusBadge status={wave.status} />
                        {isWaveOutOfPeriod(wave, settings?.platformPeriod) && (
                          <span title="Wave dates fall outside the platform migration period" className="inline-flex items-center text-amber-600">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
    </AppShell>
  )
}
