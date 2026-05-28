import type { Block } from './model'

const BLOCK_TYPE_META: Record<string, { className?: string; dir?: string; style?: React.CSSProperties }> = {
  columns: { className: 'notion-column_list-block', dir: 'auto', style: { alignSelf: 'center' } },
  callout: { className: 'notion-callout-block', dir: 'auto', style: { paddingTop: 8, paddingBottom: 8, paddingInline: 8 } },
  tabs:    { className: 'notion-tab-block',    dir: 'ltr', style: { paddingTop: 8, paddingBottom: 8, paddingInline: 8 } },
  quote:   { className: 'notion-quote-block',  dir: 'auto', style: { paddingTop: 8, paddingBottom: 8, paddingInline: 8 } },
}

function getBlockMeta(type: string) {
  const meta = BLOCK_TYPE_META[type]
  return {
    className: meta?.className || '',
    dir: meta?.dir || 'auto',
    style: meta?.style || { paddingTop: 3, paddingBottom: 3, paddingInline: 2 },
  }
}

export interface DropIndicatorProps {
  where: 'above' | 'below' | 'left' | 'right'
}

export function DropIndicator({ where }: DropIndicatorProps) {
  const tint = 'absolute pointer-events-none z-[88] bg-primary/[0.06]'
  switch (where) {
    case 'above':
      return <div className={`${tint} left-0 right-0 -top-2 h-4`} />
    case 'below':
      return (
        <div
          className="absolute pointer-events-none z-[88] start-0 end-0 -bottom-1 h-1 bg-[rgba(35,131,226,0.43)] transition-opacity duration-200"
          style={{ transitionTimingFunction: 'ease' }}
        >
          <div className="relative start-[-2px] w-[2px] h-1 bg-background" />
        </div>
      )
    case 'left':
      return (
        <div
          className="absolute pointer-events-none z-[88] top-0 bottom-0 start-[-8px] w-1 bg-[rgba(35,131,226,0.43)] transition-opacity duration-200"
          style={{ transitionTimingFunction: 'ease' }}
        >
          <div className="relative w-1 h-0.5 bg-background -top-0.5" />
        </div>
      )
    case 'right':
      return (
        <div
          className="absolute pointer-events-none z-[88] top-0 bottom-0 end-[-8px] w-1 bg-[rgba(35,131,226,0.43)] transition-opacity duration-200"
          style={{ transitionTimingFunction: 'ease' }}
        >
          <div className="relative w-1 h-0.5 bg-background -top-0.5" />
        </div>
      )
  }
}

interface BlockRowProps {
  block: Block
  active?: boolean
  dropWhere?: 'above' | 'below' | 'left' | 'right'
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
  dropWhere,
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

  const meta = getBlockMeta(block.type)

  return (
    <div
      className={`block-row notion-selectable ${meta.className} group relative ${active ? 'active' : ''}`}
      data-block-id={block.id}
      dir={meta.dir}
      style={{ ...rowStyle, ...meta.style }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="min-w-0" onMouseDown={() => onSetActive?.(block.id)}>
        {children}
      </div>
      {dropWhere && <DropIndicator where={dropWhere} />}
    </div>
  )
}
