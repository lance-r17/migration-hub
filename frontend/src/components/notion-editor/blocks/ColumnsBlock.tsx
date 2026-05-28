import { useMemo, Fragment, useRef, useState, useEffect } from 'react'
import { NotionEditor } from '../NotionEditor'
import { createBlock } from '../model'
import { getDraggedBlock, finishDrag, cancelDrag } from '../drag-state'
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

  // Column resize state — stored as pixel-ratio widths (flex-grow values).
  // When colWidths is missing or stale, default to equal ratios so that
  // count changes produce smooth flex transitions (e.g. 0.5 → 0.333).
  const effectiveWidths = b.colWidths?.length === count
    ? b.colWidths
    : Array.from({ length: count }, () => 1 / count)
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  // Reset stale liveWidths when the column count changes (e.g. after a column is added/removed).
  // Without this, a liveWidths array from a 2-col resize survives a count change to 3 columns,
  // causing column 2 to receive `flex: undefined 1 0px` → invalid CSS → collapsed column.
  useEffect(() => { setLiveWidths(null) }, [count])
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
    if (exitingCols.has(index)) return

    setExitingCols(prev => new Set(prev).add(index))

    setTimeout(() => {
      setExitingCols(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })

      const nextCols = columns.filter((_, i) => i !== index)
      const baseWidths = currentWidths ?? Array.from({ length: count }, () => 1)
      const removed = baseWidths[index]
      const nextWidths = baseWidths
        .filter((_, i) => i !== index)
        .map(w => w + removed / (count - 1))
      onChange({ count: count - 1, columns: nextCols, colWidths: nextWidths })
    }, 200)
  }

  const handleEmptyClick = (index: number) => {
    if (readOnly) return
    updateColumn(index, [createBlock('paragraph')])
  }

  const [spacerDropIdx, setSpacerDropIdx] = useState<number | null>(null)
  const [exitingCols, setExitingCols] = useState<Set<number>>(new Set())

  const canAddColumn = count < 5

  return (
    <div className="flex group/cols" ref={containerRef} data-columns-container data-resizing={isResizing ? 'true' : undefined}>
      {Array.from({ length: count }).map((_, i) => {
        const colBlocks = columns[i]
        const isEmpty = colBlocks.length === 0
        const isExiting = exitingCols.has(i)

        return (
          <Fragment key={i}>
            <div
              className="col-item min-w-0"
              style={{
                flex: isExiting ? '0 1 0px' : `${currentWidths![i]} 1 0px`,
                opacity: isExiting ? 0 : 1,
                overflow: 'hidden',
                transition: isResizing ? undefined : 'flex 200ms ease, opacity 200ms ease',
              }}
            >
              <div className="flex flex-col">
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
                          const srcColIdx = columns.findIndex(col => col.some(b => b.id === dragged.id))
                          if (srcColIdx !== -1 && srcColIdx !== i) {
                            const rawNext = columns.map((col, j) => {
                              if (j === srcColIdx) return col.filter(b => b.id !== dragged.id)
                              if (j === i) return [dragged]
                              return col
                            })
                            const nextCols = rawNext.filter(col => col.length > 0)
                            if (nextCols.length <= 1) {
                              onFlatten?.(nextCols[0] ?? [createBlock('paragraph')])
                            } else {
                              onChange({ count: nextCols.length, columns: nextCols })
                            }
                            cancelDrag()
                          } else {
                            updateColumn(i, [dragged])
                            finishDrag()
                          }
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
                        // Detect cross-column move: onBlocksChange fires before finishDrag,
                        // so getDraggedBlock() still returns the block. Do the full move
                        // atomically in one onChange to avoid stale-state conflicts, then
                        // cancelDrag() so the subsequent finishDrag() becomes a no-op.
                        const dragged = getDraggedBlock()
                        if (dragged) {
                          const srcColIdx = columns.findIndex(col => col.some(b => b.id === dragged.id))
                          if (srcColIdx !== -1 && srcColIdx !== i) {
                            const rawNext = columns.map((col, j) => {
                              if (j === i) return blocks
                              if (j === srcColIdx) return col.filter(b => b.id !== dragged.id)
                              return col
                            })
                            const nextCols = rawNext.filter(col => col.length > 0)
                            if (nextCols.length <= 1) {
                              onFlatten?.(nextCols[0] ?? [createBlock('paragraph')])
                            } else {
                              onChange({ count: nextCols.length, columns: nextCols })
                            }
                            cancelDrag()
                            return
                          }
                        }
                        updateColumn(i, blocks)
                      }
                    }}
                    readOnly={readOnly}
                    nested
                    allowEmpty
                  />
                )}
              </div>
            </div>

            {i < count - 1 && (
              <div
                className="relative flex-none"
                style={{ width: 46, transition: 'opacity 200ms ease' }}
                data-column-spacer
                onDragOver={(e) => {
                  if (readOnly) return
                  const dragged = getDraggedBlock()
                  if (!dragged) return
                  if (!canAddColumn) return
                  e.preventDefault()
                  e.stopPropagation()
                  setSpacerDropIdx(i)
                }}
                onDragLeave={(e) => {
                  e.stopPropagation()
                  setSpacerDropIdx(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSpacerDropIdx(null)
                  if (readOnly) return
                  const dragged = getDraggedBlock()
                  if (!dragged || !canAddColumn) return

                  const insertAt = i + 1
                  const srcColIdx = columns.findIndex(col => col.some(b => b.id === dragged.id))

                  if (srcColIdx !== -1) {
                    // Reorder within same columns block
                    let newCols = columns.map((col, j) =>
                      j === srcColIdx ? col.filter(b => b.id !== dragged.id) : col
                    )
                    let adj = insertAt
                    if (newCols[srcColIdx].length === 0) {
                      if (srcColIdx < insertAt) adj--
                      newCols = newCols.filter((_, j) => j !== srcColIdx)
                    }
                    newCols.splice(adj, 0, [dragged])
                    if (newCols.length <= 1) {
                      onFlatten?.(newCols[0] ?? [createBlock('paragraph')])
                    } else {
                      onChange({ count: newCols.length, columns: newCols })
                    }
                    cancelDrag()
                  } else {
                    // Add dragged block as a new column from outside
                    const newCols = [...columns]
                    newCols.splice(insertAt, 0, [dragged])
                    onChange({ count: count + 1, columns: newCols })
                    finishDrag()
                  }
                }}
              >
                {spacerDropIdx === i && (
                  <div className="absolute pointer-events-none z-[88] top-0 bottom-0 left-[21px] w-1 bg-[rgba(35,131,226,0.43)]">
                    <div className="relative w-1 h-0.5 bg-background -top-0.5" />
                    <div className="relative w-1 h-0.5 bg-background top-[calc(100%-2px)]" />
                  </div>
                )}
                <div className="spacer-line absolute top-0 bottom-0 left-[21px] w-1 h-full bg-border/40 transition-colors" />
                {!readOnly && (
                  <div
                    className="absolute inset-0 cursor-col-resize group/rh"
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
