import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  Building2,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getBgiCloudLeads,
  createBgiCloudLead,
  updateBgiCloudLead,
  deleteBgiCloudLead,
  getAdminUsers,
} from '@/services/adminUsers'
import { getBgiHierarchy } from '@/services/bgi'
import type { User } from '@/types'
import type { BgiNode } from '@/types/bgi'
import type { BgiCloudLeadCreate } from '@/services/adminUsers'
import { BgiTree } from '@/components/bgi/BgiTree'
import { filterBgiTree } from '@/lib/bgi-utils'
import { cn } from '@/lib/utils'

function findNodeById(node: BgiNode, id: string): BgiNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

function getNodeLabel(node: BgiNode): string {
  return `${node.id} — ${node.name}`
}

export function BgiCloudLeadsPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [bgiRoot, setBgiRoot] = useState<BgiNode | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<Partial<BgiCloudLeadCreate>>({ bgi_ids: [] })
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [filterText, setFilterText] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [bgiPopoverOpen, setBgiPopoverOpen] = useState(false)
  const [bgiSearch, setBgiSearch] = useState('')

  // Create mode: 'new' | 'existing'
  const [createMode, setCreateMode] = useState<'new' | 'existing'>('existing')
  const [selectedExistingUser, setSelectedExistingUser] = useState<User | null>(null)
  const [userPopoverOpen, setUserPopoverOpen] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [leads, hierarchy, all] = await Promise.all([
        getBgiCloudLeads(),
        getBgiHierarchy(),
        getAdminUsers(),
      ])
      setUsers(leads)
      setBgiRoot(hierarchy)
      setAllUsers(all)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredUsers = useMemo(() => {
    const term = filterText.trim().toLowerCase()
    if (!term) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
    )
  }, [users, filterText])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, page])

  useEffect(() => {
    setPage(1)
  }, [filterText])

  // Users who are NOT already bgi_cloud_leads
  const eligibleUsers = useMemo(() => {
    const bgiLeadIds = new Set(users.map((u) => u.id))
    return allUsers.filter((u) => !bgiLeadIds.has(u.id))
  }, [allUsers, users])

  const filteredEligibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    if (!term) return eligibleUsers
    return eligibleUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
    )
  }, [eligibleUsers, userSearch])

  const openCreate = () => {
    setEditingUser(null)
    setCreateMode('existing')
    setSelectedExistingUser(null)
    setFormData({ id: '', name: '', email: '', department: '', team: '', bgi_ids: [] })
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      department: user.department,
      team: user.team,
      bgi_ids: user.bgi_ids ?? [],
    })
    setFormError(null)
    setFormOpen(true)
  }

  const handleFormSave = async () => {
    setFormError(null)

    // Edit mode
    if (editingUser) {
      if (!formData.name?.trim()) { setFormError('Name is required.'); return }
      if (!formData.email?.trim()) { setFormError('Email is required.'); return }
      if (!formData.department?.trim()) { setFormError('Department is required.'); return }

      setFormSaving(true)
      try {
        await updateBgiCloudLead(editingUser.id, {
          name: formData.name,
          email: formData.email,
          department: formData.department,
          team: formData.team,
          bgi_ids: formData.bgi_ids ?? [],
        })
        toast.success('User updated')
        setFormOpen(false)
        await loadData()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.'
        setFormError(msg)
      } finally {
        setFormSaving(false)
      }
      return
    }

    // Create mode
    if (createMode === 'existing') {
      if (!selectedExistingUser) {
        setFormError('Please select an existing user.')
        return
      }
      setFormSaving(true)
      try {
        await createBgiCloudLead({
          name: selectedExistingUser.name,
          email: selectedExistingUser.email,
          department: selectedExistingUser.department,
          team: selectedExistingUser.team,
          bgi_ids: formData.bgi_ids ?? [],
        })
        toast.success('Existing user assigned as BGI Cloud Lead')
        setFormOpen(false)
        await loadData()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to assign user. Please try again.'
        setFormError(msg)
      } finally {
        setFormSaving(false)
      }
      return
    }

    // createMode === 'new'
    if (!formData.id?.trim()) { setFormError('User ID is required.'); return }
    if (!formData.name?.trim()) { setFormError('Name is required.'); return }
    if (!formData.email?.trim()) { setFormError('Email is required.'); return }
    if (!formData.department?.trim()) { setFormError('Department is required.'); return }

    setFormSaving(true)
    try {
      await createBgiCloudLead({
        id: formData.id,
        name: formData.name,
        email: formData.email,
        department: formData.department,
        team: formData.team,
        bgi_ids: formData.bgi_ids ?? [],
      })
      toast.success('User created')
      setFormOpen(false)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      setFormError(msg)
    } finally {
      setFormSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBgiCloudLead(deleteTarget.id)
      toast.success('User deleted')
      setDeleteTarget(null)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete. Please try again.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const selectedBgiIds = useMemo(() => new Set(formData.bgi_ids ?? []), [formData.bgi_ids])

  const filteredBgiRoot = useMemo(() => {
    if (!bgiRoot) return null
    const filtered = filterBgiTree([bgiRoot], bgiSearch)
    return filtered[0] ?? null
  }, [bgiRoot, bgiSearch])

  const toggleBgiId = (nodeId: string) => {
    setFormData((d) => {
      const current = d.bgi_ids ?? []
      if (current.includes(nodeId)) {
        return { ...d, bgi_ids: current.filter((id) => id !== nodeId) }
      }
      return { ...d, bgi_ids: [...current, nodeId] }
    })
  }

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
            <BreadcrumbPage>BGI Cloud Leads</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="size-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">BGI Cloud Leads</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage users who can view projects within a BGI subtree.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-1">
            <Plus className="size-4" />
            Assign User
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name or email…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Email</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Department</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Assigned BGI</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => {
                  const assignedNodes = (user.bgi_ids ?? [])
                    .map((id) => (bgiRoot ? findNodeById(bgiRoot, id) : null))
                    .filter(Boolean) as BgiNode[]
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.department}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignedNodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedNodes.map((node) => (
                              <Badge key={node.id} variant="secondary" className="text-xs">
                                {getNodeLabel(node)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(user)}
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(user)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="gap-1"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit BGI Cloud Lead' : 'Assign BGI Cloud Lead'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update the user details and BGI assignments.'
                : 'Select an existing user or create a new one and assign BGI nodes.'}
            </DialogDescription>
          </DialogHeader>

          {!editingUser && (
            <div className="flex rounded-lg border border-border p-1 bg-muted/30">
              <button
                type="button"
                onClick={() => setCreateMode('existing')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors',
                  createMode === 'existing'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Users className="size-3.5" />
                Select Existing
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('new')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-medium rounded-md transition-colors',
                  createMode === 'new'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <UserPlus className="size-3.5" />
                Create New
              </button>
            </div>
          )}

          <div className="space-y-4 py-2 min-h-[320px]">
            {formError && <p className="text-sm text-destructive">{formError}</p>}

            {/* Existing user selection */}
            {!editingUser && createMode === 'existing' && (
              <div className="space-y-1.5">
                <Label>
                  User <span className="text-destructive">*</span>
                </Label>
                <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {selectedExistingUser
                        ? `${selectedExistingUser.name} (${selectedExistingUser.email})`
                        : 'Select user'}
                      <ChevronDown className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-80 p-0 overflow-hidden"
                    align="start"
                    onWheelCapture={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-border p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users…"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
                      {filteredEligibleUsers.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                          {userSearch.trim()
                            ? 'No matching users found.'
                            : 'All users are already assigned.'}
                        </p>
                      ) : (
                        filteredEligibleUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setSelectedExistingUser(u)
                              setUserPopoverOpen(false)
                              setUserSearch('')
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-muted"
                          >
                            <span className="font-medium">{u.name}</span>
                            <span className="text-muted-foreground ml-1.5 text-xs">
                              {u.email}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Existing user read-only info */}
            {!editingUser && createMode === 'existing' && selectedExistingUser && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                <div className="text-sm">
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-medium">{selectedExistingUser.email}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Department:</span>{' '}
                  {selectedExistingUser.department}
                </div>
                {selectedExistingUser.team && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Team:</span>{' '}
                    {selectedExistingUser.team}
                  </div>
                )}
              </div>
            )}

            {/* New user fields */}
            {(editingUser || createMode === 'new') && (
              <>
                {!editingUser && (
                  <div className="space-y-1.5">
                    <Label htmlFor="gl-id">
                      User ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gl-id"
                      value={formData.id ?? ''}
                      onChange={(e) => setFormData((d) => ({ ...d, id: e.target.value }))}
                      placeholder="e.g. u12345"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="gl-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gl-name"
                    value={formData.name ?? ''}
                    onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Bob Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gl-email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                    placeholder="e.g. bob@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-dept">
                    Department <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gl-dept"
                    value={formData.department ?? ''}
                    onChange={(e) => setFormData((d) => ({ ...d, department: e.target.value }))}
                    placeholder="e.g. Cloud Engineering"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-team">Team</Label>
                  <Input
                    id="gl-team"
                    value={formData.team ?? ''}
                    onChange={(e) => setFormData((d) => ({ ...d, team: e.target.value }))}
                    placeholder="e.g. SRE"
                  />
                </div>
              </>
            )}

            {/* BGI assignment */}
            <div className="space-y-1.5">
              <Label>Assigned BGI</Label>
              <Popover open={bgiPopoverOpen} onOpenChange={setBgiPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {selectedBgiIds.size === 0
                      ? 'Select BGI nodes'
                      : `${selectedBgiIds.size} node${selectedBgiIds.size !== 1 ? 's' : ''} selected`}
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 overflow-hidden"
                  align="start"
                  onWheelCapture={(e) => e.stopPropagation()}
                >
                  <div className="border-b border-border p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search BGI nodes…"
                        value={bgiSearch}
                        onChange={(e) => setBgiSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
                    {filteredBgiRoot ? (
                      <BgiTree
                        nodes={[filteredBgiRoot]}
                        selectedIds={selectedBgiIds}
                        excludedIds={new Set()}
                        onSelect={(node, action) => {
                          if (action === 'select' || action === 'unselect') {
                            toggleBgiId(node.id)
                          }
                        }}
                        readOnly
                        checkable
                      />
                    ) : (
                      <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                        No nodes found.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedBgiIds.size > 0 && bgiRoot && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {Array.from(selectedBgiIds).map((id) => {
                    const node = findNodeById(bgiRoot, id)
                    if (!node) return null
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {getNodeLabel(node)}
                        <button
                          type="button"
                          onClick={() => toggleBgiId(id)}
                          className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSaving}>
              Cancel
            </Button>
            <Button onClick={handleFormSave} disabled={formSaving}>
              {formSaving
                ? 'Saving…'
                : editingUser
                  ? 'Save Changes'
                  : createMode === 'existing'
                    ? 'Assign User'
                    : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
