import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Trash2, History, RotateCcw, Eye, Pencil, MoreVertical, Tag, Users, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { NotionEditor } from '@/components/notion-editor/NotionEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getNoteTemplates,
  createNoteTemplate,
  deleteNoteTemplate,
  getTemplateVersions,
  restoreTemplateVersion,
} from '@/services/noteTemplates'
import type { NoteTemplate, NoteTemplateVersion } from '@/types'
import type { Block } from '@/components/notion-editor/model'

export function NoteTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [previewVersion, setPreviewVersion] = useState<NoteTemplateVersion | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [versionDialog, setVersionDialog] = useState<{
    template: NoteTemplate
    versions: NoteTemplateVersion[]
  } | null>(null)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getNoteTemplates()
      .then(setTemplates)
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteNoteTemplate(deleteId)
      setTemplates(prev => prev.filter(t => t.id !== deleteId))
      toast.success('Template deleted')
    } catch {
      toast.error('Failed to delete template')
    } finally {
      setDeleteId(null)
    }
  }

  const openVersions = async (template: NoteTemplate) => {
    setVersionsLoading(true)
    setVersionDialog({ template, versions: [] })
    try {
      const versions = await getTemplateVersions(template.id)
      setVersionDialog({ template, versions })
    } catch {
      toast.error('Failed to load version history')
      setVersionDialog(null)
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const newTpl = await createNoteTemplate({})
      navigate(`/templates/${newTpl.id}?mode=edit`)
    } catch {
      toast.error('Failed to create template')
      setCreating(false)
    }
  }

  const handleRestore = async (version: NoteTemplateVersion) => {
    if (!versionDialog) return
    setRestoringId(version.id)
    try {
      const restored = await restoreTemplateVersion(versionDialog.template.id, version.id)
      setTemplates(prev => prev.map(t => t.id === restored.id ? restored : t))
      toast.success(`Restored version ${version.versionNumber}`)
      // Refresh versions list
      const versions = await getTemplateVersions(versionDialog.template.id)
      setVersionDialog({ template: restored, versions })
    } catch {
      toast.error('Failed to restore version')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <AppShell title="Note Templates">
      <div className="max-w-screen-xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Note Templates</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage reusable note templates for engagements and other scenarios
            </p>
          </div>
        </div>

        {/* Templates */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
            All Templates
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[180px] rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Create Template Card */}
              <button
                className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-transparent p-5 gap-3 min-h-[180px] text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
                onClick={handleCreate}
                disabled={creating}
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                  <Plus className="size-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {creating ? 'Creating…' : 'Create Template'}
                  </p>
                  <p className="text-xs mt-0.5 opacity-70">Start from a blank canvas</p>
                </div>
              </button>

              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  className="group relative flex flex-col rounded-xl border border-border bg-background p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold line-clamp-1">{tpl.name}</h3>
                    <Badge
                      variant={tpl.scope === 'global' ? 'default' : tpl.scope === 'function' ? 'outline' : 'secondary'}
                      className="text-[10px]"
                    >
                      {tpl.scope}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tpl.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="size-3 text-muted-foreground shrink-0" />
                      <div className="flex gap-1 flex-wrap">
                        {tpl.labels.map(l => (
                          <Badge key={l} variant="outline" className="text-[10px]">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {tpl.scope === 'function' && tpl.sharedRoles && tpl.sharedRoles.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="size-3 text-muted-foreground shrink-0" />
                        <div className="flex gap-1 flex-wrap">
                          {tpl.sharedRoles.map(r => (
                            <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-auto justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Preview"
                      onClick={() => navigate(`/templates/${tpl.id}`)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit"
                      onClick={() => navigate(`/templates/${tpl.id}?mode=edit`)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="More actions"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openVersions(tpl)}>
                          <History className="size-4 mr-1.5" />
                          Versions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(tpl.id)}
                        >
                          <Trash2 className="size-4 mr-1.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Version History Dialog */}
      <Dialog open={!!versionDialog} onOpenChange={() => setVersionDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              {versionDialog?.template.name}
            </DialogDescription>
          </DialogHeader>
          {versionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : versionDialog?.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No previous versions yet. Versions are created automatically when a template is edited.
            </p>
          ) : (
            <div className="space-y-2">
              {versionDialog?.versions.map(v => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium">Version {v.versionNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.name} · {new Date(v.createdAt || '').toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPreviewVersion(v)}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleRestore(v)}
                      disabled={restoringId === v.id}
                    >
                      <RotateCcw className="size-3" />
                      {restoringId === v.id ? 'Restoring…' : 'Restore'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Version Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewVersion?.name} · Version {previewVersion?.versionNumber}
            </DialogTitle>
            <DialogDescription>
              {previewVersion?.labels.map(l => (
                <Badge key={l} variant="outline" className="mr-1">
                  {l}
                </Badge>
              ))}
            </DialogDescription>
          </DialogHeader>
          {previewVersion && (
            <NotionEditor
              blocks={previewVersion.blocks as Block[]}
              readOnly
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
