import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Save, X, History, Eye, GitCompare, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
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
import { NotionEditor } from '@/components/notion-editor/NotionEditor'
import { TemplateMetaPanel } from '@/components/note-template/TemplateMetaPanel'
import { getNoteTemplate, getTemplateVersions } from '@/services/noteTemplates'
import { updateNoteTemplate } from '@/services/noteTemplates'
import { useCurrentUser } from '@/context/UserContext'
import { createBlock } from '@/components/notion-editor/model'
import type { Block } from '@/components/notion-editor/model'
import type { NoteTemplate, NoteTemplateVersion } from '@/types'

export function TemplatePreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useCurrentUser()

  const initialEditMode = searchParams.get('mode') === 'edit'
  const [isEditing, setIsEditing] = useState(initialEditMode)
  const [template, setTemplate] = useState<NoteTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable copies
  const [editorBlocks, setEditorBlocks] = useState<Block[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [scope, setScope] = useState<'private' | 'global' | 'function'>('private')
  const [sharedRoles, setSharedRoles] = useState<string[]>([])
  const [labelInput, setLabelInput] = useState('')

  // Right-panel tabs & versions
  const [activeTab, setActiveTab] = useState('details')
  const [versions, setVersions] = useState<NoteTemplateVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<NoteTemplateVersion | null>(null)
  const [compareWith, setCompareWith] = useState<'current' | string | null>(null)

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const canEdit = template ? template.createdBy === user?.id || isPlatformLead : false

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getNoteTemplate(id)
      .then(data => {
        setTemplate(data)
        const blocks = (data.blocks as Block[]).length > 0
          ? data.blocks as Block[]
          : [createBlock('paragraph')]
        setEditorBlocks(blocks)
        setName(data.name)
        setDescription(data.description || '')
        setLabels(data.labels)
        setScope(data.scope)
        setSharedRoles(data.sharedRoles || [])
      })
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    setVersionsLoading(true)
    getTemplateVersions(id)
      .then(setVersions)
      .catch(() => toast.error('Failed to load version history'))
      .finally(() => setVersionsLoading(false))
  }, [id])

  const startEditing = () => {
    if (!canEdit) {
      toast.error('You do not have permission to edit this template')
      return
    }
    setIsEditing(true)
    setSearchParams({ mode: 'edit' })
  }

  const cancelEditing = () => {
    if (!template) return
    setIsEditing(false)
    setSearchParams({})
    // Revert to original values
    setEditorBlocks(template.blocks as Block[])
    setName(template.name)
    setDescription(template.description || '')
    setLabels(template.labels)
    setScope(template.scope)
    setSharedRoles(template.sharedRoles || [])
    setViewingVersion(null)
  }

  const handleSave = async () => {
    if (!template || !id) return
    if (!name.trim()) {
      toast.error('Template name is required')
      return
    }
    setSaving(true)
    try {
      const updated = await updateNoteTemplate(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        labels,
        blocks: editorBlocks as unknown[],
        scope,
        sharedRoles: scope === 'function' ? sharedRoles : undefined,
      })
      setTemplate(updated)
      setIsEditing(false)
      setSearchParams({})
      toast.success('Template saved')
      // Refresh versions after save
      const newVersions = await getTemplateVersions(id)
      setVersions(newVersions)
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleViewVersion = (version: NoteTemplateVersion) => {
    setViewingVersion(version)
    setIsEditing(false)
    setSearchParams({})
  }

  const handleBackToCurrent = () => {
    setViewingVersion(null)
    setCompareWith(null)
  }

  const getCompareBlocks = (): Block[] => {
    if (!compareWith) return []
    if (compareWith === 'current') return (template?.blocks as Block[]) || []
    const v = versions.find(ver => ver.id === compareWith)
    return (v?.blocks as Block[]) || []
  }

  const compareTargetLabel = () => {
    if (!compareWith) return ''
    if (compareWith === 'current') return 'Current'
    const v = versions.find(ver => ver.id === compareWith)
    return v ? `Version ${v.versionNumber}` : ''
  }

  const displayBlocks = viewingVersion
    ? (viewingVersion.blocks as Block[])
    : editorBlocks

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  if (!template) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background text-muted-foreground text-sm">
        Template not found.
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-base font-semibold">
            {isEditing ? 'Edit Template' : viewingVersion ? `Version ${viewingVersion.versionNumber}` : template.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" className="h-8" onClick={cancelEditing}>
                <X className="size-3.5 mr-1" />
                Cancel
              </Button>
              <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
                <Save className="size-3.5 mr-1" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            canEdit && !viewingVersion && (
              <Button variant="outline" size="sm" className="h-8" onClick={startEditing}>
                <Pencil className="size-3.5 mr-1" />
                Edit
              </Button>
            )
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor pane */}
        <div className="flex-1 overflow-y-auto">
          {viewingVersion && (
            <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/80 border-b px-8 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">Version {viewingVersion.versionNumber}</Badge>
                <span className="text-muted-foreground">
                  {new Date(viewingVersion.createdAt || '').toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <GitCompare className="size-3.5" />
                      {compareWith ? `Comparing with ${compareTargetLabel()}` : 'Compare'}
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCompareWith('current')}>
                      Current version
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {versions
                      .filter(v => v.id !== viewingVersion.id)
                      .map(v => (
                        <DropdownMenuItem key={v.id} onClick={() => setCompareWith(v.id)}>
                          Version {v.versionNumber}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {compareWith && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCompareWith(null)}>
                    Clear
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleBackToCurrent}>
                  <ArrowLeft className="size-3 mr-1" />
                  Back to current
                </Button>
              </div>
            </div>
          )}
          <div className="px-8 py-6">
            {viewingVersion && compareWith ? (
              <div className="flex w-full min-h-full items-stretch">
                <div className="flex-1 min-w-0 px-4 border-r border-dashed border-border">
                  <div className="max-w-screen-xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">Version {viewingVersion.versionNumber}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(viewingVersion.createdAt || '').toLocaleString()}
                      </span>
                    </div>
                    <NotionEditor blocks={viewingVersion.blocks as Block[]} readOnly />
                  </div>
                </div>
                <div className="flex-1 min-w-0 px-4">
                  <div className="max-w-screen-xl mx-auto">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{compareTargetLabel()}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {compareWith === 'current'
                          ? new Date(template?.updatedAt || '').toLocaleString()
                          : new Date(versions.find(v => v.id === compareWith)?.createdAt || '').toLocaleString()}
                      </span>
                    </div>
                    <NotionEditor blocks={getCompareBlocks()} readOnly />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-screen-xl mx-auto w-full">
                <NotionEditor
                  blocks={displayBlocks}
                  onBlocksChange={isEditing ? setEditorBlocks : undefined}
                  readOnly={!isEditing}
                  allowEmpty
                />
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 border-l overflow-y-auto shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="mx-4 mt-4 shrink-0">
              <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
              <TabsTrigger value="versions" className="flex-1 text-xs">
                <History className="size-3 mr-1" />
                Versions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="p-4 space-y-5 mt-0">
              <TemplateMetaPanel
                isEditing={isEditing}
                isPlatformLead={isPlatformLead}
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                labels={labels}
                setLabels={setLabels}
                scope={scope}
                setScope={setScope}
                sharedRoles={sharedRoles}
                setSharedRoles={setSharedRoles}
                labelInput={labelInput}
                setLabelInput={setLabelInput}
                createdAt={template.createdAt}
                updatedAt={template.updatedAt}
              />
            </TabsContent>

            <TabsContent value="versions" className="p-4 space-y-4 mt-0">
              {versionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-6">
                  <History className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No previous versions yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Versions are created automatically when a template is edited.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {versions.map(v => {
                      const isViewing = viewingVersion?.id === v.id
                      return (
                        <button
                          key={v.id}
                          className={`w-full text-left rounded-md border p-3 transition-colors cursor-pointer ${isViewing ? 'bg-muted/70 border-primary/30' : 'hover:bg-muted/50'}`}
                          onClick={() => handleViewVersion(v)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Version {v.versionNumber}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {new Date(v.createdAt || '').toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center shrink-0">
                              <Eye className={`size-4 text-primary transition-opacity ${isViewing ? 'opacity-100' : 'opacity-0'}`} />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>


    </div>
  )
}
