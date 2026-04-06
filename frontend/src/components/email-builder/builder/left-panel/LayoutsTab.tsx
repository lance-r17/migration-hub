import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { LayoutType } from '@/types/email'
import { LAYOUT_LABELS } from '@/types/email'

interface LayoutDef {
  type: LayoutType
  preview: React.ReactNode
}

const LAYOUTS: LayoutDef[] = [
  {
    type: 'full',
    preview: (
      <div className="flex gap-0.5 h-5 w-full">
        <div className="flex-1 rounded-sm bg-primary/30" />
      </div>
    ),
  },
  {
    type: 'two-col',
    preview: (
      <div className="flex gap-0.5 h-5 w-full">
        <div className="flex-1 rounded-sm bg-primary/30" />
        <div className="flex-1 rounded-sm bg-primary/30" />
      </div>
    ),
  },
  {
    type: 'three-col',
    preview: (
      <div className="flex gap-0.5 h-5 w-full">
        <div className="flex-1 rounded-sm bg-primary/30" />
        <div className="flex-1 rounded-sm bg-primary/30" />
        <div className="flex-1 rounded-sm bg-primary/30" />
      </div>
    ),
  },
  {
    type: 'left-sidebar',
    preview: (
      <div className="flex gap-0.5 h-5 w-full">
        <div className="w-[35%] rounded-sm bg-primary/30" />
        <div className="flex-1 rounded-sm bg-primary/30" />
      </div>
    ),
  },
  {
    type: 'table',
    preview: (
      <div className="flex flex-col gap-0.5 h-5 w-full">
        <div className="flex gap-0.5 flex-1">
          <div className="flex-1 rounded-sm bg-primary/20" />
          <div className="flex-1 rounded-sm bg-primary/20" />
          <div className="flex-1 rounded-sm bg-primary/20" />
        </div>
        <div className="flex gap-0.5 flex-1">
          <div className="flex-1 rounded-sm bg-primary/10" />
          <div className="flex-1 rounded-sm bg-primary/10" />
          <div className="flex-1 rounded-sm bg-primary/10" />
        </div>
      </div>
    ),
  },
]

function DraggableLayout({ layout }: { layout: LayoutDef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `layout::${layout.type}`,
    data: { kind: 'layout', layoutType: layout.type },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col gap-2 rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing select-none hover:border-primary/40 hover:bg-primary/5 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      {layout.preview}
      <p className="text-xs text-muted-foreground text-center truncate">{LAYOUT_LABELS[layout.type]}</p>
    </div>
  )
}

export function LayoutsTab() {
  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-muted-foreground px-1 pb-1">Drag a layout onto the canvas to add a row</p>
      {LAYOUTS.map(layout => (
        <DraggableLayout key={layout.type} layout={layout} />
      ))}
    </div>
  )
}
