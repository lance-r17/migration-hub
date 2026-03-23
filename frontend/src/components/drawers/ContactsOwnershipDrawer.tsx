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
import type { ApplicationOverview } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ApplicationOverview | undefined
  projectId: string
  onSave: (data: ApplicationOverview) => void
}

const sectionLabel = 'text-xs font-semibold uppercase text-muted-foreground tracking-wide pt-2'

function UserPreview({ userId, users }: { userId: string; users: { id: string; name: string; team?: string; department: string; email: string }[] }) {
  const user = users.find(u => u.id === userId)
  if (!user) return null
  return (
    <div className="mt-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
      <p className="text-xs font-medium text-foreground">{user.name}</p>
      <p className="text-xs text-muted-foreground">{user.team ?? user.department} · {user.email}</p>
    </div>
  )
}

export function ContactsOwnershipDrawer({ open, onOpenChange, data, projectId, onSave }: Props) {
  const { users: availableUsers, loading: usersLoading } = useProjectUsers(projectId)

  const [draft, setDraft] = useState({ boUserId: '', tlUserId: '', dbaUserId: '' })

  useEffect(() => {
    if (open) {
      setDraft({
        boUserId:  data?.businessOwnerId  ?? '',
        tlUserId:  data?.technicalLeadId  ?? '',
        dbaUserId: data?.dbaDataOwnerId   ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      applicationName:  data?.applicationName ?? '',
      businessOwnerId:  draft.boUserId  || undefined,
      technicalLeadId:  draft.tlUserId  || undefined,
      dbaDataOwnerId:   draft.dbaUserId || undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Contacts & Ownership"
      onSave={handleSave}
    >
      <p className={sectionLabel}>Business Owner</p>
      <div className="space-y-1.5">
        <Label>User</Label>
        <Select value={draft.boUserId} onValueChange={(v) => setDraft(d => ({ ...d, boUserId: v }))}>
          <SelectTrigger disabled={usersLoading}><SelectValue placeholder={usersLoading ? 'Loading users…' : 'Select a user…'} /></SelectTrigger>
          <SelectContent>
            {availableUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.boUserId && <UserPreview userId={draft.boUserId} users={availableUsers} />}
      </div>

      <p className={sectionLabel}>Technical Lead</p>
      <div className="space-y-1.5">
        <Label>User</Label>
        <Select value={draft.tlUserId} onValueChange={(v) => setDraft(d => ({ ...d, tlUserId: v }))}>
          <SelectTrigger disabled={usersLoading}><SelectValue placeholder={usersLoading ? 'Loading users…' : 'Select a user…'} /></SelectTrigger>
          <SelectContent>
            {availableUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.tlUserId && <UserPreview userId={draft.tlUserId} users={availableUsers} />}
      </div>

      <p className={sectionLabel}>DBA / Data Owner</p>
      <div className="space-y-1.5">
        <Label>User</Label>
        <Select value={draft.dbaUserId} onValueChange={(v) => setDraft(d => ({ ...d, dbaUserId: v }))}>
          <SelectTrigger disabled={usersLoading}><SelectValue placeholder={usersLoading ? 'Loading users…' : 'Select a user…'} /></SelectTrigger>
          <SelectContent>
            {availableUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.dbaUserId && <UserPreview userId={draft.dbaUserId} users={availableUsers} />}
      </div>
    </SectionEditDrawer>
  )
}
