import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { TemplateCard } from '@/components/email-builder/TemplateCard'
import { CreateTemplateCard } from '@/components/email-builder/CreateTemplateCard'
import { Skeleton } from '@/components/ui/skeleton'
import { getEmailTemplates, createEmailTemplate, deleteEmailTemplate } from '@/services/emailService'
import type { EmailTemplate } from '@/types/email'

export function EmailTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEmailTemplates()
      .then(setTemplates)
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    try {
      const tpl = await createEmailTemplate()
      navigate(`/email/${tpl.id}/edit`)
    } catch {
      toast.error('Failed to create template')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteEmailTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template deleted')
    } catch {
      toast.error('Failed to delete template')
    }
  }

  return (
    <AppShell title="Email Templates">
      <div className="max-w-screen-xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Email Templates</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Manage notification templates for platform events
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
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No templates yet. Create your first email template to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <CreateTemplateCard onClick={handleCreate} />
              {templates.map(tpl => (
                <TemplateCard key={tpl.id} template={tpl} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
