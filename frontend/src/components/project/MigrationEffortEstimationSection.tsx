import { useEffect, useMemo, useState } from 'react'
import { DollarSign, FileText } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { SectionEditDrawer } from '@/components/drawers/SectionEditDrawer'
import { Field, FieldGroup } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EffortTableEditor } from '@/components/project/EffortTableEditor'
import { getAttachments, deleteAttachment } from '@/services/attachments'
import type { MigrationEffortEstimation, EffortTable } from '@/types'
import type { Attachment } from '@/services/attachments'
import { toast } from 'sonner'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function calcTableCost(table: EffortTable): number {
  return table.tasks.reduce((sum, t) => sum + (t.effort ?? 0) * (t.effortTime ?? 0) * (t.rate ?? 0), 0)
}

interface Props {
  data?: MigrationEffortEstimation
  projectId: string
  projectBaId?: string
  softwareOrigin?: string
  onSave?: (data: MigrationEffortEstimation) => void
}

function calculateTotalCost(tables?: EffortTable[]): number {
  if (!tables) return 0
  return tables.reduce((sum, t) => sum + calcTableCost(t), 0)
}

function CostTable({ table }: { table: EffortTable }) {
  const tableCost = calcTableCost(table)
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Task', 'Effort Unit (FTE)', 'Effort Time (Month)', 'Rate (Monthly Cost USD)', 'Cost (USD)', 'Third party?', 'Remarks'].map(h => (
              <th key={h} className="pb-3 pr-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.tasks.map(task => {
            const cost = (task.effort ?? 0) * (task.effortTime ?? 0) * (task.rate ?? 0)
            return (
              <tr key={task.task} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{task.task}</td>
                <td className="py-3 pr-4 text-muted-foreground text-center">{task.effort ?? '—'}</td>
                <td className="py-3 pr-4 text-muted-foreground text-center">{task.effortTime ?? '—'}</td>
                <td className="py-3 pr-4 text-muted-foreground text-right">{task.rate !== undefined ? formatCurrency(task.rate) : '—'}</td>
                <td className="py-3 pr-4 text-foreground font-medium text-right">{cost > 0 ? formatCurrency(cost) : '—'}</td>
                <td className="py-3 pr-4 text-muted-foreground text-center">{task.thirdParty === true ? 'Yes' : task.thirdParty === false ? 'No' : '—'}</td>
                <td className="py-3 text-muted-foreground text-xs">{task.remarks || '—'}</td>
              </tr>
            )
          })}
          <tr className="border-b border-border last:border-0 bg-muted/30">
            <td className="py-3 pr-4 font-bold text-foreground">Total</td>
            <td className="py-3 pr-4" />
            <td className="py-3 pr-4" />
            <td className="py-3 pr-4" />
            <td className="py-3 pr-4 font-bold text-primary text-right">{tableCost > 0 ? formatCurrency(tableCost) : '—'}</td>
            <td className="py-3 pr-4" />
            <td className="py-3" />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CostBreakdownTables({ tables }: { tables: EffortTable[] }) {
  const [activeTab, setActiveTab] = useState(tables[0]?.baId || '0')

  if (tables.length === 1) {
    return <CostTable table={tables[0]!} />
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-3">
        {tables.map((table, idx) => (
          <TabsTrigger key={idx} value={table.baId || String(idx)}>
            {table.baId || `Table ${idx + 1}`}
          </TabsTrigger>
        ))}
      </TabsList>
      {tables.map((table, idx) => (
        <TabsContent key={idx} value={table.baId || String(idx)}>
          <CostTable table={table} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function MigrationEffortEstimationSection({ data, projectId, projectBaId, softwareOrigin, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<MigrationEffortEstimation>(data ?? {})
  const [attachments, setAttachments] = useState<Attachment[]>([])
  // Load attachments on mount so view mode can display them immediately
  useEffect(() => {
    loadAttachments()
  }, [projectId])

  useEffect(() => {
    if (editing) {
      const initial = data ?? {}
      setDraft(initial)
    }
  }, [editing, data])

  const loadAttachments = async () => {
    try {
      const list = await getAttachments(projectId)
      setAttachments(list)
    } catch {
      setAttachments([])
      toast.error('Failed to load attachments')
    }
  }

  const handleSave = async () => {
    const totalCost = calculateTotalCost(draft.tables)
    const effortEstimate = totalCost > 0 ? String(totalCost) : data?.effortEstimate

    const originalIds = new Set(data?.attachmentIds ?? [])
    const currentIds = new Set(draft.attachmentIds ?? [])
    const removedIds = [...originalIds].filter(id => !currentIds.has(id))

    for (const id of removedIds) {
      try { await deleteAttachment(projectId, id) } catch { /* ignore */ }
    }

    try {
      await onSave?.({ ...draft, effortEstimate })
      setEditing(false)
      await loadAttachments()
    } catch {
      toast.error('Failed to save changes. Please try again.')
    }
  }

  const effortDisplay = useMemo(() => {
    if (!data?.effortEstimate) return null
    if (data.effortEstimate.toLowerCase() === 'tbc') return 'TBC'
    const num = Number(data.effortEstimate)
    if (isNaN(num)) return data.effortEstimate
    return formatCurrency(num)
  }, [data])

  const filteredAttachments = useMemo(() => {
    const ids = new Set(data?.attachmentIds ?? [])
    return attachments.filter(a => ids.has(a.id))
  }, [attachments, data])

  const hasTables = data?.tables && data.tables.length > 0

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Migration Effort Estimation</h2>
      <SectionCard
        icon={DollarSign}
        title="Effort & Cost"
        iconBg="bg-secondary"
        iconColor="text-secondary-foreground"
        onEdit={onSave ? () => setEditing(true) : undefined}
      >
        {!data?.effortEstimate && !data?.notes && !hasTables && !data?.attachmentIds?.length ? (
          <p className="text-sm text-muted-foreground">No effort estimation added yet.</p>
        ) : (
          <div className="space-y-4">
            {effortDisplay && (
              <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Migration Effort Estimate</p>
                <p className="text-sm text-foreground font-semibold">{effortDisplay}</p>
              </div>
            )}

            {hasTables && (
              <div className="pb-4 border-b border-border last:border-0 last:pb-0 space-y-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Cost Breakdown</p>
                <CostBreakdownTables tables={data.tables!} />
              </div>
            )}

            {data?.notes && (
              <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
            {filteredAttachments.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Attachments</p>
                <div className="flex flex-col gap-2">
                  {filteredAttachments.map(att => (
                    <a
                      key={att.id}
                      href={`/api/v1/projects/${projectId}/attachments/${att.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText size={14} />
                      {att.filename}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {onSave && (
        <SectionEditDrawer
          open={editing}
          onOpenChange={setEditing}
          title="Migration Effort Estimation"
          description="Provide a detailed effort breakdown for this migration."
          onSave={handleSave}
          widthClass="w-[900px] sm:!max-w-[900px]"
        >
          <FieldGroup>
            <Field>
              <EffortTableEditor
                tables={draft.tables ?? []}
                tableMode={draft.tableMode ?? 'single'}
                projectBaId={projectBaId}
                softwareOrigin={softwareOrigin}
                onChange={(tables, tableMode) => setDraft(prev => ({ ...prev, tables, tableMode }))}
              />
            </Field>
          </FieldGroup>
        </SectionEditDrawer>
      )}
    </div>
  )
}
