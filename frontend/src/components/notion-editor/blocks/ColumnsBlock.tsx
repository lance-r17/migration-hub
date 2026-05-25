import { useMemo, Fragment } from 'react'
import { NotionEditor } from '../NotionEditor'
import { createBlock } from '../model'
import { getDraggedBlock, commitDrop } from '../drag-state'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

const EMPTY: Block[] = []

export function ColumnsBlock({ block, onChange, onDelete, onFlatten, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'columns' }>
  const count = b.count ?? 2

  // Normalize so every column slot has a stable array reference
  const columns = useMemo(() => {
    const cols = b.columns ? b.columns.slice(0, count) : []
    while (cols.length < count) cols.push(EMPTY)
    return cols
  }, [b.columns, count])

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
    onChange({ count: count - 1, columns: nextCols })
  }

  const handleEmptyClick = (index: number) => {
    if (readOnly) return
    updateColumn(index, [createBlock('paragraph')])
  }

  return (
    <div className="flex gap-4">
      {Array.from({ length: count }).map((_, i) => {
        const colBlocks = columns[i]
        const isEmpty = colBlocks.length === 0

        return (
          <Fragment key={i}>
            <div className="flex-1 min-w-0">
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
              <div className="w-px bg-border flex-none" />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
