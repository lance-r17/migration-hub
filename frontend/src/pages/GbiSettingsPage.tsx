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
import { GbiTree } from '@/components/gbi/GbiTree'
import { getGbiHierarchy, setGbiHierarchy, assignProjectsToGbi, unassignProjectsFromGbi } from '@/services/gbi'
import { getProjects } from '@/services/projects'
import type { GbiNode } from '@/types/gbi'
import type { Project } from '@/types'

function findNodeById(node: GbiNode, id: string): GbiNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

function removeNodeById(node: GbiNode, id: string): GbiNode | null {
  if (!node.children) return node
  const filtered = node.children
    .map((c) => removeNodeById(c, id))
    .filter(Boolean) as GbiNode[]
  return { ...node, children: filtered.length ? filtered : undefined }
}

function addChildToNode(node: GbiNode, parentId: string, child: GbiNode): GbiNode {
  if (node.id === parentId) {
    return { ...node, children: [...(node.children ?? []), child] }
  }
  return {
    ...node,
    children: node.children?.map((c) => addChildToNode(c, parentId, child)),
  }
}

function renameNode(node: GbiNode, nodeId: string, newName: string): GbiNode {
  if (node.id === nodeId) return { ...node, name: newName }
  return {
    ...node,
    children: node.children?.map((c) => renameNode(c, nodeId, newName)),
  }
}

function collectAllIds(node: GbiNode): string[] {
  return [node.id, ...(node.children?.flatMap(collectAllIds) ?? [])]
}

export function GbiSettingsPage() {
  const navigate = useNavigate()
  const [root, setRoot] = useState<GbiNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectSearch, setProjectSearch] = useState('')
  const [assigning, setAssigning] = useState(false)

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
    getGbiHierarchy()
      .then((data) => setRoot(data))
      .catch(() => toast.error('Failed to load GBI hierarchy'))
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
        const data = JSON.parse(text) as GbiNode
        setRoot(data)
        await setGbiHierarchy(data)
        toast.success('GBI hierarchy imported')
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
      await setGbiHierarchy(root)
      toast.success('GBI hierarchy saved')
    } catch {
      toast.error('Failed to save GBI hierarchy')
    } finally {
      setSaving(false)
    }
  }, [root])

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

    const newNode: GbiNode = { id, name }

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
        .filter((p) => p.gbi_id && idsToClear.includes(p.gbi_id))
        .map((p) => p.id)

      if (projectIdsToClear.length > 0) {
        await unassignProjectsFromGbi(projectIdsToClear)
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
          await assignProjectsToGbi(selectedId, [projectId])
        } else {
          await unassignProjectsFromGbi([projectId])
        }
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, gbi_id: checked ? selectedId : undefined } : p))
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
    () => projects.filter((p) => selectedDescendantIds.has(p.gbi_id ?? '')).length,
    [projects, selectedDescendantIds]
  )

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/settings')} className="cursor-pointer">
              Settings
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>GBI Hierarchy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">GBI Hierarchy</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage the organizational structure and link projects to tiers.
        </p>
      </div>

      <div className="flex items-center gap-3">
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
      </div>

      {loading ? (
        <div className="space-y-2 max-w-lg">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-semibold">Organization Structure</h3>
            {root ? (
              <GbiTree
                nodes={[root]}
                selectedIds={selectedId ? new Set([selectedId]) : new Set()}
                excludedIds={new Set()}
                onSelect={(node) => setSelectedId(node.id)}
                onAddChild={handleAddChild}
                onDelete={handleDeletePrompt}
                onRename={handleRename}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No GBI data. Import JSON or add a root node.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {selectedNode ? (
              <>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Node Details</h3>
                  <div className="text-sm">
                    <span className="text-muted-foreground">ID:</span>{' '}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{selectedNode.id}</code>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Name:</span> {selectedNode.name}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Assigned Projects
                      {assignedCount > 0 && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                          ({assignedCount})
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects…"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {filteredProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        No projects found.
                      </p>
                    ) : (
                      filteredProjects.map((project) => {
                        const isAssigned = selectedDescendantIds.has(project.gbi_id ?? '')
                        const isDirect = project.gbi_id === selectedId
                        // Find the GBI node this project is actually assigned to (if any)
                        const assignedNode = project.gbi_id && root
                          ? findNodeById(root, project.gbi_id)
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Select a node from the tree to view details and assign projects.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeleteTargetId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete GBI Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTargetName}</span>?
              {(() => {
                if (!deleteTargetId || !root) return null
                const targetNode = findNodeById(root, deleteTargetId)
                const count = targetNode
                  ? projects.filter((p) => p.gbi_id && collectAllIds(targetNode).includes(p.gbi_id)).length
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
              Enter a unique ID and name for the new GBI node.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="gbi-node-id">
                ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="gbi-node-id"
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
              <Label htmlFor="gbi-node-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="gbi-node-name"
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
