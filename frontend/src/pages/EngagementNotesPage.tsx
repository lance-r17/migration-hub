import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Share2, FileText, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { NotionEditor } from '@frontend/notion-editor'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { apiClient } from '@/services/client'
import { getConfluenceStatus } from '@/services/confluence'
import { ConfluenceExportDialog } from '@/components/engagement/ConfluenceExportDialog'
import { useCurrentUser } from '@/context/UserContext'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { Project } from '@/types'
import type { Block } from '@frontend/notion-editor'

export function EngagementNotesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const [confluenceStatus, setConfluenceStatus] = useState<{
    configured: boolean
    spaceValid?: boolean
    spaceError?: string
  }>({ configured: false })
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  useEffect(() => {
    if (!projectId) return
    apiClient
      .get<Project>(`/api/v1/projects/${projectId}?fields=basic,engagement,team`)
      .then((data) => {
        setProject(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    getConfluenceStatus()
      .then((s) =>
        setConfluenceStatus({
          configured: s.configured,
          spaceValid: s.space?.valid,
          spaceError: s.space?.error,
        })
      )
      .catch(() => setConfluenceStatus({ configured: false }))
  }, [])

  const engagement = project?.engagement
  const blocks = (Array.isArray(engagement?.notes) ? engagement.notes : []) as Block[]

  return (
    <AppShell title={engagement?.interviewSubject || 'Engagement Notes'}>
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Breadcrumb + edit */}
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
              {engagement?.interviewSubject && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      onClick={() => navigate(`/engagements/${projectId}`)}
                      className="cursor-pointer"
                    >
                      {engagement.interviewSubject}
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

          <div className="flex items-center gap-1">
            {isPlatformLead && blocks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Share2 className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuItem
                    disabled={!confluenceStatus.configured || confluenceStatus.spaceValid === false}
                    onClick={() => setExportDialogOpen(true)}
                  >
                    <FileText className="size-3.5 mr-2" />
                    {engagement?.confluencePageUrl ? 'Update Confluence' : 'Export to Confluence'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isPlatformLead && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => navigate(`/engagements/${projectId}/edit`)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {isPlatformLead && confluenceStatus.configured && confluenceStatus.spaceValid === false && (
          <div className="mx-5 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>
              Confluence space not found: {confluenceStatus.spaceError}. Update{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">CONFLUENCE_SPACE_KEY</code> in the backend env.
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        ) : !project ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Project not found.
          </div>
        ) : blocks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
            <p>No notes yet.</p>
            {isPlatformLead && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/engagements/${projectId}/edit`)}>
                Add Notes
              </Button>
            )}
          </div>
        ) : (
          <NotionEditor
            blocks={blocks}
            readOnly
          />
        )}
      </div>

      <ConfluenceExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectId={projectId ?? ''}
        existingUrl={engagement?.confluencePageUrl}
        existingPageId={engagement?.confluencePageId}
        onSuccess={(url, pageId) => {
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  engagement: {
                    ...prev.engagement,
                    confluencePageUrl: url,
                    confluencePageId: pageId,
                  } as typeof prev.engagement,
                }
              : prev
          )
        }}
      />
    </AppShell>
  )
}
