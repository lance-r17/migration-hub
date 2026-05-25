import { useState, useEffect, useRef } from 'react'
import {
  Copy,
  Replace,
  Trash2,
  ChevronRight,
  Link,
  CornerUpRight,
  Highlighter,
} from 'lucide-react'
import { Icon } from './icons'
import { ColorPicker } from './blocks/ColorPicker'
import type { Block } from './model'

interface BlockMenuProps {
  pos: { left: number; top: number }
  blockType: Block['type']
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onConvertTo: (type: Block['type']) => void
  onSetTextColor: (color: string) => void
  onSetBgColor: (color: string) => void
  currentColors?: { textColor: string; bgColor: string }
}

const CONVERT_TARGETS = [
  { type: 'paragraph' as const, title: 'Text', icon: 'paragraph' },
  { type: 'h1' as const, title: 'Heading 1', icon: 'h1' },
  { type: 'h2' as const, title: 'Heading 2', icon: 'h2' },
  { type: 'h3' as const, title: 'Heading 3', icon: 'h3' },
  { type: 'bullet' as const, title: 'Bulleted list', icon: 'bullet' },
  { type: 'todo' as const, title: 'To-do', icon: 'todo' },
  { type: 'callout' as const, title: 'Callout', icon: 'callout' },
  { type: 'quote' as const, title: 'Quote', icon: 'quote' },
]

const MENU_WIDTH = 280
const SUBMENU_WIDTH = 180
const MENU_HEIGHT_EST = 420

function clampPos(pos: { left: number; top: number }) {
  return {
    left: Math.max(8, Math.min(window.innerWidth - MENU_WIDTH - 8, pos.left)),
    top: Math.max(8, Math.min(window.innerHeight - MENU_HEIGHT_EST, pos.top)),
  }
}

const TYPE_LABEL: Record<string, string> = {
  paragraph: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'Bulleted list',
  numbered: 'Numbered list',
  todo: 'To-do',
  callout: 'Callout',
  quote: 'Quote',
  code: 'Code',
  divider: 'Divider',
  table: 'Table',
  image: 'Image',
  bookmark: 'Bookmark',
  tabs: 'Tabs',
  columns: 'Columns',
}

export function BlockMenu({ pos, blockType, onClose, onDelete, onDuplicate, onConvertTo, onSetTextColor, onSetBgColor, currentColors }: BlockMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [turnSubmenu, setTurnSubmenu] = useState(false)
  const [colorSubmenu, setColorSubmenu] = useState(false)
  const [submenuLeft, setSubmenuLeft] = useState(false)
  const [q, setQ] = useState('')

  const safePos = clampPos(pos)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const computeSubmenuSide = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      setSubmenuLeft(rect.right + SUBMENU_WIDTH + 4 > window.innerWidth)
    }
  }

  const row = 'flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] cursor-pointer hover:bg-muted'
  const kbd = 'ml-auto text-[11px] text-muted-foreground tracking-wider'

  return (
    <div
      ref={ref}
      className="fixed z-[55] w-[280px] rounded-lg bg-popover border border-border shadow-md overflow-visible select-none"
      style={{ left: safePos.left, top: safePos.top }}
    >
      {/* Search */}
      <div className="p-2 pb-1">
        <input
          autoFocus
          className="w-full px-2 py-1.5 rounded-md border border-border text-[13px] text-foreground bg-background outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-[2px] focus:ring-primary/20"
          placeholder="Search actions..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
          }}
        />
      </div>

      {/* Section label */}
      <div className="px-3 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground tracking-wide">
        {TYPE_LABEL[blockType] || 'Block'}
      </div>

      {/* Turn into */}
      <div
        className={`${row} mx-1 relative`}
        onMouseEnter={() => { computeSubmenuSide(); setTurnSubmenu(true) }}
        onMouseLeave={() => setTurnSubmenu(false)}
      >
        <span className="w-4 grid place-items-center text-muted-foreground"><Replace size={14} /></span>
        Turn into
        <span className={kbd}><ChevronRight size={14} /></span>
        {turnSubmenu && (
          <div
            className={`absolute ${submenuLeft ? 'right-[calc(100%+4px)]' : 'left-[calc(100%+4px)]'} -top-1 w-[180px] p-1 rounded-lg bg-popover border border-border shadow-md z-[60]`}
            onMouseEnter={() => setTurnSubmenu(true)}
            onMouseLeave={() => setTurnSubmenu(false)}
          >
            {CONVERT_TARGETS.map(t => (
              <div key={t.type} className={row} onClick={() => { onConvertTo(t.type); onClose() }}>
                <span className="w-4 grid place-items-center text-muted-foreground"><Icon name={t.icon} size={14} /></span> {t.title}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Color */}
      <div
        className={`${row} mx-1 relative`}
        onMouseEnter={() => { computeSubmenuSide(); setColorSubmenu(true) }}
        onMouseLeave={() => setColorSubmenu(false)}
      >
        <span className="w-4 grid place-items-center text-muted-foreground"><Highlighter size={14} /></span>
        Color
        <span className={kbd}><ChevronRight size={14} /></span>
        {colorSubmenu && (
          <div
            className={`absolute ${submenuLeft ? 'right-[calc(100%+4px)]' : 'left-[calc(100%+4px)]'} -top-1 z-[60]`}
            onMouseEnter={() => setColorSubmenu(true)}
            onMouseLeave={() => setColorSubmenu(false)}
          >
            <ColorPicker
              current={currentColors || { textColor: 'default', bgColor: 'default' }}
              onSetTextColor={(v) => { onSetTextColor(v); onClose() }}
              onSetBgColor={(v) => { onSetBgColor(v); onClose() }}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-border mx-2 my-1" />

      {/* Copy link */}
      <div className={`${row} mx-1`} onClick={() => { onClose() }}>
        <span className="w-4 grid place-items-center text-muted-foreground"><Link size={14} /></span>
        Copy link to block
        <span className={kbd}>⌘^L</span>
      </div>

      {/* Duplicate */}
      <div className={`${row} mx-1`} onClick={() => { onDuplicate(); onClose() }}>
        <span className="w-4 grid place-items-center text-muted-foreground"><Copy size={14} /></span>
        Duplicate
        <span className={kbd}>⌘D</span>
      </div>

      {/* Move to */}
      <div className={`${row} mx-1`} onClick={() => { onClose() }}>
        <span className="w-4 grid place-items-center text-muted-foreground"><CornerUpRight size={14} /></span>
        Move to
        <span className={kbd}>⌘⇧P</span>
      </div>

      {/* Delete */}
      <div
        className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] cursor-pointer hover:bg-destructive/10 mx-1 text-destructive"
        onClick={() => { onDelete(); onClose() }}
      >
        <span className="w-4 grid place-items-center text-destructive"><Trash2 size={14} /></span>
        Delete
        <span className={kbd}>Del</span>
      </div>

    </div>
  )
}
