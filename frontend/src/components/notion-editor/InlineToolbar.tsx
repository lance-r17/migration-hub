import { useState, useRef, useEffect } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  MoreHorizontal,
  Type,
  Highlighter,
  Subscript,
} from 'lucide-react'
import { ColorPicker } from './blocks/ColorPicker'
import { TEXT_COLORS, BG_COLORS, TEXT_COLOR_MAP, BG_COLOR_MAP } from './blocks/table-constants'

function anchorInCode(sel: Selection | null) {
  if (!sel || !sel.anchorNode) return null
  const n = sel.anchorNode
  return (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest?.('code')
}

function anchorInLink(sel: Selection | null) {
  if (!sel || !sel.anchorNode) return null
  const n = sel.anchorNode
  return (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest?.('a')
}

function currentEditable() {
  const sel = window.getSelection()
  if (!sel || !sel.anchorNode) return null
  const n = sel.anchorNode
  return (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest?.('.notion-editable')
}

function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(Number(m[1]))}${toHex(Number(m[2]))}${toHex(Number(m[3]))}`.toUpperCase()
}

function getSelectionColor(): { textColor: string; bgColor: string } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    return { textColor: 'default', bgColor: 'default' }
  }
  const range = sel.getRangeAt(0)
  let node: Node | null = range.startContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  const el = node as HTMLElement | null
  if (!el) return { textColor: 'default', bgColor: 'default' }
  const cs = getComputedStyle(el)
  const textHex = rgbToHex(cs.color)
  const bgHex = rgbToHex(cs.backgroundColor)
  const textColor = TEXT_COLORS.find(c => c.css?.toUpperCase() === textHex)?.value || 'default'
  const bgColor = BG_COLORS.find(c => c.css?.toUpperCase() === bgHex)?.value || 'default'
  return { textColor, bgColor }
}

export function InlineToolbar() {
  const [state, setState] = useState({ visible: false, top: 0, left: 0, formats: {} as Record<string, boolean> })
  const [link, setLink] = useState<{ top: number; left: number; value: string; range: Range } | null>(null)
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null)
  const [currentColors, setCurrentColors] = useState({ textColor: 'default', bgColor: 'default' })
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setState(s => ({ ...s, visible: false }))
        setColorPos(null)
        return
      }
      const range = sel.getRangeAt(0)
      const anchor = range.commonAncestorContainer
      const editableAncestor =
        anchor.nodeType === 1
          ? (anchor as Element).closest?.('.notion-editable')
          : anchor.parentElement?.closest?.('.notion-editable')
      if (!editableAncestor) {
        setState(s => ({ ...s, visible: false }))
        return
      }
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      const clientRects = range.getClientRects()
      const lastRect = clientRects[clientRects.length - 1] ?? rect
      const toolbarHeight = 96 // estimated toolbar height (~80) + padding
      const spaceBelow = window.innerHeight - lastRect.bottom
      const placeAbove = spaceBelow < toolbarHeight + 8 && lastRect.top > toolbarHeight + 8
      setState({
        visible: true,
        top: placeAbove ? lastRect.top - toolbarHeight - 8 : lastRect.bottom + 8,
        left: lastRect.right,
        formats: {
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikethrough: document.queryCommandState('strikethrough'),
          code: !!anchorInCode(sel),
          link: !!anchorInLink(sel),
        },
      })
    }

    document.addEventListener('selectionchange', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    if (!state.visible) return
    const onDocDown = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return
      if (colorPickerRef.current?.contains(e.target as Node)) return
      if (link) return
      setState(s => ({ ...s, visible: false }))
      setColorPos(null)
    }
    setTimeout(() => document.addEventListener('mousedown', onDocDown), 0)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [state.visible, link])

  const exec = (cmd: string) => {
    document.execCommand(cmd, false)
    const editable = currentEditable()
    if (editable) editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }

  const toggleCode = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (anchorInCode(sel)) {
      const node = sel.anchorNode
      const codeEl = (node?.nodeType === 1 ? (node as Element) : node?.parentElement)?.closest('code')
      if (codeEl) {
        const text = document.createTextNode(codeEl.textContent || '')
        codeEl.replaceWith(text)
        sel.removeAllRanges()
        const r = document.createRange()
        r.selectNode(text)
        sel.addRange(r)
      }
    } else {
      const code = document.createElement('code')
      try {
        code.appendChild(range.extractContents())
        range.insertNode(code)
        sel.removeAllRanges()
        const r = document.createRange()
        r.selectNodeContents(code)
        sel.addRange(r)
      } catch { /* noop */ }
    }
    const editable = currentEditable()
    if (editable) editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }

  const openLink = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0).cloneRange()
    const rect = range.getBoundingClientRect()
    const existing = anchorInLink(sel)
    setLink({
      top: rect.bottom + 8,
      left: rect.left,
      value: existing ? existing.getAttribute('href') || '' : '',
      range,
    })
    setTimeout(() => linkInputRef.current?.focus(), 30)
  }

  const applyLink = () => {
    if (!link) return
    const url = link.value.trim()
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(link.range)
    if (url) document.execCommand('createLink', false, url)
    else document.execCommand('unlink', false)
    setLink(null)
    const editable = currentEditable()
    if (editable) editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }

  const toggleColor = () => {
    if (colorPos) {
      setColorPos(null)
      return
    }
    const rect = toolbarRef.current?.getBoundingClientRect()
    if (!rect) return
    const pickerWidth = 200
    const pickerHeight = 250
    const left = Math.max(8, Math.min(window.innerWidth - pickerWidth - 8, rect.left))
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < pickerHeight + 8 && rect.top > pickerHeight + 8
    const top = placeAbove ? rect.top - pickerHeight - 8 : rect.bottom + 8
    setCurrentColors(getSelectionColor())
    setColorPos({ top, left })
  }

  if (!state.visible && !link) return null

  const iconBtn = (on: boolean) =>
    `h-8 w-8 grid place-items-center rounded-md text-sm transition-colors ` +
    (on
      ? 'bg-muted text-foreground'
      : 'text-foreground hover:bg-muted')

  return (
    <>
      {state.visible && (
        <div
          ref={toolbarRef}
          className="fixed z-[60] bg-popover border border-border rounded-xl shadow-lg p-2 select-none"
          style={{
            top: state.top,
            left: Math.max(8, Math.min(window.innerWidth - 200 - 8, state.left)),
            width: 200,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Row 1: T, A (color), B, I, U */}
          <div className="flex items-center gap-1">
            <button className={iconBtn(false)} title="Text style"><Type size={16} /></button>
            <button className={`${iconBtn(false)} border border-border relative`} title="Color" onClick={toggleColor}><Highlighter size={16} /></button>
            <button className={iconBtn(state.formats.bold)} onClick={() => exec('bold')} title="Bold"><Bold size={16} /></button>
            <button className={iconBtn(state.formats.italic)} onClick={() => exec('italic')} title="Italic"><Italic size={16} /></button>
            <button className={iconBtn(state.formats.underline)} onClick={() => exec('underline')} title="Underline"><Underline size={16} /></button>
          </div>
          {/* Row 2: Link, S, code, math, more */}
          <div className="flex items-center gap-1 mt-1">
            <button className={iconBtn(state.formats.link)} onClick={openLink} title="Link"><Link size={16} /></button>
            <button className={iconBtn(state.formats.strikethrough)} onClick={() => exec('strikethrough')} title="Strikethrough"><Strikethrough size={16} /></button>
            <button className={iconBtn(state.formats.code)} onClick={toggleCode} title="Inline code"><Code size={16} /></button>
            <button className={iconBtn(false)} title="Math"><Subscript size={16} /></button>
            <button className={iconBtn(false)} title="More"><MoreHorizontal size={16} /></button>
          </div>
        </div>
      )}
      {colorPos && (
        <div
          ref={colorPickerRef}
          className="fixed z-[65]"
          style={{ top: colorPos.top, left: colorPos.left }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          <ColorPicker
            current={currentColors}
            onSetTextColor={(v) => {
              const css = TEXT_COLOR_MAP[v] || '#1a1a1a'
              document.execCommand('styleWithCSS', true, '')
              document.execCommand('foreColor', false, css)
              const editable = currentEditable()
              if (editable) editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
              setCurrentColors(getSelectionColor())
            }}
            onSetBgColor={(v) => {
              document.execCommand('styleWithCSS', true, '')
              if (v === 'default') {
                document.execCommand('hiliteColor', false, 'transparent')
              } else {
                const css = BG_COLOR_MAP[v] || v
                document.execCommand('hiliteColor', false, css)
              }
              const editable = currentEditable()
              if (editable) editable.dispatchEvent(new InputEvent('input', { bubbles: true }))
              setCurrentColors(getSelectionColor())
            }}
          />
        </div>
      )}
      {link && (
        <div
          className="fixed z-[70] flex gap-1.5 w-80 p-2 rounded-md bg-popover border border-border shadow-md"
          style={{ top: link.top, left: link.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={linkInputRef}
            value={link.value}
            placeholder="Paste a URL or search…"
            className="flex-1 min-w-0 text-[13.5px] border border-border bg-background text-foreground rounded px-2.5 py-1.5 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20"
            onChange={(e) => setLink(l => l ? { ...l, value: e.target.value } : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink()
              if (e.key === 'Escape') setLink(null)
            }}
          />
          <button
            className="bg-primary text-primary-foreground px-3 h-[30px] rounded text-[13px] font-medium hover:bg-primary/90"
            onClick={applyLink}
          >
            Link
          </button>
        </div>
      )}
    </>
  )
}
