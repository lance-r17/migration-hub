import { useMemo, Fragment, useRef, useState, useEffect } from 'react'
import { NotionEditor } from '../NotionEditor'
import { createBlock } from '../model'
import { getDraggedBlock, commitDrop } from '../drag-state'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

const EMPTY: Block[] = []

export function ColumnsBlock({ block, onChange, onDelete, onFlatten, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'columns' }>
  const count = b.count ?? 2

  const columns = useMemo(() => {
    const cols = b.columns ? b.columns.slice(0, count) : []
    while (cols.length < count) cols.push(EMPTY)
    return cols
  }, [b.columns, count])

  // Column resize state — stored as pixel-ratio widths (flex-grow values)
  const effectiveWidths = b.colWidths?.length === count ? b.colWidths : null
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ col: number; startX: number; startWidths: number[] } | null>(null)
  const pendingWidthsRef = useRef<number[] | null>(null)
  const applyRef = useRef(onChange)
  applyRef.current = onChange

  const currentWidths = liveWidths ?? effectiveWidths

  const onResizeStart = (col: number) => (e: React.MouseEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const colEls = container.querySelectorAll<HTMLElement>(':scope > .col-item')
    const startWidths = Array.from(colEls).map(el => el.getBoundingClientRect().width)
    if (startWidths.length !== count) return
    resizeRef.current = { col, startX: e.clientX, startWidths }
    pendingWidthsRef.current = [...startWidths]
    setLiveWidths([...startWidths])
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMouseMove = (e: MouseEvent) => {
      const state = resizeRef.current
      if (!state) return
      const { col, startX, startWidths } = state
      const delta = e.clientX - startX
      const minW = 48
      const total = startWidths[col] + startWidths[col + 1]
      const newLeft = Math.max(minW, Math.min(total - minW, startWidths[col] + delta))
      const newWidths = [...startWidths]
      newWidths[col] = newLeft
      newWidths[col + 1] = total - newLeft
      pendingWidthsRef.current = newWidths
      setLiveWidths(newWidths)
    }
    const onMouseUp = () => {
      if (pendingWidthsRef.current) applyRef.current({ colWidths: pendingWidthsRef.current })
      setIsResizing(false)
      setLiveWidths(null)
      resizeRef.current = null
      pendingWidthsRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const updateColumn = (index: number, blocks: Block[]) => {
    const next = columns.map((c, i) => (i === index ? blocks : c))
    onChange({ columns: next })
  }

  const removeColumn = (index: number) => {
    if (count === 2) {
      const remainingIndex = index === 0 ? 1 : 0
      onFlatten?.(columns[remainingIndex] || [])
      return
    }
    if (count <= 1) {
      onDelete?.()
      return
    }
    const nextCols = columns.filter((_, i) => i !== index)
    // Distribute removed column's width equally to remaining columns
    const baseWidths = currentWidths ?? Array.from({ length: count }, () => 1)
    const removed = baseWidths[index]
    const nextWidths = baseWidths
      .filter((_, i) => i !== index)
      .map(w => w + removed / (count - 1))
    onChange({ count: count - 1, columns: nextCols, colWidths: nextWidths })
  }

  const handleEmptyClick = (index: number) => {
    if (readOnly) return
    updateColumn(index, [createBlock('paragraph')])
  }

  return (
    <div className="flex group/cols" ref={containerRef}>
      {Array.from({ length: count }).map((_, i) => {
        const colBlocks = columns[i]
        const isEmpty = colBlocks.length === 0

        return (
          <Fragment key={i}>
            <div
              className={`col-item min-w-0${i > 0 ? ' pl-4' : ''}${i < count - 1 ? ' pr-4' : ''}`}
              style={currentWidths ? { flex: `${currentWidths[i]} 1 0px` } : { flex: '1 1 0px' }}
            >
              {isEmpty ? (
                readOnly ? (
                  <div className="min-h-[1.5em]" />
                ) : (
                  <div
                    className="rounded-md transition-colors px-2 py-1 -mx-2 -my-1"
                    onDragOver={(e) => {
                      if (readOnly) return
                      if (getDraggedBlock()) e.preventDefault()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (readOnly) return
                      const dragged = getDraggedBlock()
                      if (dragged) {
                        updateColumn(i, [dragged])
                        commitDrop()
                      }
                    }}
                  >
                    <button
                      className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer bg-transparent border-0 p-0"
                      onClick={() => handleEmptyClick(i)}
                    >
                      Empty column. Click or drop blocks inside.
                    </button>
                  </div>
                )
              ) : (
                <NotionEditor
                  blocks={colBlocks}
                  onBlocksChange={(blocks) => {
                    if (blocks.length === 0) {
                      removeColumn(i)
                    } else {
                      updateColumn(i, blocks)
                    }
                  }}
                  readOnly={readOnly}
                  nested
                  allowEmpty
                />
              )}
            </div>

            {i < count - 1 && (
              <div className="relative w-0 flex-none overflow-visible z-10">
                {readOnly ? null : (
                  <div
                    className="absolute inset-y-0 -left-[12px] w-[24px] cursor-col-resize group/rh"
                    onMouseDown={onResizeStart(i)}
                  >
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity pointer-events-none ${
                      isResizing && resizeRef.current?.col === i
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/rh:opacity-100'
                    }`}>
                      <div className={`w-[5px] h-full rounded-full ${
                        isResizing && resizeRef.current?.col === i ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
