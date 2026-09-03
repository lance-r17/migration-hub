import { MoreHorizontal, Pencil, Eye, Trash2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EmailTemplate } from '@/types/email'
import { EMAIL_EVENT_LABELS } from '@/types/email'

const EVENT_COLORS: Record<string, string> = {
  wave_assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sign_off_required: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  project_signed_off: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  risk_alert: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cutover_reminder: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  milestone_reminder: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  approval_submitted: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  jira_stories_created: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  survey_submitted: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  custom: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

interface Props {
  template: EmailTemplate
  onDelete: (id: string) => void
}

export function TemplateCard({ template, onDelete }: Props) {
  const navigate = useNavigate()

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card p-5 gap-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_COLORS[template.eventType] ?? EVENT_COLORS.custom}`}
            >
              {EMAIL_EVENT_LABELS[template.eventType]}
            </span>
            {template.isPredefined && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Lock className="size-2.5" />
                Pre-defined
              </span>
            )}
            {template.eventType !== 'custom' && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${template.htmlSnapshot ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                {template.htmlSnapshot ? 'Snapshot ready' : 'No snapshot'}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-snug truncate">{template.name}</h3>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/email/${template.id}/edit`)}>
              <Pencil className="size-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/email/${template.id}/preview`)}>
              <Eye className="size-4 mr-2" /> Preview
            </DropdownMenuItem>
            {!template.isPredefined && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(template.id)}
                >
                  <Trash2 className="size-4 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>
      )}

      {/* Subject preview */}
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground/70">Subject: </span>
          {template.subject || <em className="opacity-50">No subject</em>}
        </p>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => navigate(`/email/${template.id}/edit`)}
        >
          <Pencil className="size-3 mr-1" />
          {template.isPredefined ? 'Customise' : 'Edit'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => navigate(`/email/${template.id}/preview`)}
        >
          <Eye className="size-3 mr-1" />
          Preview
        </Button>
      </div>
    </div>
  )
}
