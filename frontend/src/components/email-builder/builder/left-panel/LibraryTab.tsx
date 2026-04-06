import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Type,
  Image,
  ImagePlay,
  MousePointerClick,
  Minus,
  Square,
} from 'lucide-react'
import type { ComponentType } from '@/types/email'
import { COMPONENT_LABELS } from '@/types/email'

interface ComponentDef {
  type: ComponentType
  icon: React.ReactNode
  description: string
}

const COMPONENTS: ComponentDef[] = [
  { type: 'text', icon: <Type className="size-4" />, description: 'Rich text paragraph' },
  { type: 'hero-image', icon: <ImagePlay className="size-4" />, description: 'Full-width header image' },
  { type: 'image', icon: <Image className="size-4" />, description: 'Inline image' },
  { type: 'cta', icon: <MousePointerClick className="size-4" />, description: 'Call-to-action button' },
  { type: 'divider', icon: <Minus className="size-4" />, description: 'Horizontal rule' },
  { type: 'spacer', icon: <Square className="size-4" />, description: 'Vertical whitespace' },
]

function DraggableComponent({ comp }: { comp: ComponentDef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `component::${comp.type}`,
    data: { kind: 'component', componentType: comp.type },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing select-none hover:border-primary/40 hover:bg-primary/5 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
        {comp.icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{COMPONENT_LABELS[comp.type]}</p>
        <p className="text-xs text-muted-foreground truncate">{comp.description}</p>
      </div>
    </div>
  )
}

export function LibraryTab() {
  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-muted-foreground px-1 pb-1">Drag a component into a row on the canvas</p>
      {COMPONENTS.map(comp => (
        <DraggableComponent key={comp.type} comp={comp} />
      ))}
    </div>
  )
}
