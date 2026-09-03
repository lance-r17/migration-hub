import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { EmailBuilderLayout } from '@/components/email-builder/builder/EmailBuilderLayout'
import { generateEmailHtml } from '@/components/email-builder/preview/TemplateRenderer'
import { getEmailTemplate, saveEmailTemplate, getPlatformConfig } from '@/services/emailService'
import type { EmailTemplate } from '@/types/email'

export function EmailBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    getPlatformConfig()
      .then(cfg => setBannerUrl(cfg.emailBannerUrl))
      .catch(() => {}) // fall back to the renderer default
  }, [])

  useEffect(() => {
    if (!id) return
    getEmailTemplate(id)
      .then(setTemplate)
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!template) return
    setSaving(true)
    try {
      const snapshot = generateEmailHtml(template, {}, bannerUrl)
      const toSave: EmailTemplate = { ...template, htmlSnapshot: snapshot }
      const saved = await saveEmailTemplate(toSave)
      setTemplate(saved)
      toast.success('Template saved')
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-56 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
        <div className="flex flex-1">
          <Skeleton className="w-[280px] h-full" />
          <div className="flex-1 bg-muted/30" />
          <Skeleton className="w-[320px] h-full" />
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Template not found
      </div>
    )
  }

  return (
    <EmailBuilderLayout
      template={template}
      saving={saving}
      onTemplateChange={setTemplate}
      onSave={handleSave}
    />
  )
}
