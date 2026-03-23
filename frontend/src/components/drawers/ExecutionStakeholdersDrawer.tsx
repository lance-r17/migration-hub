import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Label } from '@/components/ui/label'
import type { MigrationConstraints } from '@/types'

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MigrationConstraints | undefined
  onSave: (data: MigrationConstraints) => void
}

export function ExecutionStakeholdersDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    cutoverApproach: '', rollbackPlan: '', stakeholderComms: '', preMigrationTesting: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        cutoverApproach: data?.cutoverApproach ?? '',
        rollbackPlan: data?.rollbackPlan ?? '',
        stakeholderComms: data?.stakeholderComms ?? '',
        preMigrationTesting: data?.preMigrationTesting ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      migrationWindow: data?.migrationWindow ?? '',
      blackoutDates: data?.blackoutDates ?? [],
      cutoverApproach: draft.cutoverApproach,
      rollbackPlan: draft.rollbackPlan,
      stakeholderComms: draft.stakeholderComms,
      preMigrationTesting: draft.preMigrationTesting,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Execution & Stakeholders" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="es-cutover">Cutover Approach</Label>
        <textarea id="es-cutover" className={textareaClass} value={draft.cutoverApproach} onChange={(e) => setDraft(d => ({ ...d, cutoverApproach: e.target.value }))} placeholder="Describe the cutover approach and steps" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="es-rollback">Rollback Plan</Label>
        <textarea id="es-rollback" className={textareaClass} value={draft.rollbackPlan} onChange={(e) => setDraft(d => ({ ...d, rollbackPlan: e.target.value }))} placeholder="Describe rollback triggers and procedure" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="es-comms">Stakeholder Communications</Label>
        <textarea id="es-comms" className={textareaClass} value={draft.stakeholderComms} onChange={(e) => setDraft(d => ({ ...d, stakeholderComms: e.target.value }))} placeholder="How and when stakeholders will be notified" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="es-testing">Pre-Migration Testing</Label>
        <textarea id="es-testing" className={textareaClass} value={draft.preMigrationTesting} onChange={(e) => setDraft(d => ({ ...d, preMigrationTesting: e.target.value }))} placeholder="Describe pre-migration test plan and sign-off criteria" />
      </div>
    </SectionEditDrawer>
  )
}
