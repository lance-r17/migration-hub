import type { Block } from './model'

/* ------------------------------------------------------------------
   Drag state (source block being dragged)
   ------------------------------------------------------------------ */
type DragState = {
  block: Block
  removeFromSource: () => void
}

let drag: DragState | null = null

export function startDrag(block: Block, removeFromSource: () => void) {
  drag = { block, removeFromSource }
}

export function getDraggedBlock(): Block | null {
  return drag?.block ?? null
}

/** Call when the drop is accepted by a target. Removes the block from source. */
export function finishDrag() {
  drag?.removeFromSource()
  drag = null
  clearDropTarget()
}

/** Call when the drag ends without a successful drop (e.g. Esc or dropped outside). */
export function cancelDrag() {
  drag = null
  clearDropTarget()
}

/* ------------------------------------------------------------------
   Global drop target (single active indicator across all editors)
   ------------------------------------------------------------------ */
export type DropTarget = {
  editorId: string
  index: number
  where: 'above' | 'below' | 'left' | 'right' | 'column-insert'
  columnInsertAt?: number
}

let currentDropTarget: DropTarget | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((fn) => fn())
}

export function setDropTarget(target: DropTarget | null) {
  currentDropTarget = target
  emit()
}

export function getDropTarget(): DropTarget | null {
  return currentDropTarget
}

export function clearDropTarget() {
  currentDropTarget = null
  emit()
}

export function subscribeDropTarget(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
