import { useEffect, useState } from 'react'
import { Plus, GripVertical } from 'lucide-react'

interface BlockHoverControlsProps {
  blockId: string
  index: number
  readOnly?: boolean
  onAddBelow?: (index: number) => void
  onOpenMenu?: (e: React.MouseEvent<HTMLButtonElement>, index: number) => void
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>, index: number) => void
  onDragEnd?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function BlockHoverControls({
  blockId,
  index,
  readOnly,
  onAddBelow,
  onOpenMenu,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
}: BlockHoverControlsProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const updatePos = () => {
      const row = document.querySelector(`[data-block-id="${blockId}"]`)
      if (!row) return
      const rect = row.getBoundingClientRect()
      setPos({ top: rect.top + 4, left: rect.left - 44 })
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [blockId])

  if (readOnly) return null

  return (
    <div
      className="block-hover-controls fixed z-[50] flex items-start justify-end gap-px pr-1 pt-1"
      style={{ top: pos.top, left: pos.left, width: 44 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        className="w-6 h-6 rounded grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground pointer-events-auto"
        title="Click to add a block below"
        onClick={() => onAddBelow?.(index)}
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        className="w-6 h-6 rounded grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing pointer-events-auto"
        title="Drag to move · Click to open menu"
        draggable
        onDragStart={(e) => onDragStart?.(e, index)}
        onDragEnd={onDragEnd}
        onClick={(e) => onOpenMenu?.(e, index)}
      >
        <GripVertical size={16} />
      </button>
    </div>
  )
}
