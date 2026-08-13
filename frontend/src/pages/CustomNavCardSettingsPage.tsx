import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCustomNavCardContext } from '@/context/CustomNavCardContext'
import { saveCustomNavCardConfig } from '@/services/customNavCard'

export function CustomNavCardSettingsPage() {
  const navigate = useNavigate()
  const { config, loading, refresh } = useCustomNavCardContext()
  const [draft, setDraft] = useState({ title: '', description: '', url: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(config)
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveCustomNavCardConfig(draft)
      await refresh()
      toast.success('Navigation card saved')
    } catch {
      toast.error('Failed to save navigation card')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/settings')} className="cursor-pointer">
              Settings
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Custom Navigation Card</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ExternalLink className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Custom Navigation Card
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Configure the sidebar card that links users to external help or resources.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Card content</CardTitle>
            <CardDescription>
              These values are shown in the sidebar and used when users click the card.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nav-card-title">Title</Label>
              <Input
                id="nav-card-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Help & Support"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nav-card-description">Description</Label>
              <Input
                id="nav-card-description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="e.g. Open the support portal for guides and FAQs."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nav-card-url">External URL</Label>
              <Input
                id="nav-card-url"
                type="url"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://example.com/support"
              />
              <p className="text-muted-foreground text-xs">
                Users will be routed to this URL in a new browser tab when they click the card.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
