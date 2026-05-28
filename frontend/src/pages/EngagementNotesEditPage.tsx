import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FilePlus, BookOpen, Save, MoreVertical } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NotionEditor, createBlock } from '@frontend/notion-editor'
import { apiClient } from '@/services/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { TemplatePicker } from '@/components/note-template/TemplatePicker'
import { SaveTemplateDialog } from '@/components/note-template/SaveTemplateDialog'
import { resolveTemplateVariables, buildTemplateContext, TEMPLATE_VARIABLES } from '@/lib/noteTemplateUtils'
import { useCurrentUser } from '@/context/UserContext'
import type { Project } from '@/types'
import type { Block } from '@frontend/notion-editor'

const DEBOUNCE_MS = 1500

export function EngagementNotesEditPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [project, setProject] = useState<Project | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const lastSavedBlocksRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBlocksRef = useRef<Block[] | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!projectId) return
    apiClient
      .get<Project>(`/api/v1/projects/${projectId}?fields=basic,engagement,team`)
      .then((data) => {
        setProject(data)
        const engagement = data.engagement
        const s = engagement?.interviewSubject || 'Untitled'
        setSubject(s)
        let initialBlocks: Block[]
        const hasNotes = Array.isArray(engagement?.notes) && engagement.notes.length > 0
        if (hasNotes) {
          initialBlocks = engagement.notes as Block[]
        } else {
          initialBlocks = [
            createBlock('h1', { content: s }),
            createBlock('paragraph', { content: '' }),
          ]
        }
        setBlocks(initialBlocks)
        lastSavedBlocksRef.current = JSON.stringify(initialBlocks)
        setLoading(false)
        // Auto-open template picker when notes are empty
        if (!hasNotes) {
          setPickerOpen(true)
        }
      })
      .catch(() => {
        toast.error('Failed to load project')
        setLoading(false)
      })
  }, [projectId])

  const persist = useCallback(async (blocksToSave: Block[]) => {
    if (!project || !projectId) return
    const serialized = JSON.stringify(blocksToSave)
    if (serialized === lastSavedBlocksRef.current) return

    if (isMountedRef.current) setSaveStatus('saving')
    try {
      const engagement = { ...project.engagement, notes: blocksToSave }
      await apiClient.patch(`/api/v1/projects/${projectId}/sections/engagement`, {
        value: engagement,
      })
      lastSavedBlocksRef.current = serialized
      if (isMountedRef.current) setSaveStatus('saved')
    } catch {
      if (isMountedRef.current) {
        setSaveStatus('error')
        toast.error('Failed to save notes')
      }
    }
  }, [project, projectId])

  useEffect(() => {
    if (loading || !project) return
    const serialized = JSON.stringify(blocks)
    if (serialized === lastSavedBlocksRef.current) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      pendingBlocksRef.current = null
      setSaveStatus('idle')
      return
    }

    setSaveStatus('saving')
    pendingBlocksRef.current = blocks
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (pendingBlocksRef.current) {
        persist(pendingBlocksRef.current)
        pendingBlocksRef.current = null
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [blocks, loading, project, persist])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingBlocksRef.current) {
        const serialized = JSON.stringify(pendingBlocksRef.current)
        if (serialized === lastSavedBlocksRef.current) return
        const token = localStorage.getItem('backend_token')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const engagement = { ...project?.engagement, notes: pendingBlocksRef.current }
        fetch(`/api/v1/projects/${projectId}/sections/engagement`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ value: engagement }),
          keepalive: true,
        }).catch(() => {})
      }
    }

    const handleBeforeUnload = () => {
      if (pendingBlocksRef.current) {
        const serialized = JSON.stringify(pendingBlocksRef.current)
        if (serialized === lastSavedBlocksRef.current) return
        const token = localStorage.getItem('backend_token')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const engagement = { ...project?.engagement, notes: pendingBlocksRef.current }
        fetch(`/api/v1/projects/${projectId}/sections/engagement`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ value: engagement }),
          keepalive: true,
        }).catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (pendingBlocksRef.current && project && projectId) {
        const serialized = JSON.stringify(pendingBlocksRef.current)
        if (serialized !== lastSavedBlocksRef.current) {
          const engagement = { ...project.engagement, notes: pendingBlocksRef.current }
          apiClient.patch(`/api/v1/projects/${projectId}/sections/engagement`, { value: engagement }).catch(() => {})
        }
      }
    }
  }, [project, projectId])

  const saveStatusText =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
      ? 'All changes saved'
      : saveStatus === 'error'
      ? 'Failed to save'
      : null

  const isDefaultBlocks = blocks.length === 2
    && blocks[0].type === 'h1'
    && blocks[1].type === 'paragraph'
    && (blocks[1] as { content?: string }).content === ''

  const handleApplyTemplate = (tplBlocks: Block[], mode: 'replace' | 'append') => {
    const context = buildTemplateContext(project as Record<string, unknown> | null, user?.name || '')
    const resolved = resolveTemplateVariables(tplBlocks, context)
    if (mode === 'replace') {
      setBlocks(resolved)
    } else {
      setBlocks(prev => [...prev, ...resolved])
    }
    toast.success('Template applied')
  }

  return (
    <AppShell title={subject ? `Edit ${subject}` : 'Edit Notes'}>
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Breadcrumb + status */}
        <div className="flex items-center justify-between px-5 py-3">
          <Breadcrumb>
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('/')} className="cursor-pointer">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => navigate('/engagements')}
                  className="cursor-pointer"
                >
                  Engagements
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {subject && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      onClick={() => navigate(`/engagements/${projectId}`)}
                      className="cursor-pointer"
                    >
                      {subject}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>Notes</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            {saveStatusText && (
              <div className="text-xs text-muted-foreground mr-2">{saveStatusText}</div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0"
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Template options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={() => setPickerOpen(true)}>
                  <BookOpen className="size-4 mr-2" />
                  Apply Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
                  <Save className="size-4 mr-2" />
                  Save as Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        ) : !project ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Project not found.
          </div>
        ) : (
          <>
            {isDefaultBlocks && (
              <div className="mx-8 mb-2 rounded-md border border-dashed border-border p-4 flex items-center justify-between gap-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Start from a template to speed up your notes.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setPickerOpen(true)}
                >
                  <FilePlus className="size-3.5" />
                  Pick a Template
                </Button>
              </div>
            )}
            <NotionEditor
              blocks={blocks}
              variables={TEMPLATE_VARIABLES}
              onBlocksChange={setBlocks}
            />
          </>
        )}
      </div>

      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onApply={handleApplyTemplate}
        defaultLabel="engagement"
      />
      <SaveTemplateDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        blocks={blocks}
        project={project as Record<string, unknown> | null}
        userName={user?.name || ''}
        defaultLabels={['engagement']}
      />
    </AppShell>
  )
}
