import { GripVertical, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onCopy: () => void
  onDelete: () => void
  dragHandleProps?: Record<string, unknown>
}

export function ComponentToolbar({ onCopy, onDelete, dragHandleProps }: Props) {
  return (
    <div className="absolute -top-7 right-0 flex items-center gap-0.5 bg-background border border-border rounded-md shadow-sm px-0.5 py-0.5 z-20 opacity-0 group-hover/component:opacity-100 transition-opacity pointer-events-auto">
      {dragHandleProps && (
        <div
          {...(dragHandleProps as Record<string, unknown>)}
          className="flex size-5 items-center justify-center rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <GripVertical className="size-3" />
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-5"
        onClick={e => { e.stopPropagation(); onCopy() }}
      >
        <Copy className="size-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-destructive hover:text-destructive"
        onClick={e => { e.stopPropagation(); onDelete() }}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  )
}
