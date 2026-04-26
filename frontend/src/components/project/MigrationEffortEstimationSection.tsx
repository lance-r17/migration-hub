import { useEffect, useMemo, useState } from 'react'
import { DollarSign, Paperclip, Trash2, Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionCard } from '@/components/shared/SectionCard'
import { SectionEditDrawer } from '@/components/drawers/SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getBillingThresholdConfig } from '@/services/billingConfig'
import { uploadAttachment, getAttachments, deleteAttachment } from '@/services/attachments'
import type { MigrationEffortEstimation } from '@/types'
import type { Attachment } from '@/services/attachments'
import { toast } from 'sonner'

interface Props {
  data?: MigrationEffortEstimation
  projectId: string
  onSave?: (data: MigrationEffortEstimation) => void
}

export function MigrationEffortEstimationSection({ data, projectId, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [currency, setCurrency] = useState('CNY')
  const [draft, setDraft] = useState<MigrationEffortEstimation>(data ?? {})
  const [mode, setMode] = useState<'number' | 'tbc'>('number')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    getBillingThresholdConfig()
      .then(cfg => setCurrency(cfg.currency))
      .catch(() => setCurrency('CNY'))
  }, [])

  // Load attachments on mount so view mode can display them immediately
  useEffect(() => {
    loadAttachments()
  }, [projectId])

  useEffect(() => {
    if (editing) {
      const initial = data ?? {}
      setDraft(initial)
      setMode(initial.effortEstimate?.toLowerCase() === 'tbc' ? 'tbc' : 'number')
      loadAttachments()
    }
  }, [editing, data])

  // Refresh attachments when data.attachmentIds changes from external sources
  // (e.g. survey submission, polling) so view mode stays in sync
  const attachmentIdsKey = (data?.attachmentIds ?? []).join(',')
  useEffect(() => {
    if (!editing) {
      loadAttachments()
    }
  }, [attachmentIdsKey])

  const loadAttachments = async () => {
    try {
      const list = await getAttachments(projectId)
      setAttachments(list)
      // Filter draft.attachmentIds to only include actually available attachments
      const validIds = new Set(list.map(a => a.id))
      setDraft(prev => ({
        ...prev,
        attachmentIds: (prev.attachmentIds ?? []).filter(id => validIds.has(id)),
      }))
    } catch {
      setAttachments([])
      toast.error('Failed to load attachments')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const att = await uploadAttachment(projectId, file)
      setAttachments(prev => [att, ...prev])
      setDraft(prev => ({
        ...prev,
        attachmentIds: [...(prev.attachmentIds ?? []), att.id],
      }))
      toast.success('Attachment uploaded')
    } catch {
      toast.error('Failed to upload attachment')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId))
    setDraft(prev => ({
      ...prev,
      attachmentIds: (prev.attachmentIds ?? []).filter(id => id !== attachmentId),
    }))
  }

  const handleModeChange = (value: 'number' | 'tbc') => {
    if (!value) return
    setMode(value)
    if (value === 'tbc') {
      setDraft(prev => ({ ...prev, effortEstimate: 'tbc' }))
    } else {
      setDraft(prev => ({
        ...prev,
        effortEstimate: prev.effortEstimate?.toLowerCase() === 'tbc' ? '' : prev.effortEstimate,
      }))
    }
  }

  const validationError = useMemo(() => {
    if (mode === 'tbc' && !draft.notes?.trim()) {
      return 'Notes are required when Effort Estimate is TBC.'
    }
    return null
  }, [mode, draft.notes])

  const handleSave = async () => {
    if (validationError) return

    const originalIds = new Set(data?.attachmentIds ?? [])
    const currentIds = new Set(draft.attachmentIds ?? [])
    const removedIds = [...originalIds].filter(id => !currentIds.has(id))

    for (const id of removedIds) {
      try { await deleteAttachment(projectId, id) } catch { /* ignore */ }
    }

    try {
      await onSave?.(draft)
      setEditing(false)
      // Refresh attachment list so view mode is in sync
      await loadAttachments()
    } catch {
      toast.error('Failed to save changes. Please try again.')
    }
  }

  const effortDisplay = useMemo(() => {
    if (!data?.effortEstimate) return null
    if (data.effortEstimate.toLowerCase() === 'tbc') return 'TBC'
    return `${data.effortEstimate}K ${currency}`
  }, [data, currency])

  const filteredAttachments = useMemo(() => {
    const ids = new Set(data?.attachmentIds ?? [])
    return attachments.filter(a => ids.has(a.id))
  }, [attachments, data])

  const notesInvalid = mode === 'tbc' && !draft.notes?.trim()

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
        {!data?.effortEstimate && !data?.notes && !data?.attachmentIds?.length ? (
          <p className="text-sm text-muted-foreground">No effort estimation added yet.</p>
        ) : (
          <div className="space-y-4">
            {effortDisplay && (
              <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Migration Effort Estimate</p>
                <p className="text-sm text-foreground font-semibold">{effortDisplay}</p>
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
          description="Provide your best current estimate for this project's migration effort and cost."
          onSave={handleSave}
          saveDisabled={!!validationError}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Effort Estimate ({currency}K)</FieldLabel>
              <FieldDescription>Enter a numeric value in thousands, or select TBC if the estimate is not yet known.</FieldDescription>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => handleModeChange(v as 'number' | 'tbc')}
                variant="outline"
                size="sm"
                spacing={0}
                className="mt-1"
              >
                <ToggleGroupItem value="number">Number</ToggleGroupItem>
                <ToggleGroupItem value="tbc">TBC</ToggleGroupItem>
              </ToggleGroup>
              <Input
                value={draft.effortEstimate ?? ''}
                onChange={e => setDraft(prev => ({ ...prev, effortEstimate: e.target.value }))}
                placeholder={mode === 'tbc' ? 'TBC' : 'e.g. 150'}
                disabled={mode === 'tbc'}
                className="mt-2"
              />
            </Field>

            <Field>
              <FieldLabel>
                Notes (Breakdown & Rationale)
                {mode === 'tbc' && <span className="text-destructive ml-1">*</span>}
              </FieldLabel>
              <FieldDescription>Prioritise a clear breakdown and rationale: scope, key assumptions, exclusions, risks and any vendor quotes.</FieldDescription>
              <textarea
                value={draft.notes ?? ''}
                onChange={e => setDraft(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter notes..."
                aria-invalid={notesInvalid || undefined}
                className={cn(
                  "min-h-[120px] w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y",
                  notesInvalid
                    ? "border-destructive ring-3 ring-destructive/20"
                    : "border-input"
                )}
              />
              {notesInvalid && (
                <p className="text-sm text-destructive">{validationError}</p>
              )}
            </Field>

            <Field>
              <FieldLabel>Attachments</FieldLabel>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => document.getElementById('effort-attachment-input')?.click()}
                  >
                    <Upload size={14} className="mr-1.5" />
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </Button>
                  <input
                    id="effort-attachment-input"
                    type="file"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </div>

                {(() => {
                  const draftAttachments = attachments.filter(a =>
                    (draft.attachmentIds ?? []).includes(a.id)
                  )
                  if (draftAttachments.length === 0) return null
                  return (
                    <div className="flex flex-col gap-2">
                      {draftAttachments.map(att => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <a
                          href={`/api/v1/projects/${projectId}/attachments/${att.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Paperclip size={14} />
                          <span className="truncate max-w-[300px]">{att.filename}</span>
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  )
                })()}
              </div>
            </Field>
          </FieldGroup>
        </SectionEditDrawer>
      )}
    </div>
  )
}
