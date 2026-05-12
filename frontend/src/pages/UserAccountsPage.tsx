import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Pencil,
  Trash2,
  Users,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useAdminUsers } from '@/hooks/use-admin-users'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  getProjects,
  getProject,
  updateGovernanceRoles,
} from '@/services/projects'
import { getAllUserProjectRoles } from '@/services/adminUsers'
import type { User } from '@/types'
import type { UserAdminUpdate, UserProjectRole } from '@/services/adminUsers'
import type { Project } from '@/types'

const GOVERNANCE_ROLES = [
  { value: 'technical_lead', label: 'Technical Lead' },
  { value: 'business_owner', label: 'Business Owner' },
  { value: 'dba_data_owner', label: 'DBA Data Owner' },
]

function formatProjectRoleSummary(roles: UserProjectRole[]): string {
  const gov = roles
    .flatMap((r) =>
      r.roles
        .filter((role) => GOVERNANCE_ROLES.some((g) => g.value === role))
        .map((role) => {
          const label = GOVERNANCE_ROLES.find((g) => g.value === role)?.label ?? role
          return `${label}: ${r.project_name}`
        }),
    )
  if (gov.length === 0) {
    const count = roles.length
    return count > 0 ? `${count} project${count > 1 ? 's' : ''}` : '—'
  }
  return gov.join(', ')
}

function buildProjectTooltip(roles: UserProjectRole[]): React.ReactNode {
  if (roles.length === 0) return 'No project assignments'
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {roles.map((r) => (
        <li key={r.project_id}>{r.project_name}</li>
      ))}
    </ul>
  )
}

export function UserAccountsPage() {
  const navigate = useNavigate()
  const { users, loading, error, updateUser, deleteUser } = useAdminUsers()

  const [allProjectRoles, setAllProjectRoles] = useState<UserProjectRole[]>([])
  const [projectRolesLoading, setProjectRolesLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined)
  const [formData, setFormData] = useState<UserAdminUpdate>({})
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<User | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)

  // Project governance role editing state
  const [userProjectRoles, setUserProjectRoles] = useState<UserProjectRole[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedGovRole, setSelectedGovRole] = useState<string>('')
  const [govRoleSaving, setGovRoleSaving] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)

  // Reassign confirmation state
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false)
  const [reassignTarget, setReassignTarget] = useState<{
    projectName: string
    roleLabel: string
    currentUserName: string
  } | null>(null)

  // Filter and pagination
  const [filterText, setFilterText] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filteredUsers = useMemo(() => {
    const term = filterText.trim().toLowerCase()
    if (!term) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term),
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

  useEffect(() => {
    let cancelled = false
    getAllUserProjectRoles()
      .then((data) => {
        if (!cancelled) {
          setAllProjectRoles(data)
          setProjectRolesLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setProjectRolesLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const userProjectRolesMap = useMemo(() => {
    const map = new Map<string, UserProjectRole[]>()
    for (const r of allProjectRoles) {
      const list = map.get(r.user_id) ?? []
      list.push(r)
      map.set(r.user_id, list)
    }
    return map
  }, [allProjectRoles])

  const openEdit = async (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      department: user.department,
      team: user.team,
      role: user.role.join(', '),
    })
    setFormError(null)
    setFormOpen(true)

    // Load project roles for this user and all projects for the dropdown
    const userRoles = userProjectRolesMap.get(user.id) ?? []
    setUserProjectRoles(userRoles)
    setSelectedProjectId('')
    setSelectedGovRole('')

    try {
      const projects = await getProjects()
      setAllProjects(projects)
    } catch {
      // ignore; dropdown will be empty
    }
  }

  const handleFormSave = async () => {
    if (!formData.name?.trim()) { setFormError('Name is required.'); return }
    if (!formData.email?.trim()) { setFormError('Email is required.'); return }
    if (!formData.department?.trim()) { setFormError('Department is required.'); return }
    setFormError(null)
    setFormSaving(true)
    try {
      const patch: UserAdminUpdate = {}
      if (formData.name !== editingUser?.name) patch.name = formData.name
      if (formData.email !== editingUser?.email) patch.email = formData.email
      if (formData.department !== editingUser?.department) patch.department = formData.department
      if (formData.team !== editingUser?.team) patch.team = formData.team
      const roleString = formData.role?.trim()
      const currentRoleString = editingUser?.role.join(', ')
      if (roleString !== currentRoleString) patch.role = roleString
      if (Object.keys(patch).length > 0) {
        await updateUser(editingUser!.id, patch)
        toast.success('User updated')
      }
      setFormOpen(false)
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
      await deleteUser(deleteTarget.id)
      toast.success('User deleted')
      setDeleteTarget(undefined)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete. Please try again.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const doAssignGovRole = async () => {
    if (!selectedProjectId || !selectedGovRole || !editingUser) return
    try {
      const project = await getProject(selectedProjectId)
      if (!project) throw new Error('Project not found')

      const payload: {
        technicalLeadId?: string
        businessOwnerId?: string
        dbaDataOwnerId?: string
      } = {
        technicalLeadId: project.governanceRoles?.technicalLead?.id,
        businessOwnerId: project.governanceRoles?.businessOwner?.id,
        dbaDataOwnerId: project.governanceRoles?.dbaDataOwner?.id,
      }

      if (selectedGovRole === 'technical_lead') payload.technicalLeadId = editingUser.id
      if (selectedGovRole === 'business_owner') payload.businessOwnerId = editingUser.id
      if (selectedGovRole === 'dba_data_owner') payload.dbaDataOwnerId = editingUser.id

      await updateGovernanceRoles(selectedProjectId, payload)
      toast.success('Governance role assigned')

      const refreshed = await getAllUserProjectRoles()
      setAllProjectRoles(refreshed)
      setUserProjectRoles(refreshed.filter((r) => r.user_id === editingUser.id))
      setSelectedProjectId('')
      setSelectedGovRole('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign governance role.'
      toast.error(msg)
    }
  }

  const handleAssignGovRole = async () => {
    if (!selectedProjectId || !selectedGovRole || !editingUser) return
    setGovRoleSaving(true)
    try {
      await doAssignGovRole()
    } finally {
      setGovRoleSaving(false)
    }
  }

  const onClickAssign = () => {
    if (!selectedProjectId || !selectedGovRole || !editingUser) return

    const existing = allProjectRoles.find(
      (r) => r.project_id === selectedProjectId && r.roles.includes(selectedGovRole) && r.user_id !== editingUser.id,
    )

    if (existing) {
      const currentUser = users.find((u) => u.id === existing.user_id)
      const roleLabel = GOVERNANCE_ROLES.find((g) => g.value === selectedGovRole)?.label ?? selectedGovRole
      const projectName = allProjects.find((p) => p.id === selectedProjectId)?.name ?? selectedProjectId
      setReassignTarget({
        projectName,
        roleLabel,
        currentUserName: currentUser?.name ?? existing.user_id,
      })
      setReassignConfirmOpen(true)
      return
    }

    handleAssignGovRole()
  }

  const handleRemoveGovRole = async (projectId: string, role: string) => {
    if (!editingUser) return
    setGovRoleSaving(true)
    try {
      const project = await getProject(projectId)
      if (!project) throw new Error('Project not found')

      const payload: {
        technicalLeadId?: string
        businessOwnerId?: string
        dbaDataOwnerId?: string
      } = {
        technicalLeadId: project.governanceRoles?.technicalLead?.id,
        businessOwnerId: project.governanceRoles?.businessOwner?.id,
        dbaDataOwnerId: project.governanceRoles?.dbaDataOwner?.id,
      }

      // Clear only the specific role for this user
      if (role === 'technical_lead' && payload.technicalLeadId === editingUser.id) {
        delete payload.technicalLeadId
      }
      if (role === 'business_owner' && payload.businessOwnerId === editingUser.id) {
        delete payload.businessOwnerId
      }
      if (role === 'dba_data_owner' && payload.dbaDataOwnerId === editingUser.id) {
        delete payload.dbaDataOwnerId
      }

      await updateGovernanceRoles(projectId, payload)
      toast.success('Governance role removed')

      const refreshed = await getAllUserProjectRoles()
      setAllProjectRoles(refreshed)
      setUserProjectRoles(refreshed.filter((r) => r.user_id === editingUser.id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove governance role.'
      toast.error(msg)
    } finally {
      setGovRoleSaving(false)
    }
  }

  const availableProjectsForAssignment = useMemo(() => {
    // Projects where this user does NOT already have the selected governance role
    const userProjRoleSet = new Set(
      userProjectRoles
        .filter((r) => r.roles.includes(selectedGovRole))
        .map((r) => r.project_id),
    )
    return allProjects.filter((p) => !userProjRoleSet.has(p.id))
  }, [allProjects, userProjectRoles, selectedGovRole])

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
            <BreadcrumbPage>User Accounts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">User Accounts</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage human user accounts across the platform.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name or user ID..."
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
                <TableHead className="font-bold text-xs uppercase tracking-wider">Team</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Initials</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Roles</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Projects</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || projectRolesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => {
                  const projRoles = userProjectRolesMap.get(user.id) ?? []
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.department}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.team || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.initials}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.role.join(', ') || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default truncate block">
                                {formatProjectRoleSummary(projRoles)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-sm">
                              {buildProjectTooltip(projRoles)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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

      {/* Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user&apos;s details and governance role assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Profile</h3>
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="user-name"
                  value={formData.name ?? ''}
                  onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formData.email ?? ''}
                  onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                  placeholder="e.g. jane@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-department">Department <span className="text-destructive">*</span></Label>
                <Input
                  id="user-department"
                  value={formData.department ?? ''}
                  onChange={(e) => setFormData((d) => ({ ...d, department: e.target.value }))}
                  placeholder="e.g. Platform Engineering"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-team">Team</Label>
                <Input
                  id="user-team"
                  value={formData.team ?? ''}
                  onChange={(e) => setFormData((d) => ({ ...d, team: e.target.value }))}
                  placeholder="e.g. SRE"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-role">Roles</Label>
                <Input
                  id="user-role"
                  value={formData.role ?? ''}
                  onChange={(e) => setFormData((d) => ({ ...d, role: e.target.value }))}
                  placeholder="e.g. admin, platform_migration_lead"
                />
                <p className="text-xs text-muted-foreground">Comma-separated list of roles.</p>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Project Governance Roles</h3>

              {/* Assignment row on top */}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Project</Label>
                  <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {selectedProjectId
                          ? allProjects.find((p) => p.id === selectedProjectId)?.name ?? 'Select project'
                          : 'Select project'}
                        <ChevronDown className="size-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="border-b border-border p-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            placeholder="Search projects..."
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1">
                        {availableProjectsForAssignment.filter((p) =>
                          p.name.toLowerCase().includes(projectSearch.toLowerCase()),
                        ).length === 0 ? (
                          <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                            No projects found.
                          </p>
                        ) : (
                          availableProjectsForAssignment
                            .filter((p) =>
                              p.name.toLowerCase().includes(projectSearch.toLowerCase()),
                            )
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setSelectedProjectId(p.id)
                                  setProjectPopoverOpen(false)
                                  setProjectSearch('')
                                }}
                                className={cn(
                                  'w-full text-left px-2 py-1.5 rounded-sm text-sm',
                                  selectedProjectId === p.id
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-muted',
                                )}
                              >
                                {p.name}
                              </button>
                            ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="gov-role">Governance Role</Label>
                  <Select value={selectedGovRole} onValueChange={setSelectedGovRole}>
                    <SelectTrigger id="gov-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {GOVERNANCE_ROLES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={onClickAssign}
                  disabled={!selectedProjectId || !selectedGovRole || govRoleSaving}
                  className="gap-1"
                >
                  <Plus className="size-4" />
                  Assign
                </Button>
              </div>

              <div className="space-y-2">
                {userProjectRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No project assignments.</p>
                ) : (
                  userProjectRoles.map((upr) => (
                    <div key={upr.project_id} className="space-y-1">
                      {upr.roles
                        .filter((role) => GOVERNANCE_ROLES.some((g) => g.value === role))
                        .map((role) => {
                          const label = GOVERNANCE_ROLES.find((g) => g.value === role)?.label ?? role
                          return (
                            <div
                              key={`${upr.project_id}-${role}`}
                              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                            >
                              <div className="text-sm">
                                <span className="font-medium">{upr.project_name}</span>
                                <span className="text-muted-foreground"> — {label}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveGovRole(upr.project_id, role)}
                                disabled={govRoleSaving}
                                title="Remove"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSaving}>
              Cancel
            </Button>
            <Button onClick={handleFormSave} disabled={formSaving}>
              {formSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Confirmation */}
      <Dialog open={reassignConfirmOpen} onOpenChange={(open) => { if (!open) { setReassignConfirmOpen(false); setReassignTarget(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Governance Role</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{reassignTarget?.roleLabel}</span> for{' '}
              <span className="font-semibold">{reassignTarget?.projectName}</span> is already assigned to{' '}
              <span className="font-semibold">{reassignTarget?.currentUserName}</span>.
              Are you sure you want to reassign this role to{' '}
              <span className="font-semibold">{editingUser?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignConfirmOpen(false); setReassignTarget(null) }} disabled={govRoleSaving}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setReassignConfirmOpen(false)
                setReassignTarget(null)
                await handleAssignGovRole()
              }}
              disabled={govRoleSaving}
            >
              {govRoleSaving ? 'Reassigning…' : 'Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(undefined) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone and will remove all project associations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(undefined)} disabled={deleting}>
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
