import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Label } from '@/components/ui/label'
import type { Dependencies } from '@/types'

const textareaClass =
  'min-h-[120px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: Dependencies | undefined
  onSave: (data: Dependencies) => void
}

export function SecretsManagementDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (open) setDraft(data?.certificatesSecrets?.secretsManagement ?? '')
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      upstream: data?.upstream ?? [],
      downstream: data?.downstream ?? [],
      certificatesSecrets: { ...data?.certificatesSecrets, secretsManagement: draft || undefined },
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Secrets Management" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="sec-mgmt">Secrets Management</Label>
        <textarea
          id="sec-mgmt"
          className={textareaClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Describe secrets management tools and approach (Vault, AWS Secrets Manager, etc.)…"
        />
      </div>
    </SectionEditDrawer>
  )
}
