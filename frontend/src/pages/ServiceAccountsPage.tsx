import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Key,
  Copy,
  Check,
} from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useServiceAccounts } from '@/hooks/use-service-accounts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { ServiceAccount, ServiceAccountCreate, ServiceAccountUpdate } from '@/types/serviceAccount'

export function ServiceAccountsPage() {
  const navigate = useNavigate()
  const {
    serviceAccounts,
    loading,
    error,
    createServiceAccount,
    updateServiceAccount,
    deleteServiceAccount,
    resetServiceAccountToken,
  } = useServiceAccounts()

  const [formOpen, setFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<ServiceAccount | undefined>(undefined)
  const [formData, setFormData] = useState<ServiceAccountCreate>({ name: '', email: '', department: '', is_admin: false })
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ServiceAccount | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)

  const [resetTarget, setResetTarget] = useState<ServiceAccount | undefined>(undefined)
  const [resetting, setResetting] = useState(false)

  const [revealedKey, setRevealedKey] = useState<{ name: string; api_key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const openNew = () => {
    setEditingAccount(undefined)
    setFormData({ name: '', email: '', department: '', is_admin: false })
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (account: ServiceAccount) => {
    setEditingAccount(account)
    setFormData({ name: account.name, email: account.email, department: account.department, is_admin: account.is_admin })
    setFormError(null)
    setFormOpen(true)
  }

  const handleFormSave = async () => {
    if (!formData.name.trim()) { setFormError('Name is required.'); return }
    if (!formData.email.trim()) { setFormError('Email is required.'); return }
    if (!formData.department.trim()) { setFormError('Department is required.'); return }
    setFormError(null)
    setFormSaving(true)
    try {
      if (editingAccount) {
        const patch: ServiceAccountUpdate = {}
        if (formData.name !== editingAccount.name) patch.name = formData.name
        if (formData.email !== editingAccount.email) patch.email = formData.email
        if (formData.department !== editingAccount.department) patch.department = formData.department
        if (formData.is_admin !== editingAccount.is_admin) patch.is_admin = formData.is_admin
        if (Object.keys(patch).length > 0) {
          await updateServiceAccount(editingAccount.id, patch)
          toast.success('Service account updated')
        }
        setFormOpen(false)
      } else {
        const created = await createServiceAccount(formData)
        toast.success('Service account created')
        setFormOpen(false)
        setRevealedKey({ name: created.name, api_key: created.api_key })
      }
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
      await deleteServiceAccount(deleteTarget.id)
      toast.success('Service account deleted')
      setDeleteTarget(undefined)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete. Please try again.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleResetConfirm = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      const result = await resetServiceAccountToken(resetTarget.id)
      toast.success('Token reset')
      setResetTarget(undefined)
      setRevealedKey({ name: resetTarget.name, api_key: result.api_key })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset token. Please try again.'
      toast.error(msg)
    } finally {
      setResetting(false)
    }
  }

  const handleCopyKey = async () => {
    if (!revealedKey) return
    await navigator.clipboard.writeText(revealedKey.api_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <BreadcrumbPage>Service Accounts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Key className="size-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">Service Accounts</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage machine-to-machine API accounts.
            </p>
          </div>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="size-4" />
            New Service Account
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Email</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Department</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Initials</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Admin</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : serviceAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                    No service accounts found.
                  </TableCell>
                </TableRow>
              ) : (
                serviceAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{account.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{account.department}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{account.initials}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{account.is_admin ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEdit(account)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setResetTarget(account)}
                          title="Reset Token"
                        >
                          <KeyRound className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(account)}
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Service Account' : 'New Service Account'}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update the service account details.'
                : 'Create a new machine-to-machine API account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="sa-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="sa-name"
                value={formData.name}
                onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Jenkins CI"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="sa-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                placeholder="e.g. ci@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-department">Department <span className="text-destructive">*</span></Label>
              <Input
                id="sa-department"
                value={formData.department}
                onChange={(e) => setFormData((d) => ({ ...d, department: e.target.value }))}
                placeholder="e.g. Platform Engineering"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="sa-admin"
                checked={formData.is_admin ?? false}
                onCheckedChange={(checked) => setFormData((d) => ({ ...d, is_admin: checked === true }))}
              />
              <Label htmlFor="sa-admin" className="text-sm font-normal cursor-pointer">
                Admin role
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSaving}>
              Cancel
            </Button>
            <Button onClick={handleFormSave} disabled={formSaving}>
              {formSaving ? 'Saving…' : editingAccount ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(undefined) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone.
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

      {/* Reset Token Confirmation */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) setResetTarget(undefined) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset API Token</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset the API token for{' '}
              <span className="font-semibold">{resetTarget?.name}</span>?
              The old token will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(undefined)} disabled={resetting}>
              Cancel
            </Button>
            <Button onClick={handleResetConfirm} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revealed API Key */}
      <Dialog open={!!revealedKey} onOpenChange={(open) => { if (!open) setRevealedKey(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Copy this API key now. You will not be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Account</p>
              <p className="text-sm font-medium">{revealedKey?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                {revealedKey?.api_key}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyKey} className="shrink-0">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
