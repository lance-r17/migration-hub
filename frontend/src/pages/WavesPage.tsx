import { useState } from 'react'
import { Waves, Download, Plus, Lock } from 'lucide-react'
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
import { useCurrentUser } from '@/context/UserContext'
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

export function WavesPage() {
  const { user } = useCurrentUser()
  const { waves, loading } = useWaves()
  const { projects } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const isPlatformLead = user?.role === 'Platform Migration Lead'

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
    projects.filter(p => p.waveId === waveId).length

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
      <div className="max-w-screen-xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
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
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="size-4 mr-2" />
              Import Wave
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-2" />
              Create Wave
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wave</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Cutover Date</TableHead>
                <TableHead>Jira Epic</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Status</TableHead>
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
                waves.map(wave => (
                  <TableRow key={wave.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{wave.name}</p>
                        {wave.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wave.description}</p>
                        )}
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
                        <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">
                          {wave.jiraEpicKey}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {projectCountByWave(wave.id)}
                    </TableCell>
                    <TableCell>
                      <WaveStatusBadge status={wave.status} />
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
      />
      <ImportWaveDrawer
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />
    </AppShell>
  )
}
