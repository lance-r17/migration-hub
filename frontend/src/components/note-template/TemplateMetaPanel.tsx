import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const SHAREABLE_ROLES = [
  { value: 'platform_migration_lead', label: 'Platform Migration Lead' },
  { value: 'admin', label: 'Admin' },
  { value: 'technical_lead', label: 'Technical Lead' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'dba_data_owner', label: 'DBA / Data Owner' },
  { value: 'itso', label: 'ITSO' },
  { value: 'itso_delegate', label: 'ITSO Delegate' },
  { value: 'member', label: 'Member' },
]

interface TemplateMetaPanelProps {
  isEditing: boolean
  isPlatformLead: boolean
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  labels: string[]
  setLabels: (v: string[]) => void
  scope: 'private' | 'global' | 'function'
  setScope: (v: 'private' | 'global' | 'function') => void
  sharedRoles: string[]
  setSharedRoles: (v: string[]) => void
  labelInput: string
  setLabelInput: (v: string) => void
  createdAt?: string
  updatedAt?: string
}

export function TemplateMetaPanel({
  isEditing,
  isPlatformLead,
  name,
  setName,
  description,
  setDescription,
  labels,
  setLabels,
  scope,
  setScope,
  sharedRoles,
  setSharedRoles,
  labelInput,
  setLabelInput,
  createdAt,
  updatedAt,
}: TemplateMetaPanelProps) {
  const addLabel = () => {
    const trimmed = labelInput.trim().toLowerCase()
    if (!trimmed || labels.includes(trimmed)) return
    setLabels([...labels, trimmed])
    setLabelInput('')
  }

  const removeLabel = (l: string) => {
    setLabels(labels.filter(x => x !== l))
  }

  const toggleRole = (role: string) => {
    setSharedRoles(
      sharedRoles.includes(role) ? sharedRoles.filter(r => r !== role) : [...sharedRoles, role]
    )
  }

  return (
    <>
      {/* Name */}
      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Name
        </Label>
        {isEditing ? (
          <Input value={name} onChange={e => setName(e.target.value)} />
        ) : (
          <p className="text-sm font-medium">{name}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Description
        </Label>
        {isEditing ? (
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{description || '—'}</p>
        )}
      </div>

      {/* Labels */}
      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Labels
        </Label>
        {isEditing ? (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="Add label and press Enter"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addLabel()
                  }
                }}
              />
              <Button variant="outline" onClick={addLabel} className="shrink-0">
                Add
              </Button>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              {labels.map(l => (
                <Badge key={l} variant="secondary" className="text-xs gap-1">
                  {l}
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeLabel(l)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <div className="flex gap-1 flex-wrap">
            {labels.length > 0 ? (
              labels.map(l => (
                <Badge key={l} variant="outline" className="text-xs">
                  {l}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        )}
      </div>

      {/* Scope */}
      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sharing Scope
        </Label>
        {isEditing && isPlatformLead ? (
          <div className="space-y-3">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => v && setScope(v as 'private' | 'global' | 'function')}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="private" className="flex-1 text-xs">
                Private
              </ToggleGroupItem>
              <ToggleGroupItem value="global" className="flex-1 text-xs">
                Global
              </ToggleGroupItem>
              <ToggleGroupItem value="function" className="flex-1 text-xs">
                Function
              </ToggleGroupItem>
            </ToggleGroup>

            {scope === 'function' && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Select roles that can access this template.
                </p>
                <div className="space-y-1.5">
                  {SHAREABLE_ROLES.map(role => (
                    <div key={role.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.value}`}
                        checked={sharedRoles.includes(role.value)}
                        onCheckedChange={() => toggleRole(role.value)}
                      />
                      <Label htmlFor={`role-${role.value}`} className="text-xs font-normal cursor-pointer">
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Badge
              variant={
                scope === 'global' ? 'default' : scope === 'function' ? 'outline' : 'secondary'
              }
              className="text-xs"
            >
              {scope}
            </Badge>
            {scope === 'function' && sharedRoles.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {sharedRoles.map(r => (
                  <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timestamps */}
      {!isEditing && (createdAt || updatedAt) && (
        <div className="pt-4 border-t space-y-1">
          {createdAt && (
            <p className="text-[11px] text-muted-foreground">
              Created: {new Date(createdAt).toLocaleString()}
            </p>
          )}
          {updatedAt && (
            <p className="text-[11px] text-muted-foreground">
              Updated: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </>
  )
}
