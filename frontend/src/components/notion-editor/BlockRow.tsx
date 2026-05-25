import type { Block } from './model'

interface BlockRowProps {
  block: Block
  active?: boolean
  dragOver?: string
  onSetActive?: (id: string) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  children: React.ReactNode
}

export function BlockRow({
  block,
  active,
  dragOver,
  onSetActive,
  onMouseEnter,
  onMouseLeave,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: BlockRowProps) {
  const rowStyle: React.CSSProperties = {}
  const skipRowColors = block.type === 'callout'
  if (!skipRowColors && block.textColor) {
    rowStyle.color = block.textColor
  }
  if (!skipRowColors && block.bgColor) {
    rowStyle.backgroundColor = block.bgColor
  }

  return (
    <div
      className={`block-row group relative ${active ? 'active' : ''} ${dragOver || ''}`}
      data-block-id={block.id}
      style={rowStyle}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="min-w-0 py-[3px] px-[2px]" onMouseDown={() => onSetActive?.(block.id)}>
        {children}
      </div>
    </div>
  )
}
