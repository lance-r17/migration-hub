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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Email Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage notification templates for platform events
            </p>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-xl" />
            ))}
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
    </AppShell>
  )
}
