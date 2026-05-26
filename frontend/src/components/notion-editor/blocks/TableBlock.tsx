import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps, TableMenuState } from './types'
import {
  TEXT_COLOR_MAP,
  BG_COLOR_MAP,
  remapStyles,
  TD_BASE,
} from './table-constants'
import { CellActionMenu } from './CellActionMenu'
import { CellStyleMenu } from './CellStyleMenu'

export function TableBlock({ block, onChange, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'table' }>
  const rows = b.rows
  const cols = b.cols
  const cellStyles = b.cellStyles || {}
  const [focusCell, setFocusCell] = useState<{ r: number; c: number } | null>(null)
  const [menu, setMenu] = useState<TableMenuState | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  const apply = (patch: Partial<Extract<Block, { type: 'table' }>>) => onChange(patch)
  const applyRef = useRef(apply)
  applyRef.current = apply

  // Column widths (% each, sum = 100). null means equal distribution.
  const effectiveWidths = b.colWidths?.length === cols ? b.colWidths : null
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null)
  const currentWidths = liveWidths ?? effectiveWidths
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<{ col: number; startX: number; startWidths: number[]; tableWidth: number } | null>(null)
  const pendingWidthsRef = useRef<number[] | null>(null)

  const onResizeStart = (col: number) => (e: React.MouseEvent) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    const tableEl = tableRef.current
    if (!tableEl) return
    const startWidths = currentWidths
      ? [...currentWidths]
      : Array.from({ length: cols }, () => 100 / cols)
    resizeRef.current = { col, startX: e.clientX, startWidths, tableWidth: tableEl.getBoundingClientRect().width }
    pendingWidthsRef.current = [...startWidths]
    setLiveWidths([...startWidths])
    setIsResizing(true)
  }

  // Pre-compute handle positions for the overlay
  const colHandlePositions = (() => {
    if (readOnly) return []
    const widths = currentWidths ?? Array.from({ length: cols }, () => 100 / cols)
    let cum = 0
    return widths.slice(0, -1).map((w, i) => { cum += w; return { col: i, leftPct: cum } })
  })()

  const setCell = (r: number, c: number, html: string) => {
    apply({ rows: rows.map((row, i) => i === r ? row.map((cell, j) => j === c ? html : cell) : row) })
  }
  const addRow = (at: number) => {
    const next = [...rows]
    next.splice(at, 0, new Array(cols).fill(''))
    apply({ rows: next })
  }
  const addCol = (at: number) => {
    apply({
      cols: cols + 1,
      rows: rows.map(r => { const c = [...r]; c.splice(at, 0, ''); return c }),
    })
  }
  const dupRow = (i: number) => {
    const next = [...rows]
    next.splice(i + 1, 0, [...rows[i]])
    apply({ rows: next })
  }
  const dupCol = (i: number) => {
    apply({
      cols: cols + 1,
      rows: rows.map(r => { const c = [...r]; c.splice(i + 1, 0, r[i]); return c }),
    })
  }
  const clearRow = (i: number) => apply({ rows: rows.map((r, idx) => idx === i ? r.map(() => '') : r) })
  const clearCol = (i: number) => apply({ rows: rows.map(r => r.map((cell, idx) => idx === i ? '' : cell)) })
  const clearCell = (r: number, c: number) => apply({ rows: rows.map((row, i) => i === r ? row.map((cell, j) => j === c ? '' : cell) : row) })
  const delRow = (i: number) => { if (rows.length <= 1) return; apply({ rows: rows.filter((_, idx) => idx !== i) }) }
  const delCol = (i: number) => { if (cols <= 1) return; apply({ cols: cols - 1, rows: rows.map(r => r.filter((_, idx) => idx !== i)) }) }
  const updateCellStyle = (r: number, c: number, patch: { textColor?: string; bgColor?: string }) => {
    const key = `${r},${c}`
    const cur = cellStyles[key] || {}
    const merged = { ...cur, ...patch }
    const isDefault = (!merged.textColor || merged.textColor === 'default') && (!merged.bgColor || merged.bgColor === 'default')
    const next = { ...cellStyles }
    if (isDefault) delete next[key]; else next[key] = merged
    apply({ cellStyles: next })
  }

  const getConsensusColor = (kind: 'col' | 'row', index: number, colorKey: 'textColor' | 'bgColor'): string | undefined => {
    const colors = new Set<string>()
    if (kind === 'row') {
      for (let c = 0; c < cols; c++) {
        colors.add(cellStyles[`${index},${c}`]?.[colorKey] || 'default')
      }
    } else {
      for (let r = 0; r < rows.length; r++) {
        colors.add(cellStyles[`${r},${index}`]?.[colorKey] || 'default')
      }
    }
    return colors.size === 1 ? Array.from(colors)[0] : undefined
  }

  const updateAxisCellStyle = (kind: 'col' | 'row', index: number, patch: { textColor?: string; bgColor?: string }) => {
    const next = { ...cellStyles }
    if (kind === 'row') {
      for (let c = 0; c < cols; c++) {
        const key = `${index},${c}`
        const cur = next[key] || {}
        const merged = { ...cur, ...patch }
        const isDefault = (!merged.textColor || merged.textColor === 'default') && (!merged.bgColor || merged.bgColor === 'default')
        if (isDefault) delete next[key]; else next[key] = merged
      }
    } else {
      for (let r = 0; r < rows.length; r++) {
        const key = `${r},${index}`
        const cur = next[key] || {}
        const merged = { ...cur, ...patch }
        const isDefault = (!merged.textColor || merged.textColor === 'default') && (!merged.bgColor || merged.bgColor === 'default')
        if (isDefault) delete next[key]; else next[key] = merged
      }
    }
    apply({ cellStyles: next })
  }

  const openMenu = (kind: 'col' | 'row' | 'cell', payload: number | { r: number; c: number }, e: React.MouseEvent) => {
    if (readOnly) return
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    const r = target.getBoundingClientRect()
    if (kind === 'col') setMenu({ kind, index: payload as number, pos: { left: r.left, top: r.bottom + 6 } })
    else if (kind === 'row') setMenu({ kind, index: payload as number, pos: { left: r.right + 6, top: r.top } })
    else if (kind === 'cell') setMenu({ kind, r: (payload as { r: number; c: number }).r, c: (payload as { r: number; c: number }).c, pos: { left: r.right + 6, top: r.top } })
  }

  const handleAction = (id: string) => {
    if (!menu) return
    if (menu.kind === 'col') {
      const i = menu.index!
      if (id === 'insert-left') addCol(i)
      if (id === 'insert-right') addCol(i + 1)
      if (id === 'move-left' && i > 0) {
        const next = rows.map(r => { const cp = [...r]; const [m] = cp.splice(i, 1); cp.splice(i - 1, 0, m); return cp })
        const nw = effectiveWidths ? [...effectiveWidths] : null
        if (nw) { const [m] = nw.splice(i, 1); nw.splice(i - 1, 0, m) }
        apply({ rows: next, cellStyles: remapStyles(cellStyles, 'col', i, i - 1), ...(nw ? { colWidths: nw } : {}) })
      }
      if (id === 'move-right' && i < cols - 1) {
        const next = rows.map(r => { const cp = [...r]; const [m] = cp.splice(i, 1); cp.splice(i + 1, 0, m); return cp })
        const nw = effectiveWidths ? [...effectiveWidths] : null
        if (nw) { const [m] = nw.splice(i, 1); nw.splice(i + 1, 0, m) }
        apply({ rows: next, cellStyles: remapStyles(cellStyles, 'col', i, i + 1), ...(nw ? { colWidths: nw } : {}) })
      }
      if (id === 'duplicate') dupCol(i)
      if (id === 'clear') clearCol(i)
      if (id === 'delete') delCol(i)
    } else if (menu.kind === 'row') {
      const i = menu.index!
      if (id === 'insert-above') addRow(i)
      if (id === 'insert-below') addRow(i + 1)
      if (id === 'move-up' && i > 0) {
        const next = [...rows]; const [m] = next.splice(i, 1); next.splice(i - 1, 0, m)
        apply({ rows: next, cellStyles: remapStyles(cellStyles, 'row', i, i - 1) })
      }
      if (id === 'move-down' && i < rows.length - 1) {
        const next = [...rows]; const [m] = next.splice(i, 1); next.splice(i + 1, 0, m)
        apply({ rows: next, cellStyles: remapStyles(cellStyles, 'row', i, i + 1) })
      }
      if (id === 'duplicate') dupRow(i)
      if (id === 'clear') clearRow(i)
      if (id === 'delete') delRow(i)
    }
    setMenu(null)
  }

  const selCol = menu?.kind === 'col' ? menu.index : -1
  const selRow = menu?.kind === 'row' ? menu.index : -1

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if ((t as HTMLElement).closest?.('.cell-menu')) return
      setFocusCell(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!isResizing) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMouseMove = (e: MouseEvent) => {
      const state = resizeRef.current
      if (!state) return
      const delta = e.clientX - state.startX
      const deltaPercent = (delta / state.tableWidth) * 100
      const { col, startWidths } = state
      const minPct = 5
      const total = startWidths[col] + startWidths[col + 1]
      const newLeft = Math.max(minPct, Math.min(total - minPct, startWidths[col] + deltaPercent))
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

  /* drag reorder */
  const [drag, setDrag] = useState<{ kind: 'row' | 'col'; from: number } | null>(null)
  const [dropAt, setDropAt] = useState<{ kind: 'row' | 'col'; index: number; before: boolean } | null>(null)
  const [dragGhost, setDragGhost] = useState<{
    kind: 'row' | 'col'
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [dragContent, setDragContent] = useState<string[] | null>(null)
  const [dragCellDims, setDragCellDims] = useState<number[] | null>(null)

  const onHandleDragStart = (kind: 'row' | 'col', from: number) => (e: React.DragEvent) => {
    if (readOnly) return
    setDrag({ kind, from })
    setMenu(null)
    setFocusCell(null)
    // Capture content for ghost and clear original
    if (kind === 'row') {
      setDragContent(rows[from])
    } else {
      setDragContent(rows.map(row => row[from]))
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `table-${kind}-${from}`)
    // Hide native drag image
    const nativeGhost = document.createElement('div')
    nativeGhost.style.cssText = 'width:1px;height:1px;opacity:0;'
    document.body.appendChild(nativeGhost)
    e.dataTransfer.setDragImage(nativeGhost, 0, 0)
    setTimeout(() => nativeGhost.remove(), 0)
    // Measure and set initial ghost dimensions
    if (wrapRef.current) {
      const wrapR = wrapRef.current.getBoundingClientRect()
      if (kind === 'row') {
        const rowCells = wrapRef.current.querySelectorAll(`tr:nth-child(${from + 1}) > *`)
        if (rowCells.length) {
          const first = rowCells[0] as HTMLElement
          const last = rowCells[rowCells.length - 1] as HTMLElement
          const widths = Array.from(rowCells).map(el => (el as HTMLElement).getBoundingClientRect().width)
          setDragCellDims(widths)
          setDragGhost({
            kind: 'row',
            left: first.getBoundingClientRect().left - wrapR.left,
            top: first.getBoundingClientRect().top - wrapR.top,
            width: last.getBoundingClientRect().right - first.getBoundingClientRect().left,
            height: first.getBoundingClientRect().height,
          })
        }
      } else {
        const colCells = wrapRef.current.querySelectorAll(`tr > *:nth-child(${from + 1})`)
        if (colCells.length) {
          const first = colCells[0] as HTMLElement
          const last = colCells[colCells.length - 1] as HTMLElement
          const heights = Array.from(colCells).map(el => (el as HTMLElement).getBoundingClientRect().height)
          setDragCellDims(heights)
          setDragGhost({
            kind: 'col',
            left: first.getBoundingClientRect().left - wrapR.left,
            top: first.getBoundingClientRect().top - wrapR.top,
            width: first.getBoundingClientRect().width,
            height: last.getBoundingClientRect().bottom - first.getBoundingClientRect().top,
          })
        }
      }
    }
  }
  const onHandleDragEnd = () => { setDrag(null); setDropAt(null); setDragGhost(null); setDragContent(null); setDragCellDims(null) }

  const onCellDragOver = (r: number, c: number) => (e: React.DragEvent) => {
    if (!drag || readOnly) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const wrapR = wrapRef.current?.getBoundingClientRect()
    if (drag.kind === 'row') {
      const before = (e.clientY - rect.top) < rect.height / 2
      setDropAt({ kind: 'row', index: r, before })
      if (wrapR && dragGhost) {
        setDragGhost(g => g ? { ...g, top: e.clientY - wrapR.top - g.height / 2 } : null)
      }
    } else {
      const before = (e.clientX - rect.left) < rect.width / 2
      setDropAt({ kind: 'col', index: c, before })
      if (wrapR && dragGhost) {
        setDragGhost(g => g ? { ...g, left: e.clientX - wrapR.left - g.width / 2 } : null)
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onCellDrop = (_rowIdx: number, _colIdx: number) => (e: React.DragEvent) => {
    if (!drag || !dropAt || readOnly) { onHandleDragEnd(); return }
    e.preventDefault()
    const from = drag.from
    let to = dropAt.before ? dropAt.index : dropAt.index + 1
    if (from < to) to -= 1
    if (from !== to) {
      if (drag.kind === 'row') {
        const next = [...rows]
        const [m] = next.splice(from, 1)
        next.splice(to, 0, m)
        apply({ rows: next, cellStyles: remapStyles(cellStyles, 'row', from, to) })
      } else {
        const next = rows.map(row => {
          const cp = [...row]
          const [m] = cp.splice(from, 1)
          cp.splice(to, 0, m)
          return cp
        })
        const nw = effectiveWidths ? [...effectiveWidths] : null
        if (nw) { const [m] = nw.splice(from, 1); nw.splice(to, 0, m) }
        apply({ rows: next, cellStyles: remapStyles(cellStyles, 'col', from, to), ...(nw ? { colWidths: nw } : {}) })
      }
    }
    onHandleDragEnd()
  }

  const [dropLine, setDropLine] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!dropAt || !wrapRef.current) { setDropLine(null); return }
    const wrap = wrapRef.current
    const wrapR = wrap.getBoundingClientRect()
    const table = tableRef.current
    if (!table) { setDropLine(null); return }
    if (dropAt.kind === 'row') {
      const cells = table.querySelectorAll(`tr:nth-child(${dropAt.index + 1}) > *`)
      if (!cells.length) { setDropLine(null); return }
      let l = Infinity, r = -Infinity, y = 0
      cells.forEach(el => {
        const cr = (el as HTMLElement).getBoundingClientRect()
        l = Math.min(l, cr.left); r = Math.max(r, cr.right)
        y = dropAt.before ? cr.top : cr.bottom
      })
      setDropLine({ left: l - wrapR.left, top: y - wrapR.top - 1.5, width: r - l, height: 3 })
    } else {
      const cells = table.querySelectorAll(`tr > *:nth-child(${dropAt.index + 1})`)
      if (!cells.length) { setDropLine(null); return }
      let t = Infinity, b = -Infinity, x = 0
      cells.forEach(el => {
        const cr = (el as HTMLElement).getBoundingClientRect()
        t = Math.min(t, cr.top); b = Math.max(b, cr.bottom)
        x = dropAt.before ? cr.left : cr.right
      })
      setDropLine({ left: x - wrapR.left - 1.5, top: t - wrapR.top, width: 3, height: b - t })
    }
  }, [dropAt])

  const [selRect, setSelRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    if (!menu || menu.kind === 'cell' || !wrapRef.current) { setSelRect(null); return }
    const table = tableRef.current
    if (!table) { setSelRect(null); return }
    const cells = menu.kind === 'col'
      ? table.querySelectorAll(`tr > *:nth-child(${menu.index! + 1})`)
      : table.querySelectorAll(`tr:nth-child(${menu.index! + 1}) > *`)
    if (!cells.length) { setSelRect(null); return }
    const wrapR = wrapRef.current!.getBoundingClientRect()
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    cells.forEach(el => {
      const cr = (el as HTMLElement).getBoundingClientRect()
      l = Math.min(l, cr.left); t = Math.min(t, cr.top)
      r = Math.max(r, cr.right); b = Math.max(b, cr.bottom)
    })
    setSelRect({ left: l - wrapR.left, top: t - wrapR.top, width: r - l, height: b - t })
  }, [menu, rows, cols])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="relative block pb-3 rich-table-wrap" ref={wrapRef}>
      <div className="relative">
      <table ref={tableRef} className="rich-table w-full table-fixed text-[14.5px] bg-background" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <colgroup>
          {currentWidths
            ? currentWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)
            : Array.from({ length: cols }, (_, i) => <col key={i} />)
          }
        </colgroup>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const colSel = selCol === c
                const rowSel = selRow === r
                const isFocused = focusCell?.r === r && focusCell?.c === c
                const isCellMenu = menu?.kind === 'cell' && menu.r === r && menu.c === c
                const isDraggingThisCol = drag?.kind === 'col' && drag.from === c
                const isDraggingThisRow = drag?.kind === 'row' && drag.from === r
                const showColHandle = !readOnly && r === 0 && (focusCell?.c === c || colSel || isDraggingThisCol)
                const showRowHandle = !readOnly && c === 0 && (focusCell?.r === r || rowSel || isDraggingThisRow)
                const showCellHandle = !readOnly && (isFocused || isCellMenu)

                const style = cellStyles[`${r},${c}`] || {}
                const inlineStyle: React.CSSProperties = {}
                if (style.textColor && style.textColor !== 'default') inlineStyle.color = TEXT_COLOR_MAP[style.textColor] || undefined
                if (style.bgColor && style.bgColor !== 'default') inlineStyle.background = BG_COLOR_MAP[style.bgColor] || undefined

                const topBorder = r === 0 ? 'border-t' : ''
                const leftBorder = c === 0 ? 'border-l' : ''
                const focusedRing = (isFocused || isCellMenu) ? 'ring-2 ring-primary ring-inset z-[1] relative' : ''
                const isDraggedCell = isDraggingThisRow || isDraggingThisCol
                const colHandleFocused = focusCell?.c === c && !colSel && !isDraggingThisCol
                const rowHandleFocused = focusCell?.r === r && !rowSel && !isDraggingThisRow
                const cellHandleFocused = isFocused && !isCellMenu
                const dropTargetBg = (dropAt?.kind === 'row' && dropAt.index === r) || (dropAt?.kind === 'col' && dropAt.index === c) ? 'bg-primary/10' : ''

                return (
                  <td
                    key={c}
                    style={inlineStyle}
                    className={`${TD_BASE} ${topBorder} ${leftBorder} ${focusedRing} ${dropTargetBg} ${isDraggedCell ? 'bg-muted/30' : ''}`}
                    onDragOver={onCellDragOver(r, c)}
                    onDrop={onCellDrop(r, c)}
                  >
                    {showColHandle && (
                      <button
                        className={`rt-handle col show ${(colSel || isDraggingThisCol) ? 'active' : ''} ${colHandleFocused ? 'focused' : ''}`}
                        title="Drag to move column · Click for actions"
                        draggable
                        onDragStart={onHandleDragStart('col', c)}
                        onDragEnd={onHandleDragEnd}
                        onClick={(e) => { setFocusCell(null); openMenu('col', c, e) }}
                      >
                        <span className="grip"><span /><span /><span /></span>
                      </button>
                    )}
                    {showRowHandle && (
                      <button
                        className={`rt-handle row show ${(rowSel || isDraggingThisRow) ? 'active' : ''} ${rowHandleFocused ? 'focused' : ''}`}
                        title="Drag to move row · Click for actions"
                        draggable
                        onDragStart={onHandleDragStart('row', r)}
                        onDragEnd={onHandleDragEnd}
                        onClick={(e) => { setFocusCell(null); openMenu('row', r, e) }}
                      >
                        <span className="grip"><span /><span /><span /></span>
                      </button>
                    )}
                    {showCellHandle && (
                      <button
                        className={`rt-handle cell show ${isCellMenu ? 'active' : ''} ${cellHandleFocused ? 'focused' : ''}`}
                        title="Cell color & actions"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => { setFocusCell(null); openMenu('cell', { r, c }, e) }}
                      >
                        <span className="grip"><span /><span /><span /></span>
                      </button>
                    )}
                    {isDraggedCell ? (
                      <div className="leading-[1.45] min-h-[1.4em]" />
                    ) : (
                      <Editable
                        className="leading-[1.45] min-h-[1.4em]"
                        value={cell}
                        onChange={(html) => setCell(r, c, html)}
                        onFocus={() => setFocusCell({ r, c })}
                        placeholder=""
                        readOnly={readOnly}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {colHandlePositions.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {colHandlePositions.map(({ col, leftPct }) => (
            <div
              key={col}
              className="absolute top-0 h-full w-[12px] cursor-col-resize pointer-events-auto group/rh"
              style={{ left: `calc(${leftPct}% - 6px)` }}
              onMouseDown={onResizeStart(col)}
            >
              <div className={`absolute inset-y-0 left-1/2 -translate-x-px w-[1px] transition-colors ${
                isResizing && resizeRef.current?.col === col ? 'bg-primary/80' : 'bg-primary/0 group-hover/rh:bg-primary/40'
              }`} />
            </div>
          ))}
        </div>
      )}
      </div>

      {!readOnly && (
        <>
          <button
            className="absolute top-0 bottom-3 right-[-14px] w-3 rounded grid place-items-center text-[10px] font-semibold leading-none text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-[]:opacity-100 [.rich-table-wrap:hover_&]:opacity-100"
            title="Click to add a new column"
            onClick={() => addCol(cols)}
          >+</button>
          <button
            className="absolute left-0 right-0 bottom-[-2px] h-3 rounded grid place-items-center text-[10px] font-semibold leading-none text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground [.rich-table-wrap:hover_&]:opacity-100"
            title="Click to add a new row"
            onClick={() => addRow(rows.length)}
          >+</button>
        </>
      )}

      {selRect && (
        <div
          className="absolute border-2 border-primary rounded pointer-events-none z-[2] box-border"
          style={{ left: selRect.left, top: selRect.top, width: selRect.width, height: selRect.height }}
        />
      )}
      {dropLine && (
        <div
          className="rt-drop-line"
          style={{ left: dropLine.left, top: dropLine.top, width: dropLine.width, height: dropLine.height }}
        />
      )}
      {dragGhost && dragContent && (
        <>
          {/* Ghost content */}
          <div
            className="absolute rounded outline outline-1 outline-primary/40 bg-background shadow-lg pointer-events-none z-[5] overflow-hidden"
            style={{
              left: dragGhost.left,
              top: dragGhost.top,
              width: dragGhost.width,
              height: dragGhost.height,
            }}
          >
            {dragGhost.kind === 'row' && dragCellDims && (
              <table
                className="w-full h-full"
                style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
              >
                <colgroup>
                  {dragCellDims.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <tbody>
                  <tr>
                    {dragContent.map((html, i) => (
                      <td
                        key={i}
                        className={`border-r border-b ${i === 0 ? 'border-l' : ''} border-t border-border p-[7px_11px] text-[14.5px] align-top leading-[1.45]`}
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
            {dragGhost.kind === 'col' && dragCellDims && (
              <table
                className="w-full h-full"
                style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
              >
                <colgroup>
                  <col style={{ width: dragGhost.width }} />
                </colgroup>
                <tbody>
                  {dragContent.map((html, i) => (
                    <tr key={i} style={{ height: dragCellDims[i] }}>
                      <td
                        className={`border-l border-r ${i === 0 ? 'border-t' : ''} border-b border-border p-[7px_11px] text-[14.5px] align-top leading-[1.45]`}
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Floating handle that moves with the ghost */}
          {dragGhost.kind === 'row' && (
            <div
              className="absolute z-[6] pointer-events-none grid place-items-center"
              style={{
                left: dragGhost.left - 10,
                top: dragGhost.top + dragGhost.height / 2 - 18,
                width: 20,
                height: 36,
              }}
            >
              <div className="w-[13px] h-[26px] rounded-[3px] bg-primary shadow-sm grid place-items-center">
                <span className="flex flex-col gap-[1px]">
                  <span className="w-[2px] h-[2px] rounded-full bg-white" />
                  <span className="w-[2px] h-[2px] rounded-full bg-white" />
                  <span className="w-[2px] h-[2px] rounded-full bg-white" />
                </span>
              </div>
            </div>
          )}
          {dragGhost.kind === 'col' && (
            <div
              className="absolute z-[6] pointer-events-none grid place-items-center"
              style={{
                left: dragGhost.left + dragGhost.width / 2 - 18,
                top: dragGhost.top - 10,
                width: 36,
                height: 20,
              }}
            >
              <div className="w-[26px] h-[13px] rounded-[3px] bg-primary shadow-sm grid place-items-center">
                <span className="flex gap-[1px]">
                  <span className="w-[2px] h-[2px] rounded-full bg-white" />
                  <span className="w-[2px] h-[2px] rounded-full bg-white" />
                  <span className="w-[2px] h-[2px] rounded-full bg-white" />
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {menu && (menu.kind === 'col' || menu.kind === 'row') && (
        <CellActionMenu
          kind={menu.kind}
          pos={menu.pos}
          index={menu.index!}
          total={menu.kind === 'col' ? cols : rows.length}
          onClose={() => setMenu(null)}
          onAction={handleAction}
          currentTextColor={getConsensusColor(menu.kind as 'col' | 'row', menu.index!, 'textColor')}
          currentBgColor={getConsensusColor(menu.kind as 'col' | 'row', menu.index!, 'bgColor')}
          onSetTextColor={(v) => updateAxisCellStyle(menu.kind as 'col' | 'row', menu.index!, { textColor: v })}
          onSetBgColor={(v) => updateAxisCellStyle(menu.kind as 'col' | 'row', menu.index!, { bgColor: v })}
        />
      )}
      {menu && menu.kind === 'cell' && (
        <CellStyleMenu
          pos={menu.pos}
          current={cellStyles[`${menu.r!},${menu.c!}`] || {}}
          onClose={() => setMenu(null)}
          onSetTextColor={(v) => updateCellStyle(menu.r!, menu.c!, { textColor: v })}
          onSetBgColor={(v) => updateCellStyle(menu.r!, menu.c!, { bgColor: v })}
          onClear={() => { clearCell(menu.r!, menu.c!); setMenu(null) }}
        />
      )}
    </div>
  )
}
