import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { Risk, RiskSeverity } from '@/types'

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  risks: Risk[]
  editingRisk: Risk | null
  onSave: (risks: Risk[]) => void
}

export function RiskEditDrawer({ open, onOpenChange, risks, editingRisk, onSave }: Props) {
  const [draft, setDraft] = useState({
    title: '', description: '', severity: 'medium' as RiskSeverity,
    mitigation: '', owner: '', riskStatus: '',
  })

  useEffect(() => {
    if (open) {
      if (editingRisk) {
        setDraft({
          title: editingRisk.title,
          description: editingRisk.description,
          severity: editingRisk.severity,
          mitigation: editingRisk.mitigation ?? '',
          owner: editingRisk.owner ?? '',
          riskStatus: editingRisk.riskStatus ?? '',
        })
      } else {
        setDraft({ title: '', description: '', severity: 'medium', mitigation: '', owner: '', riskStatus: '' })
      }
    }
  }, [open, editingRisk])

  function handleSave() {
    if (editingRisk) {
      onSave(risks.map(r => r.id === editingRisk.id ? {
        ...editingRisk, ...draft, mitigation: draft.mitigation || undefined, owner: draft.owner || undefined, riskStatus: draft.riskStatus || undefined,
      } : r))
    } else {
      onSave([...risks, {
        id: crypto.randomUUID(),
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        mitigation: draft.mitigation || undefined,
        owner: draft.owner || undefined,
        riskStatus: draft.riskStatus || undefined,
      }])
    }
    onOpenChange(false)
  }

  function handleDelete() {
    if (!editingRisk) return
    onSave(risks.filter(r => r.id !== editingRisk.id))
    onOpenChange(false)
  }

  const isEdit = !!editingRisk

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>{isEdit ? 'Edit Risk / Blocker' : 'Add Risk / Blocker'}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="risk-title">Title *</Label>
            <Input id="risk-title" value={draft.title} onChange={(e) => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Risk title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-desc">Description</Label>
            <textarea id="risk-desc" className={textareaClass} value={draft.description} onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Describe the risk or blocker" />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={draft.severity} onValueChange={(v) => setDraft(d => ({ ...d, severity: v as RiskSeverity }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-mit">Mitigation</Label>
            <textarea id="risk-mit" className={textareaClass} value={draft.mitigation} onChange={(e) => setDraft(d => ({ ...d, mitigation: e.target.value }))} placeholder="Describe mitigation steps" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="risk-owner">Owner</Label>
              <Input id="risk-owner" value={draft.owner} onChange={(e) => setDraft(d => ({ ...d, owner: e.target.value }))} placeholder="Team or person" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.riskStatus} onValueChange={(v) => setDraft(d => ({ ...d, riskStatus: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-between">
          <div>
            {isEdit && (
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            )}
          </div>
          <div className="flex gap-2">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
