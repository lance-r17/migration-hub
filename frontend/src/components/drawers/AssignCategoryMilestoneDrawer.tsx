import { useState, useMemo } from 'react'
import { X, Search, Check, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

import type { CategoryMilestone } from '@/types/categoryMilestone'
import type { Project } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryMilestone: CategoryMilestone | null
  projects: Project[]
  onAssign: (categoryMilestoneId: string, projectIds: string[], unassign: boolean) => Promise<void>
  loading?: boolean
}

export function AssignCategoryMilestoneDrawer({ open, onOpenChange, categoryMilestone, projects, onAssign, loading }: Props) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const assignedIds = useMemo(() => {
    if (!categoryMilestone) return new Set<string>()
    return new Set(projects.filter(p => p.categoryMilestoneIds?.includes(categoryMilestone.id)).map(p => p.id))
  }, [categoryMilestone, projects])

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(p =>
      p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    )
  }, [projects, search])

  const handleToggle = (projectId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const handleSelectAll = () => {
    const visibleIds = filteredProjects.map(p => p.id)
    const allSelected = visibleIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const id of visibleIds) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const handleAssign = async () => {
    if (!categoryMilestone || selectedIds.size === 0) return
    setSaving(true)
    try {
      await onAssign(categoryMilestone.id, Array.from(selectedIds), false)
      toast.success('Assigned successfully')
      onOpenChange(false)
      setSelectedIds(new Set())
    } catch {
      toast.error('Failed to assign')
    } finally {
      setSaving(false)
    }
  }

  const handleUnassignOne = async (projectId: string) => {
    if (!categoryMilestone) return
    setSaving(true)
    try {
      await onAssign(categoryMilestone.id, [projectId], true)
      toast.success('Unassigned successfully')
    } catch {
      toast.error('Failed to unassign')
    } finally {
      setSaving(false)
    }
  }

  if (!categoryMilestone) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange} data-testid="assign-category-milestone-drawer">
      <SheetContent side="right" className="w-[480px] sm:!max-w-[480px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Assign Projects</SheetTitle>
              <SheetDescription>
                Assign or unassign projects from <strong>{categoryMilestone.name}</strong>.
              </SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} disabled={saving || loading}>
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-6 py-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="pl-9"
                data-testid="assign-cm-search"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedIds.size} selected</span>
              <button onClick={handleSelectAll} className="text-primary hover:underline">
                Select all visible
              </button>
            </div>
          </div>

          <div className="flex-1 px-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading projects...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No projects found.
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {filteredProjects.map(p => {
                  const isAssigned = assignedIds.has(p.id)
                  const isSelected = selectedIds.has(p.id)
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted'
                      }`}
                      onClick={() => !isAssigned && handleToggle(p.id)}
                    >
                      {isAssigned ? (
                        <div className="flex items-center justify-center size-4 text-primary">
                          <Check className="size-4" />
                        </div>
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggle(p.id)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.id}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.name}</p>
                      </div>
                      {isAssigned && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleUnassignOne(p.id) }}
                          disabled={saving}
                          className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Unassign"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || loading} data-testid="assign-cm-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={saving || loading || selectedIds.size === 0}
            data-testid="assign-cm-assign"
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
            Assign
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
