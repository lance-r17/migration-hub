import { Plus } from 'lucide-react'

interface Props {
  onClick: () => void
}

export function CreateTemplateCard({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-transparent p-5 gap-3 min-h-[180px] text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10">
        <Plus className="size-5" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Create Template</p>
        <p className="text-xs mt-0.5 opacity-70">Start from a blank canvas</p>
      </div>
    </button>
  )
}
