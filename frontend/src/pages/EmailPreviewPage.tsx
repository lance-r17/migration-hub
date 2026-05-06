import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { BrowserContainer } from '@/components/email-builder/preview/BrowserContainer'
import { generateEmailHtml } from '@/components/email-builder/preview/TemplateRenderer'
import { getEmailTemplate, sendTestEmail } from '@/services/emailService'
import type { EmailTemplate } from '@/types/email'
import { TEMPLATE_VARIABLES } from '@/types/email'

type Viewport = 'desktop' | 'mobile'

// ─── Sample data sets ─────────────────────────────────────────────────────────

type SampleData = Record<string, string | Record<string, unknown>[]>

const SAMPLE_DATA_SETS: { label: string; data: SampleData }[] = [
  {
    label: 'Alpha Finance — Wave 3',
    data: {
      'project.name': 'Alpha Finance',
      'project.id': 'PRJ-2024-ALPHA',
      'project.status': 'migrating',
      'project.applicationTier': 'P1',
      'project.softwareOrigin': 'in-house',
      'wave.name': 'Wave 3 – Q2 2026',
      'wave.cutoverDate': '2026-06-30',
      'daysUntilCutover': '14',
      'wave.jiraEpicKey': 'MIG-42',
      'user.name': 'Jane Smith',
      'user.email': 'jane.smith@company.com',
      'approver.name': 'John Doe',
      'risk.title': 'Database schema incompatibility',
      'risk.severity': 'critical',
      'risk.severityLabel': 'Critical',
      'risk.description': 'The target RDS schema is missing 3 critical indexes required for the application to function correctly.',
      'jiraStoryKey': 'MIG-101',
      'jiraStoryUrl': 'https://jira.company.com/browse/MIG-101',
      'jiraBaseUrl': 'https://jira.company.com',
      'platform.name': 'Migration Engine',
      'platform.url': 'http://localhost:5173',
      'project.currentInfrastructure.resources': [
        { name: 'web-server-01', product: 'ecs',     category: 'computing',       jiraSubtaskKey: 'MIG-102', syncStatus: 'synced' },
        { name: 'main-database', product: 'polardb', category: 'database', jiraSubtaskKey: 'MIG-103', syncStatus: 'synced' },
        { name: 'asset-storage', product: 'oss',     category: 'storage',  jiraSubtaskKey: 'MIG-104', syncStatus: 'out-of-sync' },
      ],
    },
  },
  {
    label: 'Beta Commerce — Wave 1',
    data: {
      'project.name': 'Beta Commerce',
      'project.id': 'PRJ-2024-BETA',
      'project.status': 'planning',
      'project.applicationTier': 'P2',
      'project.softwareOrigin': '3rd party',
      'wave.name': 'Wave 1 – Q1 2026',
      'wave.cutoverDate': '2026-03-31',
      'daysUntilCutover': '7',
      'wave.jiraEpicKey': 'MIG-10',
      'user.name': 'Alice Chen',
      'user.email': 'alice.chen@company.com',
      'approver.name': 'Bob Wilson',
      'risk.title': 'Network latency to new region',
      'risk.severity': 'medium',
      'risk.severityLabel': 'Medium',
      'risk.description': 'Expected 40ms additional round-trip latency from new AZ placement.',
      'jiraStoryKey': 'MIG-55',
      'jiraStoryUrl': 'https://jira.company.com/browse/MIG-55',
      'jiraBaseUrl': 'https://jira.company.com',
      'platform.name': 'Migration Engine',
      'platform.url': 'http://localhost:5173',
      'project.currentInfrastructure.resources': [
        { name: 'api-server-01',   product: 'ecs', category: 'computing',       jiraSubtaskKey: 'MIG-56', syncStatus: 'synced' },
        { name: 'commerce-db',     product: 'rds', category: 'Database', jiraSubtaskKey: 'MIG-57', syncStatus: 'synced' },
        { name: 'product-images',  product: 'oss', category: 'storage',  jiraSubtaskKey: 'MIG-58', syncStatus: 'synced' },
      ],
    },
  },
  {
    label: 'Gamma Payments — Wave 2',
    data: {
      'project.name': 'Gamma Payments',
      'project.id': 'PRJ-2024-GAMMA',
      'project.status': 'signed-off',
      'project.applicationTier': 'P1',
      'project.softwareOrigin': 'in-house',
      'wave.name': 'Wave 2 – Q1 2026',
      'wave.cutoverDate': '2026-04-15',
      'daysUntilCutover': '3',
      'wave.jiraEpicKey': 'MIG-28',
      'user.name': 'Carlos Rivera',
      'user.email': 'carlos.rivera@company.com',
      'approver.name': 'Sarah Lee',
      'risk.title': 'PCI compliance gap',
      'risk.severity': 'critical',
      'risk.severityLabel': 'Critical',
      'risk.description': 'PCI DSS audit trail must be preserved during migration window.',
      'jiraStoryKey': 'MIG-82',
      'jiraStoryUrl': 'https://jira.company.com/browse/MIG-82',
      'jiraBaseUrl': 'https://jira.company.com',
      'platform.name': 'Migration Engine',
      'platform.url': 'http://localhost:5173',
      'project.currentInfrastructure.resources': [
        { name: 'payment-gateway', product: 'ecs',     category: 'computing',       jiraSubtaskKey: 'MIG-83', syncStatus: 'synced' },
        { name: 'txn-database',    product: 'polardb', category: 'database', jiraSubtaskKey: 'MIG-84', syncStatus: 'synced' },
        { name: 'load-balancer',   product: 'slb',     category: 'Network',  jiraSubtaskKey: 'MIG-85', syncStatus: 'provisioning' },
      ],
    },
  },
]

export function EmailPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(0)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!id) return
    getEmailTemplate(id)
      .then(setTemplate)
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setLoading(false))
  }, [id])

  const sampleData = SAMPLE_DATA_SETS[selectedSampleIdx]?.data ?? {}

  const html = useMemo(() => {
    if (!template) return ''
    return generateEmailHtml(template, sampleData)
  }, [template, sampleData])

  const handleSend = async () => {
    if (!template || !sendEmail) return
    setSending(true)
    try {
      const resolvedSubject = template.subject.replace(
        /\{\{([^}]+)\}\}/g,
        (_, key: string) => String(sampleData[key.trim()] ?? `{{${key.trim()}}}`),
      )
      await sendTestEmail({
        templateId: template.id,
        recipientEmail: sendEmail,
        sampleData,
        htmlContent: html,
        subject: resolvedSubject,
      })
      toast.success('Test email sent', { description: `Sent to ${sendEmail}` })
      setSendDialogOpen(false)
      setSendEmail('')
    } catch {
      toast.error('Failed to send test email')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-5 w-40 rounded-md" />
        </div>
        <div className="flex flex-1">
          <Skeleton className="w-64 h-full" />
          <div className="flex-1 bg-muted/30 flex items-center justify-center">
            <Skeleton className="w-[600px] h-[500px] rounded-xl" />
          </div>
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate(`/email/${id}/edit`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-sm font-medium">{template.name}</p>
          <p className="text-xs text-muted-foreground">Preview</p>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => navigate(`/email/${id}/edit`)}
        >
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setSendDialogOpen(true)}
        >
          <Send className="size-3.5" /> Send Test
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — sample data + subject preview */}
        <div className="w-64 shrink-0 border-r border-border bg-background p-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sample Data</p>
            <Select
              value={String(selectedSampleIdx)}
              onValueChange={v => setSelectedSampleIdx(Number(v))}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_DATA_SETS.map((s, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border" />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resolved Subject</p>
            <p className="text-xs text-foreground/80 break-words leading-relaxed">
              {template.subject.replace(/\{\{([^}]+)\}\}/g, (_, key) => sampleData[key.trim()] ?? `{{${key.trim()}}}`)}
            </p>
          </div>

          <div className="border-t border-border" />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Variable Values</p>
            <div className="space-y-1.5">
              {TEMPLATE_VARIABLES.slice(0, 8).map(v => (
                <div key={v.key} className="flex flex-col gap-0.5">
                  <p className="text-[10px] text-muted-foreground font-mono">{`{{${v.key}}}`}</p>
                  <p className="text-[10px] text-foreground/70 truncate">{sampleData[v.key] ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-8 bg-muted/30 flex flex-col items-center">
          <BrowserContainer
            viewport={viewport}
            onViewportChange={setViewport}
            html={html}
          />
        </div>
      </div>

      {/* Send test email dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a preview of "{template.name}" with the selected sample data to an email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="send-to" className="text-sm">Recipient Email</Label>
            <Input
              id="send-to"
              type="email"
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              placeholder="you@company.com"
              onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            />
            <p className="text-xs text-muted-foreground">
              Using sample data: <strong>{SAMPLE_DATA_SETS[selectedSampleIdx]?.label}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!sendEmail || sending}>
              {sending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
