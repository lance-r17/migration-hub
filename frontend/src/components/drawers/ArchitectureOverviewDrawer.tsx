import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { TargetArchitecture } from '@/types'

const textareaClass =
  'min-h-[100px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: TargetArchitecture | undefined
  onSave: (data: TargetArchitecture) => void
}

export function ArchitectureOverviewDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    reArchitectureNeeded: false, summary: '', constraints: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        reArchitectureNeeded: data?.reArchitectureNeeded ?? false,
        summary: data?.summary ?? '',
        constraints: data?.constraints ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      summary: draft.summary,
      constraints: draft.constraints,
      reArchitectureNeeded: draft.reArchitectureNeeded,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Architecture Overview" onSave={handleSave}>
      <div className="flex items-center gap-2">
        <Checkbox
          id="ao-rearch"
          checked={draft.reArchitectureNeeded}
          onCheckedChange={(checked) => setDraft(d => ({ ...d, reArchitectureNeeded: !!checked }))}
        />
        <Label htmlFor="ao-rearch" className="cursor-pointer">Re-Architecture Needed</Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ao-summary">Architecture Summary</Label>
        <textarea id="ao-summary" className={textareaClass} value={draft.summary} onChange={(e) => setDraft(d => ({ ...d, summary: e.target.value }))} placeholder="Describe the target architecture" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ao-constraints">Constraints</Label>
        <textarea id="ao-constraints" className={textareaClass} value={draft.constraints} onChange={(e) => setDraft(d => ({ ...d, constraints: e.target.value }))} placeholder="List architectural constraints" />
      </div>
    </SectionEditDrawer>
  )
}
