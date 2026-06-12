import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Upload, Plus, Search } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BgiTree } from '@/components/bgi/BgiTree'
import { getBgiHierarchy, setBgiHierarchy, assignProjectsToBgi, unassignProjectsFromBgi } from '@/services/bgi'
import { getProjects } from '@/services/projects'
import { getMigrationSettings, saveMigrationSettings } from '@/services/migrationSettings'
import type { BgiNode } from '@/types/bgi'
import type { Project } from '@/types'

function findNodeById(node: BgiNode, id: string): BgiNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

function removeNodeById(node: BgiNode, id: string): BgiNode | null {
  if (!node.children) return node
  const filtered = node.children
    .map((c) => removeNodeById(c, id))
    .filter(Boolean) as BgiNode[]
  return { ...node, children: filtered.length ? filtered : undefined }
}

function addChildToNode(node: BgiNode, parentId: string, child: BgiNode): BgiNode {
  if (node.id === parentId) {
    return { ...node, children: [...(node.children ?? []), child] }
  }
  return {
    ...node,
    children: node.children?.map((c) => addChildToNode(c, parentId, child)),
  }
}

function renameNode(node: BgiNode, nodeId: string, newName: string): BgiNode {
  if (node.id === nodeId) return { ...node, name: newName }
  return {
    ...node,
    children: node.children?.map((c) => renameNode(c, nodeId, newName)),
  }
}

function collectAllIds(node: BgiNode): string[] {
  return [node.id, ...(node.children?.flatMap(collectAllIds) ?? [])]
}

function getTreeDepth(node: BgiNode): number {
  if (!node.children || node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(getTreeDepth))
}

export function BgiSettingsPage() {
  const navigate = useNavigate()
  const [root, setRoot] = useState<BgiNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectSearch, setProjectSearch] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Tier depth display setting (platform-wide)
  const [tierDepth, setTierDepth] = useState<string>('all')
  const [savingTierDepth, setSavingTierDepth] = useState(false)

  const actualMaxDepth = useMemo(() => {
    if (!root) return 0
    return getTreeDepth(root)
  }, [root])

  // Load platform tier depth setting
  useEffect(() => {
    getMigrationSettings()
      .then((settings) => {
        setTierDepth(settings.bgiTierDepth != null ? String(settings.bgiTierDepth) : 'all')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tierDepth !== 'all' && actualMaxDepth > 0 && Number(tierDepth) > actualMaxDepth) {
      setTierDepth('all')
    }
  }, [actualMaxDepth, tierDepth])

  // Create node dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [newNodeId, setNewNodeId] = useState('')
  const [newNodeName, setNewNodeName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteTargetName, setDeleteTargetName] = useState<string>('')
  const [deleting, setDeleting] = useState(false)

  const allIds = useMemo(() => {
    if (!root) return new Set<string>()
    return new Set(collectAllIds(root))
  }, [root])

  useEffect(() => {
    getBgiHierarchy()
      .then((data) => setRoot(data))
      .catch(() => toast.error('Failed to load BGI hierarchy'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    getProjects(['basic'])
      .then(setProjects)
      .catch(() => {})
  }, [])

  const selectedNode = useMemo(() => {
    if (!root || !selectedId) return null
    return findNodeById(root, selectedId)
  }, [root, selectedId])

  const selectedDescendantIds = useMemo(() => {
    if (!selectedNode) return new Set<string>()
    return new Set(collectAllIds(selectedNode))
  }, [selectedNode])

  const filteredProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase()
    if (!term) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(term))
  }, [projects, projectSearch])

  const handleImportJson = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text) as BgiNode
        setRoot(data)
        await setBgiHierarchy(data)
        toast.success('BGI hierarchy imported')
      } catch {
        toast.error('Invalid JSON file')
      }
    }
    input.click()
  }, [])

  const handleSaveHierarchy = useCallback(async () => {
    if (!root) return
    setSaving(true)
    try {
      await setBgiHierarchy(root)
      toast.success('BGI hierarchy saved')
    } catch {
      toast.error('Failed to save BGI hierarchy')
    } finally {
      setSaving(false)
    }
  }, [root])

  const handleTierDepthChange = useCallback(async (value: string) => {
    setTierDepth(value)
    setSavingTierDepth(true)
    try {
      const settings = await getMigrationSettings()
      const updated = await saveMigrationSettings({
        ...settings,
        bgiTierDepth: value === 'all' ? undefined : Number(value),
      })
      setTierDepth(updated.bgiTierDepth != null ? String(updated.bgiTierDepth) : 'all')
      toast.success('Tier depth setting saved')
    } catch {
      toast.error('Failed to save tier depth setting')
    } finally {
      setSavingTierDepth(false)
    }
  }, [])

  const openCreateDialog = useCallback((parentId: string | null) => {
    setCreateParentId(parentId)
    setNewNodeId('')
    setNewNodeName('')
    setCreateError(null)
    setCreateDialogOpen(true)
  }, [])

  const handleConfirmCreate = useCallback(() => {
    const id = newNodeId.trim()
    const name = newNodeName.trim()

    if (!id) {
      setCreateError('ID is required.')
      return
    }
    if (!name) {
      setCreateError('Name is required.')
      return
    }
    if (allIds.has(id)) {
      setCreateError(`ID "${id}" already exists. Please choose a unique ID.`)
      return
    }

    const newNode: BgiNode = { id, name }

    if (!createParentId) {
      // Add root
      if (!root) {
        setRoot(newNode)
      } else {
        setRoot({ ...root, children: [...(root.children ?? []), newNode] })
      }
    } else {
      if (!root) return
      setRoot(addChildToNode(root, createParentId, newNode))
    }

    setCreateDialogOpen(false)
    setNewNodeId('')
    setNewNodeName('')
    setCreateError(null)
  }, [createParentId, newNodeId, newNodeName, root, allIds])

  const handleAddRoot = useCallback(() => {
    openCreateDialog(null)
  }, [openCreateDialog])

  const handleAddChild = useCallback(
    (parentId: string) => {
      openCreateDialog(parentId)
    },
    [openCreateDialog]
  )

  const handleDeletePrompt = useCallback(
    (nodeId: string) => {
      if (!root) return
      const node = findNodeById(root, nodeId)
      if (!node) return
      setDeleteTargetId(nodeId)
      setDeleteTargetName(node.name)
      setDeleteDialogOpen(true)
    },
    [root]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!root || !deleteTargetId) return
    setDeleting(true)

    try {
      // Find all descendant IDs of the node being deleted
      const targetNode = findNodeById(root, deleteTargetId)
      const idsToClear = targetNode ? collectAllIds(targetNode) : [deleteTargetId]

      // Unassign any projects linked to this node or its descendants
      const projectIdsToClear = projects
        .filter((p) => p.bgi_id && idsToClear.includes(p.bgi_id))
        .map((p) => p.id)

      if (projectIdsToClear.length > 0) {
        await unassignProjectsFromBgi(projectIdsToClear)
      }

      // Remove node from tree
      if (root.id === deleteTargetId) {
        setRoot(null)
        setSelectedId(null)
      } else {
        const updated = removeNodeById(root, deleteTargetId)
        if (updated) {
          setRoot(updated)
          if (selectedId === deleteTargetId) setSelectedId(null)
        }
      }

      // Refresh projects list to reflect unassignments
      const refreshed = await getProjects(['basic'])
      setProjects(refreshed)

      toast.success('Node deleted and projects unassigned')
    } catch {
      toast.error('Failed to delete node')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteTargetId(null)
      setDeleteTargetName('')
    }
  }, [root, deleteTargetId, projects, selectedId])

  const handleRename = useCallback(
    (nodeId: string, newName: string) => {
      if (!root) return
      setRoot(renameNode(root, nodeId, newName))
    },
    [root]
  )

  const handleToggleProject = useCallback(
    async (projectId: string, checked: boolean) => {
      if (!selectedId) return
      setAssigning(true)
      try {
        if (checked) {
          await assignProjectsToBgi(selectedId, [projectId])
        } else {
          await unassignProjectsFromBgi([projectId])
        }
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, bgi_id: checked ? selectedId : undefined } : p))
        )
        toast.success(checked ? 'Project assigned' : 'Project unassigned')
      } catch {
        toast.error('Failed to update assignment')
      } finally {
        setAssigning(false)
      }
    },
    [selectedId]
  )

  const assignedCount = useMemo(
    () => projects.filter((p) => selectedDescendantIds.has(p.bgi_id ?? '')).length,
    [projects, selectedDescendantIds]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6 overflow-hidden max-h-[calc(100dvh-6rem)]">
      <Breadcrumb className="shrink-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/settings')} className="cursor-pointer">
              Settings
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>BGI Hierarchy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">BGI Hierarchy</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage the organizational structure and link projects to tiers.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Button variant="outline" onClick={handleImportJson}>
          <Upload className="size-4 mr-1.5" />
          Import JSON
        </Button>
        <Button variant="outline" onClick={handleAddRoot}>
          <Plus className="size-4 mr-1.5" />
          Add Root Node
        </Button>
        <Button onClick={handleSaveHierarchy} disabled={saving || !root}>
          {saving ? 'Saving…' : 'Save Hierarchy'}
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Show tiers:</span>
          <Select value={tierDepth} onValueChange={handleTierDepthChange}>
            <SelectTrigger className="w-28" disabled={savingTierDepth}>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Array.from({ length: actualMaxDepth }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 max-w-lg">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-6 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 rounded-lg border border-border bg-card p-4 flex flex-col overflow-hidden">
            <h3 className="text-sm font-semibold shrink-0">Organization Structure</h3>
            <div className="flex-1 overflow-y-auto min-h-0 mt-2">
              {root ? (
                <BgiTree
                  nodes={[root]}
                  selectedIds={selectedId ? new Set([selectedId]) : new Set()}
                  excludedIds={new Set()}
                  onSelect={(node) => setSelectedId(node.id)}
                  onAddChild={handleAddChild}
                  onDelete={handleDeletePrompt}
                  onRename={handleRename}
                  maxDepth={tierDepth === 'all' ? undefined : Number(tierDepth)}
                />
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No BGI data. Import JSON or add a root node.
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 min-h-0 rounded-lg border border-border bg-card p-4 flex flex-col overflow-hidden">
            {selectedNode ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="space-y-1 shrink-0">
                  <h3 className="text-sm font-semibold">Node Details</h3>
                  <div className="text-sm">
                    <span className="text-muted-foreground">ID:</span>{' '}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{selectedNode.id}</code>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Name:</span> {selectedNode.name}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3 flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-semibold">
                      Assigned Projects
                      {assignedCount > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                          ({assignedCount})
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="relative shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects…"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                    {filteredProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        No projects found.
                      </p>
                    ) : (
                      filteredProjects.map((project) => {
                        const isAssigned = selectedDescendantIds.has(project.bgi_id ?? '')
                        const isDirect = project.bgi_id === selectedId
                        // Find the BGI node this project is actually assigned to (if any)
                        const assignedNode = project.bgi_id && root
                          ? findNodeById(root, project.bgi_id)
                          : null
                        return (
                          <label
                            key={project.id}
                            className="flex items-center gap-3 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={isAssigned}
                              disabled={assigning || (isAssigned && !isDirect)}
                              onChange={(e) => handleToggleProject(project.id, e.target.checked)}
                            />
                            <span className="text-sm flex-1 min-w-0 truncate">
                              {project.name}
                            </span>
                            {assignedNode && !isDirect && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]" title={`${assignedNode.id} — ${assignedNode.name}`}>
                                {assignedNode.id} · {assignedNode.name}
                              </span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">
                  Select a node from the tree to view details and assign projects.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeleteTargetId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete BGI Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTargetName}</span>?
              {(() => {
                if (!deleteTargetId || !root) return null
                const targetNode = findNodeById(root, deleteTargetId)
                const count = targetNode
                  ? projects.filter((p) => p.bgi_id && collectAllIds(targetNode).includes(p.bgi_id)).length
                  : 0
                return count > 0
                  ? ` This will unassign ${count} project${count > 1 ? 's' : ''} linked to this node.`
                  : null
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteTargetId(null) }} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Node Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createParentId ? 'Add Child Node' : 'Add Root Node'}</DialogTitle>
            <DialogDescription>
              Enter a unique ID and name for the new BGI node.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bgi-node-id">
                ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bgi-node-id"
                value={newNodeId}
                onChange={(e) => {
                  setNewNodeId(e.target.value)
                  if (createError) setCreateError(null)
                }}
                placeholder="e.g. 1238"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleConfirmCreate()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Must be unique across the entire hierarchy.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bgi-node-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bgi-node-name"
                value={newNodeName}
                onChange={(e) => {
                  setNewNodeName(e.target.value)
                  if (createError) setCreateError(null)
                }}
                placeholder="e.g. CTO Infrastructure"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleConfirmCreate()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCreate}>Create Node</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
