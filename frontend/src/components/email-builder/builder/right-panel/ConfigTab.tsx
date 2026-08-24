import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { EmailTemplate, EmailComponent, EmailRow, RecipientConfig } from '@/types/email'
import { EMAIL_EVENT_LABELS } from '@/types/email'

interface Props {
  template: EmailTemplate
  onTemplateChange: (partial: Partial<EmailTemplate>) => void
  selectedComponent: EmailComponent | null
  onComponentConfigChange: (config: EmailComponent['config']) => void
  selectedRow: EmailRow | null
}

const EVENT_TYPES = Object.entries(EMAIL_EVENT_LABELS) as [EmailTemplate['eventType'], string][]

const RECIPIENT_ROLES = [
  { value: 'platform_migration_lead', label: 'Platform Migration Lead' },
  { value: 'technical_lead', label: 'Technical Lead' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'gbi_champion', label: 'BGI Champion' },
  { value: 'gbi_champion_delegate', label: 'BGI Champion Delegate' },
]

const ROLE_LABELS: Record<string, string> = {
  platform_migration_lead: 'Platform Migration Lead',
  technical_lead: 'Technical Lead',
  business_owner: 'Business Owner',
  gbi_champion: 'BGI Champion',
  gbi_champion_delegate: 'BGI Champion Delegate',
}

export function ConfigTab({ template, onTemplateChange, selectedComponent, onComponentConfigChange, selectedRow }: Props) {
  const isAnythingSelected = selectedComponent !== null || selectedRow !== null
  const [addingRecipient, setAddingRecipient] = useState<'role' | 'static' | null>(null)
  const [recipientInput, setRecipientInput] = useState('')

  const addRecipient = (r: RecipientConfig) => {
    onTemplateChange({ recipientList: [...template.recipientList, r] })
    setAddingRecipient(null)
    setRecipientInput('')
  }

  const removeRecipient = (idx: number) => {
    onTemplateChange({ recipientList: template.recipientList.filter((_, i) => i !== idx) })
  }

  const recipientLabel = (r: RecipientConfig): string => {
    if (r.type === 'role') return `Role: ${ROLE_LABELS[r.role] ?? r.role}`
    if (r.type === 'project_field') return `Field: ${r.field}`
    return r.email
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto">
      {/* Template Config — hidden when a component or layout is selected */}
      {!isAnythingSelected && <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Template</p>
        <div className="space-y-3">
          {/* Event type */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Event Type</Label>
            <Select
              value={template.eventType}
              onValueChange={v => onTemplateChange({ eventType: v as EmailTemplate['eventType'] })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={template.subject}
              onChange={e => onTemplateChange({ subject: e.target.value })}
              className="h-7 text-xs"
              placeholder="Email subject…"
            />
            <p className="text-[10px] text-muted-foreground">Use {'{{variables}}'} for dynamic content</p>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Recipients</Label>
            <div className="flex flex-wrap gap-1">
              {template.recipientList.map((r, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                  {recipientLabel(r)}
                  <button onClick={() => removeRecipient(i)} className="ml-0.5 hover:text-destructive">
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>

            {addingRecipient === null && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setAddingRecipient('role')}>
                  <Plus className="size-2.5 mr-1" /> Role
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setAddingRecipient('static')}>
                  <Plus className="size-2.5 mr-1" /> Email
                </Button>
              </div>
            )}

            {addingRecipient === 'role' && (
              <div className="flex gap-1">
                <Select onValueChange={v => addRecipient({ type: 'role', role: v })}>
                  <SelectTrigger className="h-6 flex-1 text-xs">
                    <SelectValue placeholder="Select role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECIPIENT_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setAddingRecipient(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            )}

            {addingRecipient === 'static' && (
              <div className="flex gap-1">
                <Input
                  type="email"
                  value={recipientInput}
                  onChange={e => setRecipientInput(e.target.value)}
                  className="h-6 flex-1 text-xs"
                  placeholder="user@company.com"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && recipientInput) addRecipient({ type: 'static', email: recipientInput })
                  }}
                />
                <Button variant="outline" size="icon" className="size-6" onClick={() => { if (recipientInput) addRecipient({ type: 'static', email: recipientInput }) }}>
                  <Plus className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setAddingRecipient(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* Component Config */}
      {selectedComponent && (selectedComponent.type === 'image' || selectedComponent.type === 'hero-image' || selectedComponent.type === 'cta') && (
        <>
          <div className="border-t border-border" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Component — {selectedComponent.type}
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Link URL</Label>
                <Input
                  value={selectedComponent.config.linkUrl ?? ''}
                  onChange={e => onComponentConfigChange({ ...selectedComponent.config, linkUrl: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="https://… or /path"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Open in new tab</Label>
                <Switch
                  checked={selectedComponent.config.openInNewTab ?? false}
                  onCheckedChange={v => onComponentConfigChange({ ...selectedComponent.config, openInNewTab: v })}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
