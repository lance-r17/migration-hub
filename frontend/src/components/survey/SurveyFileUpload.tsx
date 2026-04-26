import { useEffect, useState } from 'react'
import { Upload, Trash2, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadAttachment, getAttachments } from '@/services/attachments'
import { toast } from 'sonner'

interface Props {
  projectId: string
  value: string[]
  onChange: (ids: string[]) => void
  onRemove?: (id: string) => void
}

export interface SurveyAttachment {
  id: string
  filename: string
}

export function SurveyFileUpload({ projectId, value, onChange, onRemove }: Props) {
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<SurveyAttachment[]>([])

  // Fetch attachment metadata from API to get filenames for pre-existing IDs
  useEffect(() => {
    if (!projectId) return
    getAttachments(projectId)
      .then(list => {
        const map = new Map(list.map(a => [a.id, a.filename]))
        // Purge stale IDs (soft-deleted attachments) from parent state
        const staleIds = value.filter(id => !map.has(id))
        if (staleIds.length > 0) {
          onChange(value.filter(id => map.has(id)))
        }
        setAttachments(prev => {
          // Merge fetched metadata with any locally-added attachments
          const merged = value.map(id => ({
            id,
            filename: map.get(id) ?? prev.find(p => p.id === id)?.filename ?? 'Attachment',
          }))
          return merged
        })
      })
      .catch(() => {
        setAttachments(prev => value.map(id => ({
          id,
          filename: prev.find(p => p.id === id)?.filename ?? 'Attachment',
        })))
      })
  }, [projectId, value.join(',')])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const att = await uploadAttachment(projectId, file)
      const nextIds = [...value, att.id]
      const nextAttachments = [...attachments, { id: att.id, filename: att.filename }]
      onChange(nextIds)
      setAttachments(nextAttachments)
      toast.success('File uploaded')
    } catch {
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = (attachmentId: string) => {
    const nextIds = value.filter(id => id !== attachmentId)
    const nextAttachments = attachments.filter(a => a.id !== attachmentId)
    onChange(nextIds)
    setAttachments(nextAttachments)
    onRemove?.(attachmentId)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById('survey-file-upload-input')?.click()}
          data-survey-file-upload-trigger
        >
          {uploading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
          {uploading ? 'Uploading…' : 'Upload File'}
        </Button>
        <input
          id="survey-file-upload-input"
          type="file"
          className="hidden"
          onChange={handleUpload}
          data-survey-file-input
        />
      </div>

      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map(id => (
            <div
              key={id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 bg-background"
            >
              <a
                href={`/api/v1/projects/${projectId}/attachments/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText size={14} />
                <span className="truncate max-w-[260px]">{attachments.find(a => a.id === id)?.filename ?? 'Attachment'}</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
