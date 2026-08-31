import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { DEFAULT_PROVISION_CIDR_PARENTS, DEFAULT_PROVISION_ALLOWED_PREFIXES, isValidParentCidr } from '@/lib/provision-cidr'
import type { ProvisionCidrParents, MigrationSettings } from '@/types/settings'
import type { ProvisionEnvironment, ProvisionZone } from '@/types'

const ENV_OPTIONS: { value: ProvisionEnvironment; label: string }[] = [
  { value: 'dev', label: 'DEV' },
  { value: 'prod', label: 'PROD' },
]

const ZONE_OPTIONS: { value: ProvisionZone; label: string }[] = [
  { value: 'zoneA', label: 'Zone A' },
  { value: 'zoneB', label: 'Zone B' },
  { value: 'zoneC', label: 'Zone C' },
]

/** Candidate prefix lengths admins can allow for project zone CIDRs. */
const PREFIX_CANDIDATES = [24, 25, 26, 27, 28]

/**
 * Admin page for overriding the parent CIDR blocks per environment × availability zone.
 * Project-level zone CIDRs entered on the Environment Provision page must be
 * carved from these parent blocks with an allowed prefix length. Both are stored in
 * migration settings (`provision_cidr_parents`, `provision_allowed_prefixes`);
 * readable by all roles via GET /api/v1/settings/migration.
 */
export function AdminProvisionCidrsPage() {
  const navigate = useNavigate()
  const { settings, loading } = useMigrationSettings()

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/admin')} className="cursor-pointer">
              Admin
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Provision CIDR Blocks</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Network className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Provision CIDR Blocks</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Parent CIDR blocks per environment and availability zone. When a Platform Migration Lead assigns
          zone CIDRs on the Environment Provision page, each /26 or /27 block must fit within one of these
          parent blocks.
        </p>
      </div>

      {loading || !settings ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <CidrParentsForm settings={settings} />
      )}
    </div>
  )
}

function CidrParentsForm({ settings }: { settings: MigrationSettings }) {
  const { saving, save } = useMigrationSettings()

  const [parents, setParents] = useState<ProvisionCidrParents>(
    () => settings.provisionCidrParents ?? structuredClone(DEFAULT_PROVISION_CIDR_PARENTS)
  )
  const [allowedPrefixes, setAllowedPrefixes] = useState<number[]>(
    () => settings.provisionAllowedPrefixes ?? [...DEFAULT_PROVISION_ALLOWED_PREFIXES]
  )
  const [newCidrs, setNewCidrs] = useState<Record<string, string>>({})

  function togglePrefix(prefix: number) {
    setAllowedPrefixes(prev =>
      prev.includes(prefix) ? prev.filter(p => p !== prefix) : [...prev, prefix].sort((a, b) => a - b)
    )
  }

  function inputKey(env: ProvisionEnvironment, zone: ProvisionZone) {
    return `${env}:${zone}`
  }

  function addCidr(env: ProvisionEnvironment, zone: ProvisionZone) {
    const key = inputKey(env, zone)
    const value = (newCidrs[key] ?? '').trim()
    if (!isValidParentCidr(value)) {
      toast.error('Invalid CIDR block', { description: 'Expected a network-aligned CIDR, e.g. 10.248.32.0/20' })
      return
    }
    if (parents[env][zone].includes(value)) {
      toast.error('Duplicate CIDR block', { description: `${value} is already in the list.` })
      return
    }
    setParents(prev => ({
      ...prev,
      [env]: { ...prev[env], [zone]: [...prev[env][zone], value] },
    }))
    setNewCidrs(prev => ({ ...prev, [key]: '' }))
  }

  function removeCidr(env: ProvisionEnvironment, zone: ProvisionZone, cidr: string) {
    setParents(prev => ({
      ...prev,
      [env]: { ...prev[env], [zone]: prev[env][zone].filter(c => c !== cidr) },
    }))
  }

  async function handleSave() {
    const empty = ENV_OPTIONS.flatMap(o => ZONE_OPTIONS.filter(z => parents[o.value][z.value].length === 0).map(z => `${o.label} ${z.label}`))
    if (empty.length > 0) {
      toast.error('Parent blocks required', { description: `Each environment + zone needs at least one parent block. Empty: ${empty.join(', ')}` })
      return
    }
    if (allowedPrefixes.length === 0) {
      toast.error('Allowed prefixes required', { description: 'Select at least one allowed prefix length.' })
      return
    }
    try {
      await save({ ...settings, provisionCidrParents: parents, provisionAllowedPrefixes: allowedPrefixes })
      toast.success('Provision CIDR blocks saved')
    } catch {
      toast.error('Failed to save provision CIDR blocks')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <h2 className="text-sm font-semibold">Allowed Prefix Lengths</h2>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            Project zone CIDRs entered on the Environment Provision page must use one of these prefix lengths.
          </p>
          <div className="flex flex-wrap gap-2">
            {PREFIX_CANDIDATES.map(prefix => {
              const selected = allowedPrefixes.includes(prefix)
              return (
                <button
                  key={prefix}
                  onClick={() => togglePrefix(prefix)}
                  className={cn(
                    'px-3 py-1.5 rounded-md border text-[13px] font-mono transition-colors',
                    selected
                      ? 'bg-primary/10 border-primary text-primary font-medium'
                      : 'bg-background border-border text-foreground hover:bg-muted'
                  )}
                >
                  /{prefix}
                </button>
              )
            })}
          </div>
          {allowedPrefixes.length === 0 && (
            <p className="text-[11px] text-destructive mt-2">At least one prefix length must be selected.</p>
          )}
        </div>
      </div>

      {ENV_OPTIONS.map(env => (
            <div key={env.value} className="rounded-lg border border-border">
              <div className="px-4 py-3 border-b border-border bg-muted/40">
                <h2 className="text-sm font-semibold">{env.label}</h2>
              </div>
              <div className="p-4 grid gap-4 md:grid-cols-3">
                {ZONE_OPTIONS.map(zone => {
                  const key = inputKey(env.value, zone.value)
                  const draft = newCidrs[key] ?? ''
                  const draftInvalid = draft.trim() !== '' && !isValidParentCidr(draft)
                  return (
                    <div key={zone.value} className="space-y-2">
                      <Label className="text-xs font-medium">{zone.label}</Label>
                      <div className="space-y-1.5">
                        {parents[env.value][zone.value].map(cidr => (
                          <div key={cidr} className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono rounded-md border border-border bg-muted/40 px-2 py-1.5">
                              {cidr}
                            </code>
                            <button
                              onClick={() => removeCidr(env.value, zone.value, cidr)}
                              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                              aria-label={`Remove ${cidr}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {parents[env.value][zone.value].length === 0 && (
                          <p className="text-[11px] text-destructive">At least one parent block is required.</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={draft}
                          onChange={e => setNewCidrs(prev => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addCidr(env.value, zone.value) }}
                          placeholder="10.248.0.0/20"
                          className={`h-8 text-xs font-mono ${draftInvalid ? 'border-destructive' : ''}`}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => addCidr(env.value, zone.value)}
                          disabled={!draft.trim() || draftInvalid}
                        >
                          <Plus size={13} />
                        </Button>
                      </div>
                      {draftInvalid && (
                        <p className="text-[11px] text-destructive">Invalid or misaligned CIDR block.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setParents(structuredClone(DEFAULT_PROVISION_CIDR_PARENTS))
                setAllowedPrefixes([...DEFAULT_PROVISION_ALLOWED_PREFIXES])
              }}
            >
              <RotateCcw size={13} className="mr-1.5" />
              Reset to defaults
            </Button>
          </div>
    </div>
  )
}
