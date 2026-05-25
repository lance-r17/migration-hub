import type { Block } from './model'

let draggedBlock: Block | null = null
let sourceRemoveFn: (() => void) | null = null

export function beginDrag(block: Block, removeFromSource: () => void) {
  draggedBlock = block
  sourceRemoveFn = removeFromSource
}

export function getDraggedBlock(): Block | null {
  return draggedBlock
}

export function commitDrop() {
  if (sourceRemoveFn) {
    sourceRemoveFn()
  }
  draggedBlock = null
  sourceRemoveFn = null
}

export function cancelDrag() {
  draggedBlock = null
  sourceRemoveFn = null
}
