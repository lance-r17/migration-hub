import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { NotionEditor } from '@/components/notion-editor/NotionEditor'
import { Tag, Users } from 'lucide-react'
import { getNoteTemplates } from '@/services/noteTemplates'
import { cloneBlock } from '@/components/notion-editor/model'
import type { Block } from '@/components/notion-editor/model'
import type { NoteTemplate } from '@/types'

interface TemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (blocks: Block[], mode: 'replace' | 'append') => void
  defaultLabel?: string
}

export function TemplatePicker({ open, onOpenChange, onApply, defaultLabel }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getNoteTemplates(defaultLabel)
      .then(data => {
        setTemplates(data)
        setSelectedId(data[0]?.id ?? null)
      })
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false))
  }, [open, defaultLabel])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.labels.some(l => l.toLowerCase().includes(q))
    )
  }, [templates, search])

  const selected = templates.find(t => t.id === selectedId)

  const handleApply = () => {
    if (!selected) return
    const blocks = (selected.blocks as Block[]).map(cloneBlock)
    onApply(blocks, mode)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Apply Template</DialogTitle>
          <DialogDescription>
            Choose a template to populate your notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 h-full">
          {/* Left column */}
          <div className="w-80 border-r flex flex-col gap-3 shrink-0 h-full">
            <div className="p-4 pb-0 space-y-3 shrink-0">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Search
                </Label>
                <Input
                  placeholder="Filter by name or label..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 min-h-0">
              {loading ? (
                <p className="text-sm text-muted-foreground py-4">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No templates found.</p>
              ) : (
                <div className="space-y-1.5">
                  {filtered.map(t => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-md border p-2.5 transition-colors ${
                        selectedId === t.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'
                      }`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium line-clamp-1">{t.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {t.scope}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>
                      )}
                      {t.labels.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Tag className="size-3 text-muted-foreground shrink-0" />
                          <div className="flex gap-1 flex-wrap">
                            {t.labels.map(l => (
                              <Badge key={l} variant="outline" className="text-[10px]">
                                {l}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {t.scope === 'function' && t.sharedRoles && t.sharedRoles.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users className="size-3 text-muted-foreground shrink-0" />
                          <div className="flex gap-1 flex-wrap">
                            {t.sharedRoles.map(r => (
                              <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 pt-0 shrink-0">
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Apply mode
              </Label>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v as 'replace' | 'append')}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="replace" className="flex-1 text-xs">
                  Replace
                </ToggleGroupItem>
                <ToggleGroupItem value="append" className="flex-1 text-xs">
                  Append
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Right column - Preview */}
          <div className="flex-1 overflow-y-auto bg-muted/20 h-full">
            {selected ? (
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">{selected.name}</h3>
                  {selected.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selected.description}</p>
                  )}
                </div>
                <NotionEditor
                  blocks={selected.blocks as Block[]}
                  readOnly
                  allowEmpty
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Select a template to preview its content</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selected}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
