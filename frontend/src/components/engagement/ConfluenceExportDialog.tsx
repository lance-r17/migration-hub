import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  createParentPage,
  deleteParentPage,
  exportEngagementNotes,
  getPageParentId,
  listParentPages,
  searchConfluencePages,
} from '@/services/confluence'
import { FileText, Trash2, Plus, Loader2, ExternalLink, Search, Check } from 'lucide-react'

interface ConfluenceParentPage {
  id: string
  title: string
  spaceKey: string
  pageId: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  existingUrl?: string
  existingPageId?: string
  onSuccess: (url: string, pageId: string) => void
}

export function ConfluenceExportDialog({
  open,
  onOpenChange,
  projectId,
  existingUrl,
  existingPageId,
  onSuccess,
}: Props) {
  const [parentPages, setParentPages] = useState<ConfluenceParentPage[]>([])
  const NONE_VALUE = '__none__'
  const [selectedParentId, setSelectedParentId] = useState<string>(NONE_VALUE)
  const [loading, setLoading] = useState(false)
  const [pagesLoading, setPagesLoading] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPageId, setNewPageId] = useState('')
  const [adding, setAdding] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; title: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPagesLoading(true)
    Promise.all([
      listParentPages(),
      existingPageId ? getPageParentId(existingPageId) : Promise.resolve(null),
    ])
      .then(([pages, currentParentConfluenceId]) => {
        setParentPages(pages)
        if (currentParentConfluenceId) {
          const match = pages.find((p) => p.pageId === currentParentConfluenceId)
          setSelectedParentId(match ? match.id : NONE_VALUE)
        } else {
          setSelectedParentId(NONE_VALUE)
        }
      })
      .catch(() => toast.error('Failed to load parent pages'))
      .finally(() => setPagesLoading(false))
  }, [open])

  const hasExisting = Boolean(existingUrl)

  const handleExport = async () => {
    setLoading(true)
    try {
      const parentId = selectedParentId === NONE_VALUE ? null : selectedParentId
      const result = await exportEngagementNotes(projectId, parentId)
      toast.success(hasExisting ? 'Confluence page updated' : 'Exported to Confluence')
      onSuccess(result.confluencePageUrl, result.confluencePageId)
      onOpenChange(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Export failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    setSearching(true)
    try {
      const results = await searchConfluencePages(searchQuery.trim())
      setSearchResults(results)
      if (results.length === 0) {
        toast.info('No pages found')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Search failed'
      toast.error(msg)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectResult = (result: { id: string; title: string }) => {
    setSelectedSearchId(result.id)
    setNewTitle(result.title)
    setNewPageId(result.id)
  }

  const handleAddParent = async () => {
    if (!newTitle.trim() || !newPageId.trim()) {
      toast.error('Title and page ID are required')
      return
    }
    setAdding(true)
    try {
      const created = await createParentPage({
        title: newTitle.trim(),
        pageId: newPageId.trim(),
      })
      setParentPages((prev) => [...prev, created])
      setSelectedParentId(created.id)
      setShowAdd(false)
      setNewTitle('')
      setNewPageId('')
      setSearchQuery('')
      setSearchResults([])
      setSelectedSearchId(null)
      toast.success('Parent page added')
    } catch {
      toast.error('Failed to add parent page')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteParent = async (id: string) => {
    try {
      await deleteParentPage(id)
      setParentPages((prev) => prev.filter((p) => p.id !== id))
      if (selectedParentId === id) setSelectedParentId(NONE_VALUE)
      toast.success('Parent page removed')
    } catch {
      toast.error('Failed to remove parent page')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {hasExisting ? 'Update Confluence Page' : 'Export to Confluence'}
          </DialogTitle>
          <DialogDescription>
            {hasExisting
              ? 'This will overwrite the existing Confluence page with the current notes.'
              : 'Publish engagement notes as a Confluence page.'}
          </DialogDescription>
        </DialogHeader>

        {hasExisting && existingUrl && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <p className="font-medium text-muted-foreground">Existing page</p>
            <a
              href={existingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 break-all"
            >
              <span className="break-all">{existingUrl}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parent Page
            </Label>
            <Select
              value={selectedParentId}
              onValueChange={setSelectedParentId}
              disabled={pagesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None (root of space)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None (root of space)</SelectItem>
                {parentPages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center justify-between w-full gap-4">
                      <span className="truncate">{p.title}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {parentPages.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Managed Parent Pages
              </Label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {parentPages.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                  >
                    <span className="break-all pr-2">
                      {p.title}{' '}
                      <span className="text-muted-foreground">({p.pageId})</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive shrink-0"
                      onClick={() => handleDeleteParent(p.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showAdd ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="size-3.5" />
              Add parent page
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New Parent Page
              </Label>

              {/* Search row */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search page title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={searching}
                  onClick={handleSearch}
                >
                  {searching ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Search className="size-3" />
                  )}
                </Button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-40 overflow-y-auto">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectResult(r)}
                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition-colors ${
                          selectedSearchId === r.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="break-all">{r.title}</span>
                        {selectedSearchId === r.id && <Check className="size-3 shrink-0 ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual fields (auto-filled on selection) */}
              <div className="space-y-2">
                <Input
                  placeholder="Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Confluence page ID"
                  value={newPageId}
                  onChange={(e) => setNewPageId(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={adding}
                  onClick={handleAddParent}
                >
                  {adding && <Loader2 className="size-3 animate-spin mr-1" />}
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setShowAdd(false)
                    setNewTitle('')
                    setNewPageId('')
                    setSearchQuery('')
                    setSearchResults([])
                    setSelectedSearchId(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={loading}>
            {loading && <Loader2 className="size-3 animate-spin mr-1" />}
            {hasExisting ? 'Update Page' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
