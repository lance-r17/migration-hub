import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useProjectUsers } from '@/hooks/use-users'
import type { GovernanceRoles, User } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  governanceRoles?: GovernanceRoles
  projectId: string
  onSave: (payload: { technicalLeadId?: string; businessOwnerId?: string; dbaDataOwnerId?: string }) => void
}

const sectionLabel = 'text-xs font-semibold uppercase text-muted-foreground tracking-wide pt-2'

function UserPreview({ userId, users }: { userId: string; users: User[] }) {
  const user = users.find(u => u.id === userId)
  if (!user) return null
  return (
    <div className="mt-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
      <p className="text-xs font-medium text-foreground">{user.name}</p>
      <p className="text-xs text-muted-foreground">{user.team ?? user.department} · {user.email}</p>
    </div>
  )
}

function isPlatformLead(u: User) {
  return u.role.includes('platform_migration_lead')
}

export function ContactsOwnershipDrawer({ open, onOpenChange, governanceRoles, projectId, onSave }: Props) {
  const { users: availableUsers, loading: usersLoading } = useProjectUsers(projectId)

  const [draft, setDraft] = useState({ boUserId: '', tlUserId: '', dbaUserId: '' })

  useEffect(() => {
    if (open) {
      setDraft({
        boUserId:  governanceRoles?.businessOwner?.id  ?? '',
        tlUserId:  governanceRoles?.technicalLead?.id  ?? '',
        dbaUserId: governanceRoles?.dbaDataOwner?.id   ?? '',
      })
    }
  }, [open, governanceRoles])

  // Filtered option lists
  // BO: exclude TL, DBA, and Platform Migration Leads
  const boOptions = availableUsers.filter(u =>
    !isPlatformLead(u) && u.id !== draft.tlUserId && u.id !== draft.dbaUserId
  )
  // TL: exclude BO, DBA, and Platform Migration Leads
  const tlOptions = availableUsers.filter(u =>
    !isPlatformLead(u) && u.id !== draft.boUserId && u.id !== draft.dbaUserId
  )
  // DBA: exclude BO and TL (no PML restriction — operational role)
  const dbaOptions = availableUsers.filter(u =>
    u.id !== draft.boUserId && u.id !== draft.tlUserId
  )

  // Save guard — defensive check in case someone bypasses the UI filters
  const validationError = (() => {
    const selected = [draft.boUserId, draft.tlUserId, draft.dbaUserId].filter(Boolean)
    if (selected.length !== new Set(selected).size) {
      return 'A user cannot hold more than one role on this project.'
    }
    const pmlInBO = draft.boUserId && availableUsers.find(u => u.id === draft.boUserId && isPlatformLead(u))
    const pmlInTL = draft.tlUserId && availableUsers.find(u => u.id === draft.tlUserId && isPlatformLead(u))
    if (pmlInBO || pmlInTL) {
      return 'Platform Migration Lead cannot be assigned as Business Owner or Technical Lead.'
    }
    return null
  })()

  function handleSave() {
    if (validationError) return
    onSave({
      technicalLeadId: draft.tlUserId || undefined,
      businessOwnerId: draft.boUserId || undefined,
      dbaDataOwnerId: draft.dbaUserId || undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Contacts & Ownership"
      onSave={handleSave}
      saveDisabled={!!validationError}
    >
      <p className={sectionLabel}>Technical Lead</p>
      <div className="space-y-1.5">
        <Label>User</Label>
        <Select value={draft.tlUserId} onValueChange={(v) => setDraft(d => ({ ...d, tlUserId: v }))}>
          <SelectTrigger disabled={usersLoading}><SelectValue placeholder={usersLoading ? 'Loading users…' : 'Select a user…'} /></SelectTrigger>
          <SelectContent>
            {tlOptions.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.tlUserId && <UserPreview userId={draft.tlUserId} users={availableUsers} />}
      </div>

      <p className={sectionLabel}>Business Owner</p>
      <div className="space-y-1.5">
        <Label>User</Label>
        <Select value={draft.boUserId} onValueChange={(v) => setDraft(d => ({ ...d, boUserId: v }))}>
          <SelectTrigger disabled={usersLoading}><SelectValue placeholder={usersLoading ? 'Loading users…' : 'Select a user…'} /></SelectTrigger>
          <SelectContent>
            {boOptions.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.boUserId && <UserPreview userId={draft.boUserId} users={availableUsers} />}
      </div>

      <p className={sectionLabel}>DBA / Data Owner</p>
      <div className="space-y-1.5">
        <Label>User</Label>
        <Select value={draft.dbaUserId} onValueChange={(v) => setDraft(d => ({ ...d, dbaUserId: v }))}>
          <SelectTrigger disabled={usersLoading}><SelectValue placeholder={usersLoading ? 'Loading users…' : 'Select a user…'} /></SelectTrigger>
          <SelectContent>
            {dbaOptions.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.dbaUserId && <UserPreview userId={draft.dbaUserId} users={availableUsers} />}
      </div>

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
    </SectionEditDrawer>
  )
}
