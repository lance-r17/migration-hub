import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { NotionEditor } from '@frontend/notion-editor'
import type { Block } from '@frontend/notion-editor'
import { TemplateMetaPanel } from '@/components/note-template/TemplateMetaPanel'
import { createNoteTemplate } from '@/services/noteTemplates'
import {
  sanitizeBlocksForTemplate,
  buildTemplateContext,
  findVariableMatches,
  applyVariableReplacement,
  revertVariableReplacement,
  TEMPLATE_VARIABLES,
} from '@/lib/noteTemplateUtils'
import { useCurrentUser } from '@/context/UserContext'

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: Block[]
  project: Record<string, unknown> | null
  userName: string
  defaultLabels?: string[]
}

export function SaveTemplateDialog({ open, onOpenChange, blocks, project, userName, defaultLabels = [] }: SaveTemplateDialogProps) {
  const { user } = useCurrentUser()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [scope, setScope] = useState<'private' | 'global' | 'function'>('private')
  const [sharedRoles, setSharedRoles] = useState<string[]>([])
  const [labelInput, setLabelInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [editorBlocks, setEditorBlocks] = useState<Block[]>([])
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const context = useMemo(() => buildTemplateContext(project, userName), [project, userName])
  const matches = useMemo(() => findVariableMatches(blocks, context), [blocks, context])

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return
    const cloned = blocks.map(b => ({ ...b, id: b.id })) as Block[]
    setEditorBlocks(cloned)
    setName('')
    setDescription('')
    setLabels([...defaultLabels])
    setScope('private')
    setSharedRoles([])
    setCheckedKeys(new Set(matches.map(m => m.key)))
  }, [open, blocks, matches, defaultLabels])

  // Apply checked replacements whenever checkedKeys changes
  useEffect(() => {
    if (!open) return
    let current = blocks.map(b => ({ ...b, id: b.id })) as Block[]
    for (const m of matches) {
      if (checkedKeys.has(m.key)) {
        current = applyVariableReplacement(current, m.key, m.value)
      }
    }
    setEditorBlocks(current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedKeys, open])

  const toggleKey = (key: string, value: string) => {
    setCheckedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        setEditorBlocks(curr => revertVariableReplacement(curr, key, value))
      } else {
        next.add(key)
        setEditorBlocks(curr => applyVariableReplacement(curr, key, value))
      }
      return next
    })
  }

  const copyVariable = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required')
      return
    }
    setSaving(true)
    try {
      const sanitized = sanitizeBlocksForTemplate(editorBlocks)
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        labels,
        blocks: sanitized as unknown[],
        scope,
      }
      if (scope === 'function') {
        payload.sharedRoles = sharedRoles
      }
      await createNoteTemplate(payload)
      toast.success('Template saved')
      onOpenChange(false)
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
          <h2 className="text-base font-semibold">Save as Template</h2>
        </div>
        <Button onClick={handleSave} disabled={saving} className="h-8">
          {saving ? 'Saving…' : 'Save Template'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor pane */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-screen-xl mx-auto w-full">
            <NotionEditor
              blocks={editorBlocks}
              onBlocksChange={setEditorBlocks}
              allowEmpty
              variables={TEMPLATE_VARIABLES}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 border-l overflow-y-auto p-4 space-y-5 shrink-0">
          <TemplateMetaPanel
              isEditing={true}
              isPlatformLead={isPlatformLead}
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              labels={labels}
              setLabels={setLabels}
              scope={scope}
              setScope={setScope}
              sharedRoles={sharedRoles}
              setSharedRoles={setSharedRoles}
              labelInput={labelInput}
              setLabelInput={setLabelInput}
            />

          {/* Smart Replacements */}
          {matches.length > 0 ? (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Smart Replacements
              </Label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Checked items will be replaced with variables in the saved template.
              </p>
              <div className="space-y-2">
                {matches.map(m => (
                  <div key={m.key} className="flex items-start gap-2 rounded-md border p-2">
                    <Checkbox
                      id={`replace-${m.key}`}
                      checked={checkedKeys.has(m.key)}
                      onCheckedChange={() => toggleKey(m.key, m.value)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`replace-${m.key}`} className="text-xs font-medium cursor-pointer">
                        {m.label}
                      </Label>
                      <p className="text-[11px] text-muted-foreground truncate">
                        “{m.value}” → <code className="text-primary">{'{{'}{m.key}{'}}'}</code>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Available Variables
              </Label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Click to copy and paste into the editor.
              </p>
              <div className="space-y-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    onClick={() => copyVariable(v.key)}
                    className="flex items-center justify-between w-full rounded-md border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <span className="font-medium">{v.label}</span>
                    <span className="text-muted-foreground ml-2">
                      {copiedKey === v.key ? (
                        <Check className="size-3 text-green-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
