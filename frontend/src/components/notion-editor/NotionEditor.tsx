import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react'
import './styles.css'
import { BlockRow } from './BlockRow'
import { BlockHoverControls } from './BlockHoverControls'
import BLOCK_RENDERERS from './blocks'
import { SlashMenu } from './SlashMenu'
import { VariableMenu } from './VariableMenu'
import { BlockMenu } from './BlockMenu'
import { InlineToolbar } from './InlineToolbar'
import { createBlock, cloneBlock, SLASH_ITEMS, type Block } from './model'
import { TEXT_COLOR_MAP, BG_COLOR_MAP, TEXT_CSS_TO_VALUE, BG_CSS_TO_VALUE } from './blocks/table-constants'
import {
  startDrag, getDraggedBlock, finishDrag, cancelDrag,
  subscribeDropTarget, getDropTarget, setDropTarget, clearDropTarget,
  type DropTarget,
} from './drag-state'

function isEmptyHTML(html: string) {
  if (!html) return true
  const div = document.createElement('div')
  div.innerHTML = html
  return !div.textContent?.trim()
}

function getCaretXY() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0).cloneRange()
  let rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    const span = document.createElement('span')
    span.appendChild(document.createTextNode('\u200b'))
    range.insertNode(span)
    rect = span.getBoundingClientRect()
    span.remove()
  }
  return { left: rect.left, top: rect.bottom + 4 }
}

function stripFromOffset(editable: HTMLDivElement, textOffset: number) {
  let remaining = textOffset
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT, null)
  let cutNode: Text | null = null
  let cutAt = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const len = node.nodeValue?.length || 0
    if (remaining > len) { remaining -= len; continue }
    if (remaining === len) { cutNode = node; cutAt = len; break }
    cutNode = node; cutAt = remaining; break
  }
  if (!cutNode) return null
  let after = false
  const toRemove: Text[] = []
  const walker2 = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT, null)
  while (walker2.nextNode()) {
    const n = walker2.currentNode as Text
    if (n === cutNode) { after = true; continue }
    if (after) toRemove.push(n)
  }
  cutNode.nodeValue = cutNode.nodeValue?.slice(0, cutAt) || ''
  toRemove.forEach(n => n.parentNode?.removeChild(n))
  Array.from(editable.querySelectorAll('*')).forEach(el => {
    if (el.childNodes.length === 0 && el.tagName !== 'BR') el.remove()
  })
  const html = editable.innerHTML
  if (/^\s*<br\s*\/?>\s*$/i.test(html)) return ''
  return html
}

export interface NotionEditorProps {
  title?: string
  onTitleChange?: (title: string) => void
  blocks: Block[]
  onBlocksChange?: (blocks: Block[]) => void
  readOnly?: boolean
  showTitle?: boolean
  nested?: boolean
  allowEmpty?: boolean
}

export function NotionEditor({
  title,
  onTitleChange,
  blocks,
  onBlocksChange,
  readOnly,
  showTitle = false,
  nested = false,
  allowEmpty = false,
}: NotionEditorProps) {
  const [localBlocks, setLocalBlocks] = useState<Block[]>(blocks)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)
  const [slash, setSlash] = useState<{ blockId: string; pos: { left: number; top: number }; query: string } | null>(null)
  const [varMenu, setVarMenu] = useState<{ blockId: string; pos: { left: number; top: number }; query: string } | null>(null)
  const [blockMenu, setBlockMenu] = useState<{ index: number; pos: { left: number; top: number } } | null>(null)
  const dropTarget = useSyncExternalStore(subscribeDropTarget, getDropTarget)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasMenuOpenRef = useRef(false)
  const layoutRef = useRef<HTMLDivElement>(null)
  const editorIdRef = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
  const editorId = editorIdRef.current

  const scheduleHide = useCallback(() => {
    if (slash || varMenu || blockMenu) return
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHoveredIdx(null), 150)
  }, [slash, varMenu, blockMenu])

  const cancelHide = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  useEffect(() => {
    const menuOpen = !!(slash || varMenu || blockMenu)
    if (wasMenuOpenRef.current && !menuOpen) {
      const anyHovered = document.querySelector('.block-row:hover, .block-hover-controls:hover')
      if (!anyHovered) {
        if (leaveTimer.current) clearTimeout(leaveTimer.current)
        leaveTimer.current = setTimeout(() => setHoveredIdx(null), 150)
      }
    }
    wasMenuOpenRef.current = menuOpen
  }, [slash, varMenu, blockMenu])

  const blocksRef = useRef(localBlocks)
  useEffect(() => { blocksRef.current = localBlocks }, [localBlocks])

  const onBlocksChangeRef = useRef(onBlocksChange)
  useEffect(() => { onBlocksChangeRef.current = onBlocksChange }, [onBlocksChange])

  /* Highlight the correct column spacer when column-insert is active */
  useEffect(() => {
    document.querySelectorAll('[data-column-spacer][data-drop-active]').forEach(el => {
      el.removeAttribute('data-drop-active')
    })
    if (!dropTarget || dropTarget.editorId !== editorId || dropTarget.where !== 'column-insert') return

    const block = localBlocks[dropTarget.index]
    if (!block || block.type !== 'columns') return

    const row = document.querySelector(`[data-block-id="${block.id}"]`)
    if (!row) return

    const spacers = row.querySelectorAll('[data-column-spacer]')
    const spacer = spacers[dropTarget.columnInsertAt || 0]
    if (spacer) {
      spacer.setAttribute('data-drop-active', 'true')
    }

    return () => {
      spacer?.removeAttribute('data-drop-active')
    }
  }, [dropTarget, localBlocks])

  // Sync external blocks
  useEffect(() => {
    setLocalBlocks(blocks)
  }, [blocks])

  const patchBlock = useCallback((id: string, patch: Partial<Block>) => {
    setLocalBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...patch } as Block : b)
      onBlocksChangeRef.current?.(next)
      return next
    })
  }, [])

  const insertBlock = useCallback((index: number, block: Block, focus = true) => {
    setLocalBlocks(prev => {
      const next = [...prev]
      next.splice(index, 0, block)
      onBlocksChangeRef.current?.(next)
      return next
    })
    if (focus) setAutoFocusId(block.id)
  }, [])

  const removeBlock = useCallback((id: string) => {
    setLocalBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const next = prev.filter(b => b.id !== id)
      if (next.length === 0 && !allowEmpty) next.push(createBlock('paragraph'))
      const focusTarget = next[Math.max(0, idx - 1)]
      onBlocksChangeRef.current?.(next)
      if (focusTarget) setAutoFocusId(focusTarget.id)
      return next
    })
  }, [allowEmpty])

  const extractBlock = useCallback((id: string) => {
    setLocalBlocks(prev => {
      const next = prev.filter(b => b.id !== id)
      if (next.length === 0 && !allowEmpty) next.push(createBlock('paragraph'))
      onBlocksChangeRef.current?.(next)
      return next
    })
  }, [allowEmpty])

  const replaceBlock = useCallback((id: string, newBlock: Block, { keepContent = true } = {}) => {
    const next = blocksRef.current.map(b => {
      if (b.id !== id) return b
      const merged = { ...newBlock, id: b.id }
      if (keepContent && 'content' in b && newBlock.type !== 'divider' && newBlock.type !== 'table' && newBlock.type !== 'image' && newBlock.type !== 'bookmark' && newBlock.type !== 'columns') {
        merged.content = (b as { content?: string }).content || ''
      }
      return merged as Block
    })
    setLocalBlocks(next)
    onBlocksChangeRef.current?.(next)
    setAutoFocusId(id)
  }, [])

  const flattenBlock = useCallback((id: string, blocks: Block[]) => {
    const idx = blocksRef.current.findIndex(b => b.id === id)
    if (idx === -1) return
    const next = [...blocksRef.current]
    next.splice(idx, 1, ...blocks)
    setLocalBlocks(next)
    onBlocksChangeRef.current?.(next)
  }, [])

  const onBlockKeyDown = (block: Block, index: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return
    if (e.key === '/') {
      setTimeout(() => {
        const xy = getCaretXY()
        if (xy) setSlash({ blockId: block.id, pos: { left: xy.left, top: xy.top }, query: '' })
      }, 0)
      return
    }
    if (e.key === '{' || e.key === '}') {
      // Trigger variable autocomplete after typing "{{"
      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const caretOffset = range.startOffset
        const nodeText = range.startContainer.textContent || ''
        const beforeCaret = nodeText.slice(0, caretOffset)
        const lastOpen = beforeCaret.lastIndexOf('{{')
        if (lastOpen !== -1) {
          const afterOpen = beforeCaret.slice(lastOpen)
          // Only if no closing braces and no spaces/newlines in query
          if (!afterOpen.includes('}}') && !/[\s\n]/.test(afterOpen.slice(2))) {
            const xy = getCaretXY()
            if (xy) setVarMenu({ blockId: block.id, pos: { left: xy.left, top: xy.top }, query: afterOpen.slice(2) })
          }
        }
      }, 0)
      return
    }
    if (slash && slash.blockId === block.id) {
      if (e.key === 'Escape') setSlash(null)
      return
    }
    if (varMenu && varMenu.blockId === block.id) {
      if (e.key === 'Escape') setVarMenu(null)
      return
    }
    if (e.key === ' ') {
      const editable = e.currentTarget
      const text = editable.textContent || ''
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        if (range.collapsed && block.type === 'paragraph') {
          const map: Record<string, Block['type']> = {
            '#': 'h1', '##': 'h2', '###': 'h3',
            '-': 'bullet', '*': 'bullet',
            '[]': 'todo', '[ ]': 'todo',
            '>': 'quote',
            '1.': 'numbered', '1)': 'numbered',
            '```': 'code',
            '---': 'divider',
          }
          if (map[text]) {
            e.preventDefault()
            replaceBlock(block.id, createBlock(map[text], { content: '' }), { keepContent: false })
            return
          }
        }
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const text = e.currentTarget.textContent || ''
      const isList = ['bullet', 'numbered', 'todo'].includes(block.type)
      if (isList && text.trim() === '') {
        e.preventDefault()
        replaceBlock(block.id, createBlock('paragraph'), { keepContent: false })
        return
      }
      if (block.type === 'code') return
      e.preventDefault()
      const nextType = isList ? block.type : 'paragraph'
      insertBlock(index + 1, createBlock(nextType))
      return
    }
    if (e.key === 'Backspace') {
      const text = e.currentTarget.textContent || ''
      const sel = window.getSelection()
      const atStart = sel && sel.rangeCount > 0 && sel.getRangeAt(0).startOffset === 0 &&
        (sel.anchorNode === e.currentTarget || sel.anchorNode === e.currentTarget.firstChild)
      if (text === '' && localBlocks.length > 1) {
        e.preventDefault()
        if (['h1', 'h2', 'h3', 'bullet', 'numbered', 'todo', 'quote', 'callout'].includes(block.type)) {
          replaceBlock(block.id, createBlock('paragraph'), { keepContent: false })
        } else {
          removeBlock(block.id)
        }
        return
      }
      if (text === '' && localBlocks.length === 1 && allowEmpty) {
        e.preventDefault()
        removeBlock(block.id)
        return
      }
      if (atStart && index > 0 && block.type !== 'paragraph') {
        e.preventDefault()
        replaceBlock(block.id, createBlock('paragraph'))
        return
      }
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const editable = e.currentTarget
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const elRect = editable.getBoundingClientRect()
      if (e.key === 'ArrowUp' && rect.top - elRect.top < 4) {
        const prev = localBlocks[index - 1]
        if (prev) { e.preventDefault(); setAutoFocusId(prev.id) }
      } else if (e.key === 'ArrowDown' && elRect.bottom - rect.bottom < 4) {
        const next = localBlocks[index + 1]
        if (next) { e.preventDefault(); setAutoFocusId(next.id) }
      }
    }
  }

  useEffect(() => {
    if (!slash) return
    const onInput = (e: Event) => {
      const ed = e.target as HTMLDivElement
      if (!ed?.dataset || ed.dataset.blockId !== slash.blockId) return
      const text = ed.textContent || ''
      const lastSlash = text.lastIndexOf('/')
      if (lastSlash === -1) { setSlash(null); return }
      const q = text.slice(lastSlash + 1)
      if (q.includes(' ') && q.length > 30) { setSlash(null); return }
      setSlash(s => s ? { ...s, query: q } : s)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ' && slash && slash.query === '') setSlash(null) }
    document.addEventListener('input', onInput, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [slash])

  /* inline hint after "/" when slash menu is open with empty query */
  useEffect(() => {
    if (!slash || slash.query !== '') {
      document.querySelectorAll('[data-slash-empty]').forEach(el => el.removeAttribute('data-slash-empty'))
      return
    }
    const ed = document.querySelector(`[data-block-id="${slash.blockId}"] .notion-editable`) as HTMLDivElement | null
    if (ed) ed.setAttribute('data-slash-empty', 'true')
  }, [slash])

  const pickSlash = useCallback((item: (typeof SLASH_ITEMS)[number]) => {
    if (!slash) return
    const block = blocksRef.current.find(b => b.id === slash.blockId)
    if (!block) { setSlash(null); return }
    const editable = document.querySelector(`[data-block-id="${block.id}"] .notion-editable`) as HTMLDivElement | null
    if (editable) {
      const text = editable.textContent || ''
      const lastSlash = text.lastIndexOf('/')
      const newHTML = stripFromOffset(editable, lastSlash)
      patchBlock(block.id, { content: newHTML !== null ? newHTML : text.slice(0, lastSlash) })
    }
    setSlash(null)
    const idx = blocksRef.current.findIndex(b => b.id === slash.blockId)
    const newBlock = createBlock(item.type, item.init || {})
    setTimeout(() => {
      const cur = blocksRef.current.find(b => b.id === slash.blockId)
      const emptyNow = cur && isEmptyHTML((cur as { content?: string }).content || '')
      if (emptyNow) replaceBlock(slash.blockId, newBlock, { keepContent: false })
      else insertBlock(idx + 1, newBlock)
    }, 0)
  }, [slash, patchBlock, replaceBlock, insertBlock])

  /* variable autocomplete input tracking */
  useEffect(() => {
    if (!varMenu) return
    const onInput = (e: Event) => {
      const ed = e.target as HTMLDivElement
      if (!ed?.dataset || ed.dataset.blockId !== varMenu.blockId) return
      const text = ed.textContent || ''
      const lastOpen = text.lastIndexOf('{{')
      if (lastOpen === -1) { setVarMenu(null); return }
      const afterOpen = text.slice(lastOpen)
      if (afterOpen.includes('}}')) { setVarMenu(null); return }
      const q = afterOpen.slice(2)
      if (/[\s\n]/.test(q)) { setVarMenu(null); return }
      setVarMenu(s => s ? { ...s, query: q } : s)
    }
    document.addEventListener('input', onInput, true)
    return () => document.removeEventListener('input', onInput, true)
  }, [varMenu])

  const pickVar = useCallback((key: string) => {
    if (!varMenu) return
    const block = blocksRef.current.find(b => b.id === varMenu.blockId)
    if (!block) { setVarMenu(null); return }
    const editable = document.querySelector(`[data-block-id="${block.id}"] .notion-editable`) as HTMLDivElement | null
    if (editable) {
      const text = editable.textContent || ''
      const lastOpen = text.lastIndexOf('{{')
      if (lastOpen !== -1) {
        const query = text.slice(lastOpen + 2)
        const before = text.slice(0, lastOpen)
        const after = text.slice(lastOpen + 2 + query.length)
        const newText = before + '{{' + key + '}}' + after
        patchBlock(block.id, { content: newText })
      }
    }
    setVarMenu(null)
  }, [varMenu, patchBlock])

  /* block drag/drop reorder */
  const onDragStart = (e: React.DragEvent, idx: number) => {
    if (readOnly) return
    const block = localBlocks[idx]
    startDrag(block, () => extractBlock(block.id))
    e.dataTransfer.effectAllowed = 'move'

    const row = document.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement | null
    if (row) {
      const ghost = row.cloneNode(true) as HTMLElement
      ghost.classList.remove('active')
      ghost.removeAttribute('data-block-id')
      const rect = row.getBoundingClientRect()
      ghost.style.width = `${rect.width}px`
      ghost.style.opacity = '0.92'
      ghost.style.background = 'hsl(var(--background))'
      ghost.style.borderRadius = '6px'
      ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
      ghost.style.position = 'fixed'
      ghost.style.top = '-9999px'
      ghost.style.left = '-9999px'
      ghost.style.pointerEvents = 'none'
      ghost.style.zIndex = '-1'
      ghost.style.overflow = 'hidden'
      document.body.appendChild(ghost)
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY)
      requestAnimationFrame(() => {
        if (ghost.parentNode) document.body.removeChild(ghost)
      })
    }
  }

  const onDragOverRow = (e: React.DragEvent, idx: number) => {
    if (readOnly) return
    const dragged = getDraggedBlock()
    if (!dragged) return
    e.preventDefault()

    const rowEl = e.currentTarget as HTMLElement

    // If the event originated from inside a nested editor AND this BlockRow
    // is a top-level row (not inside a nested editor itself), skip handling
    // so the nested editor can manage its own indicator.
    const isThisRowNested = !!rowEl.closest('[data-nested-editor]')
    if (!isThisRowNested && (e.target as HTMLElement).closest?.('[data-nested-editor]')) {
      return
    }
    const rect = rowEl.getBoundingClientRect()
    const xRel = e.clientX - rect.left
    const xPct = xRel / rect.width
    const yRel = e.clientY - rect.top
    const target = localBlocks[idx]

    // --- Parent columns block handling ---
    if (target?.type === 'columns' && dragged.type !== 'columns') {
      const cb = target as Extract<Block, { type: 'columns' }>
      const margin = 8

      // Near top/bottom of the columns block itself
      if (yRel < margin) {
        setDropTarget({ editorId, index: idx, where: 'above' })
        return
      }
      if (yRel > rect.height - margin) {
        setDropTarget({ editorId, index: idx, where: 'below' })
        return
      }

      // Near a column spacer (divider) — show column-insert on the handle
      const colsContainer = rowEl.querySelector('[data-columns-container]') as HTMLElement | null
      if (colsContainer && cb.count < 4) {
        const xRel = e.clientX - rect.left
        const children = Array.from(colsContainer.children) as HTMLElement[]
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (!child.hasAttribute('data-column-spacer')) continue
          const childRect = child.getBoundingClientRect()
          const spacerCenter = (childRect.left - rect.left) + childRect.width / 2
          if (Math.abs(xRel - spacerCenter) < 30) {
            const insertAt = Math.floor(i / 2)
            setDropTarget({ editorId, index: idx, where: 'column-insert', columnInsertAt: insertAt })
            return
          }
        }
      }

      // Over nested content — let nested editor handle the rest
      const isOverNested = !!(e.target as HTMLElement).closest?.('[data-nested-editor]')
      if (isOverNested) {
        if (dropTarget?.editorId === editorId && dropTarget?.index === idx) clearDropTarget()
        return
      }

      // Fallback for gaps between nested editors (e.g. empty columns)
      if (cb.count < 4) {
        const insertAt = Math.min(Math.round(xPct * cb.count), cb.count)
        setDropTarget({ editorId, index: idx, where: 'column-insert', columnInsertAt: insertAt })
        return
      }
    }

    // --- Nested editor handling ---
    // If near a shared column edge (spacer between columns), clear our indicator
    // and let the parent columns block show the divider highlight.
    const nestedEditor = rowEl.closest('[data-nested-editor]') as HTMLElement | null
    if (nestedEditor) {
      const colItem = nestedEditor.parentElement?.parentElement as HTMLElement | null
      if (colItem) {
        const colRect = colItem.getBoundingClientRect()
        const xInCol = e.clientX - colRect.left
        const edgeMargin = 24
        const nearLeftEdge = xInCol < edgeMargin
        const nearRightEdge = xInCol > colRect.width - edgeMargin
        const hasLeftSpacer = !!colItem.previousElementSibling?.hasAttribute('data-column-spacer')
        const hasRightSpacer = !!colItem.nextElementSibling?.hasAttribute('data-column-spacer')

        if ((nearLeftEdge && hasLeftSpacer) || (nearRightEdge && hasRightSpacer)) {
          if (dropTarget?.editorId === editorId && dropTarget?.index === idx) clearDropTarget()
          return
        }
      }
    }

    if (dragged.id === target?.id) {
      if (dropTarget?.editorId === editorId && dropTarget?.index === idx) clearDropTarget()
      return
    }

    // Inside block row — show bottom horizontal indicator
    setDropTarget({ editorId, index: idx, where: 'below' })
  }

  const onDropRow = (e: React.DragEvent, targetIdx: number) => {
    if (readOnly) return
    e.preventDefault()

    const dragged = getDraggedBlock()
    if (!dragged) {
      clearDropTarget()
      return
    }

    // If near a shared column edge, let the parent columns block handle the drop.
    // Don't stop propagation so the parent's onDropRow can process it.
    const rowEl = e.currentTarget as HTMLElement
    const nestedEditor = rowEl.closest('[data-nested-editor]') as HTMLElement | null
    if (nestedEditor) {
      const colItem = nestedEditor.parentElement?.parentElement as HTMLElement | null
      if (colItem) {
        const colRect = colItem.getBoundingClientRect()
        const xInCol = e.clientX - colRect.left
        const edgeMargin = 24
        const nearLeftEdge = xInCol < edgeMargin
        const nearRightEdge = xInCol > colRect.width - edgeMargin
        const hasLeftSpacer = !!colItem.previousElementSibling?.hasAttribute('data-column-spacer')
        const hasRightSpacer = !!colItem.nextElementSibling?.hasAttribute('data-column-spacer')

        if ((nearLeftEdge && hasLeftSpacer) || (nearRightEdge && hasRightSpacer)) {
          clearDropTarget()
          return
        }
      }
    }

    e.stopPropagation()

    const target = localBlocks[targetIdx]
    let where = (dropTarget?.editorId === editorId ? dropTarget?.where : undefined) || 'below'

    // Guard: never create nested columns. Fallback to below.
    if ((where === 'left' || where === 'right') && dragged.type === 'columns') {
      where = 'below'
    }

    // Guard: blocks inside a columns block never get left/right drops.
    const isInsideColumns = !!(rowEl.closest('[data-nested-editor]') as HTMLElement | null)
    if (isInsideColumns && (where === 'left' || where === 'right')) {
      where = 'below'
    }

    switch (where) {
      case 'column-insert': {
        if (target?.type !== 'columns') break
        const cb = target as Extract<Block, { type: 'columns' }>
        const insertAt = (dropTarget?.editorId === editorId ? dropTarget?.columnInsertAt : undefined) ?? 0

        // Is the dragged block already inside this columns block?
        const srcColIdx = cb.columns.findIndex(col => col.some(b => b.id === dragged.id))

        if (srcColIdx !== -1) {
          // Atomic column reorder within the same columns block
          let newCols = cb.columns.map((col, j) =>
            j === srcColIdx ? col.filter(b => b.id !== dragged.id) : col
          )
          let adj = insertAt
          if (newCols[srcColIdx].length === 0) {
            if (srcColIdx < insertAt) adj--
            newCols = newCols.filter((_, j) => j !== srcColIdx)
          }
          newCols.splice(adj, 0, [dragged])
          const next =
            newCols.length <= 1
              ? localBlocks.flatMap((b, i) => (i === targetIdx ? (newCols[0] ?? [createBlock('paragraph')]) : [b]))
              : localBlocks.map((b, i) => (i === targetIdx ? { ...cb, count: newCols.length, columns: newCols } as Block : b))
          setLocalBlocks(next)
          blocksRef.current = next
          onBlocksChangeRef.current?.(next)
          cancelDrag()
        } else {
          // Add dragged block as a new column from outside
          const newCols = [...cb.columns]
          newCols.splice(insertAt, 0, [dragged])
          const next = localBlocks.map((b, i) =>
            i === targetIdx ? { ...cb, count: cb.count + 1, columns: newCols } as Block : b
          )
          setLocalBlocks(next)
          blocksRef.current = next
          onBlocksChangeRef.current?.(next)
          finishDrag()
        }
        break
      }

      case 'left':
      case 'right': {
        if (!target || dragged.id === target.id) {
          cancelDrag()
          break
        }

        if (target.type === 'columns') {
          const cb = target as Extract<Block, { type: 'columns' }>
          const insertAt = where === 'left' ? 0 : cb.count

          // Is the dragged block already inside this columns block?
          const srcColIdx = cb.columns.findIndex(col => col.some(b => b.id === dragged.id))

          if (srcColIdx !== -1) {
            let newCols = cb.columns.map((col, j) =>
              j === srcColIdx ? col.filter(b => b.id !== dragged.id) : col
            )
            let adj = insertAt
            if (newCols[srcColIdx].length === 0) {
              if (srcColIdx < insertAt) adj--
              newCols = newCols.filter((_, j) => j !== srcColIdx)
            }
            newCols.splice(adj, 0, [dragged])
            const next =
              newCols.length <= 1
                ? localBlocks.flatMap((b, i) => (i === targetIdx ? (newCols[0] ?? [createBlock('paragraph')]) : [b]))
                : localBlocks.map((b, i) => (i === targetIdx ? { ...cb, count: newCols.length, columns: newCols } as Block : b))
            setLocalBlocks(next)
            blocksRef.current = next
            onBlocksChangeRef.current?.(next)
            cancelDrag()
          } else {
            const newCols = [...cb.columns]
            newCols.splice(insertAt, 0, [dragged])
            const next = localBlocks.map((b, i) =>
              i === targetIdx ? { ...cb, count: cb.count + 1, columns: newCols } as Block : b
            )
            setLocalBlocks(next)
            blocksRef.current = next
            onBlocksChangeRef.current?.(next)
            finishDrag()
          }
          break
        }

        const [left, right] = where === 'left' ? [dragged, target] : [target, dragged]
        const colBlock = { ...createBlock('columns'), count: 2, columns: [[left], [right]] } as Block

        const dragIdx = localBlocks.findIndex(b => b.id === dragged.id)
        const blocksWithoutDrag = dragIdx !== -1 ? localBlocks.filter((_, i) => i !== dragIdx) : localBlocks
        const tidx = blocksWithoutDrag.findIndex(b => b.id === target.id)
        const next = blocksWithoutDrag.map((b, i) => (i === tidx ? colBlock : b))

        setLocalBlocks(next)
        blocksRef.current = next
        onBlocksChangeRef.current?.(next)
        if (dragIdx !== -1) cancelDrag()
        else finishDrag()
        break
      }

      case 'above':
      case 'below': {
        const dragIdx = localBlocks.findIndex(b => b.id === dragged.id)
        const next = [...localBlocks]
        let insertAt = targetIdx
        if (dragIdx !== -1) {
          next.splice(dragIdx, 1)
          if (dragIdx < targetIdx) insertAt -= 1
        }
        insertAt = where === 'below' ? insertAt + 1 : insertAt
        next.splice(insertAt, 0, dragged)

        setLocalBlocks(next)
        blocksRef.current = next
        onBlocksChangeRef.current?.(next)
        if (dragIdx !== -1) cancelDrag()
        else finishDrag()
        break
      }
    }

    clearDropTarget()
  }

  const onLayoutDragOver = (e: React.DragEvent) => {
    if (readOnly) return
    const dragged = getDraggedBlock()
    if (!dragged) return
    e.preventDefault()

    const root = layoutRef.current
    if (!root) return

    // If the cursor is over a nested editor, let the nested editor handle its own
    // indicators. Don't clear the global drop target here.
    if ((e.target as HTMLElement).closest?.('[data-nested-editor]')) {
      return
    }

    // Find the top-level block row whose vertical range contains the cursor
    const rows = Array.from(root.querySelectorAll('.block-row')).filter((row) => {
      const nested = row.closest('[data-nested-editor]')
      return !nested
    }) as HTMLElement[]

    let targetRow: HTMLElement | null = null
    let targetIdx = -1
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetRow = rows[i]
        targetIdx = i
        break
      }
    }

    if (!targetRow || targetIdx === -1) {
      clearDropTarget()
      return
    }

    const layoutRect = root.getBoundingClientRect()
    const rowRect = targetRow.getBoundingClientRect()
    const target = localBlocks[targetIdx]
    if (!target) return
    if (dragged.type === 'columns' || dragged.id === target.id) {
      clearDropTarget()
      return
    }

    // Left: cursor is in the left margin (layout left edge → row left edge)
    if (e.clientX >= layoutRect.left && e.clientX < rowRect.left) {
      setDropTarget({ editorId, index: targetIdx, where: 'left' })
      return
    }
    // Right: cursor is in the right margin (row right edge → layout right edge)
    if (e.clientX > rowRect.right && e.clientX <= layoutRect.right) {
      setDropTarget({ editorId, index: targetIdx, where: 'right' })
      return
    }

    // Inside block — let onDragOverRow handle the bottom horizontal indicator
  }

  const onLayoutDragLeave = (e: React.DragEvent) => {
    const root = layoutRef.current
    if (!root) return
    const related = e.relatedTarget as Node | null
    if (!related || !root.contains(related)) {
      clearDropTarget()
    }
  }

  const onLayoutDrop = (e: React.DragEvent) => {
    if (readOnly) return
    if (!dropTarget) return
    onDropRow(e, dropTarget.index)
  }

  const onDragEnd = () => {
    clearDropTarget()
    if (getDraggedBlock()) {
      cancelDrag()
    }
  }

  const numberedMap = useMemo(() => {
    const map: Record<string, number> = {}
    let n = 0
    localBlocks.forEach(b => {
      if (b.type === 'numbered') { n += 1; map[b.id] = n }
      else n = 0
    })
    return map
  }, [localBlocks])

  return (
    <div
      ref={nested ? undefined : layoutRef}
      className={nested ? 'flex flex-col min-w-0' : 'notion-layout notion-layout-wide notion-layout-reskin-wider'}
      style={nested ? undefined : { paddingBottom: '30vh' }}
      {...(nested ? { 'data-nested-editor': 'true' } : {})}
      onDragOver={nested ? undefined : onLayoutDragOver}
      onDragLeave={nested ? undefined : onLayoutDragLeave}
      onDrop={nested ? undefined : onLayoutDrop}
    >
      {!nested && showTitle && (
        <div className="notion-layout-content pt-8 pb-2">
          <h1
            className="notion-editable text-[40px] font-bold tracking-[-0.02em] leading-[1.1] outline-none m-0 mb-2 text-foreground"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            data-empty={title ? 'false' : 'true'}
            data-placeholder="Untitled"
            onInput={(e) => onTitleChange?.(e.currentTarget.textContent || '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (localBlocks[0]) setAutoFocusId(localBlocks[0].id)
              }
            }}
            dangerouslySetInnerHTML={{ __html: title || '' }}
          />
        </div>
      )}

      <div className={nested ? 'w-full' : 'notion-layout-content'}>
        <div className="flex flex-col">
          {localBlocks.map((block, i) => {
            const Renderer = BLOCK_RENDERERS[block.type] || BLOCK_RENDERERS.paragraph
            const isActive = activeId === block.id
            const dropWhere = (dropTarget?.editorId === editorId && dropTarget?.index === i && dropTarget.where !== 'column-insert')
              ? dropTarget.where
              : undefined
            return (
              <BlockRow
                key={block.id}
                block={block}
                active={isActive}
                dropWhere={dropWhere}
                onSetActive={setActiveId}
                onMouseEnter={() => { setHoveredIdx(i); cancelHide() }}
                onMouseLeave={scheduleHide}
                onDragOver={(e) => onDragOverRow(e, i)}
                onDragLeave={() => {}}
                onDrop={(e) => onDropRow(e, i)}
              >
                <Renderer
                  block={block}
                  number={numberedMap[block.id]}
                  onChange={(patch) => patchBlock(block.id, patch)}
                  onDelete={() => removeBlock(block.id)}
                  onFlatten={(blocks) => flattenBlock(block.id, blocks)}
                  onKeyDown={onBlockKeyDown(block, i)}
                  onFocus={() => setActiveId(block.id)}
                  autoFocus={autoFocusId === block.id}
                  readOnly={readOnly}
                />
              </BlockRow>
            )
          })}
        </div>
      </div>

      {!readOnly && slash && (
        <SlashMenu query={slash.query} pos={slash.pos} onPick={pickSlash} onClose={() => setSlash(null)} />
      )}
      {!readOnly && varMenu && (
        <VariableMenu query={varMenu.query} pos={varMenu.pos} onPick={pickVar} onClose={() => setVarMenu(null)} />
      )}
      {!readOnly && hoveredIdx !== null && localBlocks[hoveredIdx] && localBlocks[hoveredIdx].type !== 'columns' && (
        <BlockHoverControls
          blockId={localBlocks[hoveredIdx].id}
          index={hoveredIdx}
          readOnly={readOnly}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onAddBelow={(idx) => {
            const newBlock = createBlock('paragraph', { content: '/' })
            insertBlock(idx + 1, newBlock, true)
            requestAnimationFrame(() => {
              const editable = document.querySelector(`[data-block-id="${newBlock.id}"] .notion-editable`) as HTMLDivElement | null
              if (!editable) return
              editable.focus()
              const xy = getCaretXY()
              if (xy) setSlash({ blockId: newBlock.id, pos: { left: xy.left, top: xy.top }, query: '' })
            })
          }}
          onOpenMenu={(e, idx) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setBlockMenu({ index: idx, pos: { left: rect.right + 4, top: rect.top } })
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      )}

      {!readOnly && blockMenu && (
        <BlockMenu
          pos={blockMenu.pos}
          blockType={localBlocks[blockMenu.index]?.type || 'paragraph'}
          hideColor={['code', 'tabs', 'table', 'divider', 'image'].includes(localBlocks[blockMenu.index]?.type)}
          hideTurnInto={['tabs', 'table', 'divider', 'image'].includes(localBlocks[blockMenu.index]?.type)}
          onClose={() => setBlockMenu(null)}
          onDelete={() => {
            const b = localBlocks[blockMenu.index]
            removeBlock(b.id)
            setBlockMenu(null)
          }}
          onDuplicate={() => {
            const b = localBlocks[blockMenu.index]
            const dup = cloneBlock(b)
            insertBlock(blockMenu.index + 1, dup, false)
            setBlockMenu(null)
          }}
          onConvertTo={(t) => {
            const b = localBlocks[blockMenu.index]
            replaceBlock(b.id, createBlock(t))
            setBlockMenu(null)
          }}
          onSetTextColor={(color) => {
            const b = localBlocks[blockMenu.index]
            const css = color === 'default' ? undefined : (TEXT_COLOR_MAP[color] || color)
            patchBlock(b.id, { textColor: css, bgColor: undefined })
            setBlockMenu(null)
          }}
          onSetBgColor={(color) => {
            const b = localBlocks[blockMenu.index]
            const css = color === 'default' ? undefined : (BG_COLOR_MAP[color] || color)
            patchBlock(b.id, { bgColor: css, textColor: undefined })
            setBlockMenu(null)
          }}
          currentColors={{
            textColor: TEXT_CSS_TO_VALUE[localBlocks[blockMenu.index]?.textColor?.toUpperCase() || ''] || 'default',
            bgColor: BG_CSS_TO_VALUE[localBlocks[blockMenu.index]?.bgColor?.toUpperCase() || ''] || 'default',
          }}
        />
      )}
      {!nested && !readOnly && <InlineToolbar />}
    </div>
  )
}
