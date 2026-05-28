import { useRef, useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  CircleX,
  ChevronRight,
  Palette,
} from 'lucide-react'
import { TEXT_COLORS, BG_COLORS } from './table-constants'

interface CellActionMenuProps {
  kind: 'col' | 'row'
  pos: { left: number; top: number }
  index: number
  total: number
  onClose: () => void
  onAction: (id: string) => void
  currentTextColor?: string
  currentBgColor?: string
  onSetTextColor?: (v: string) => void
  onSetBgColor?: (v: string) => void
}

export function CellActionMenu({
  kind,
  pos,
  index,
  total,
  onClose,
  onAction,
  currentTextColor,
  currentBgColor,
  onSetTextColor,
  onSetBgColor,
}: CellActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showColors, setShowColors] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    const kh = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', kh)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', kh)
    }
  }, [onClose])

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowColors(false), 120)
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    setShowColors(true)
  }, [])

  const isFirst = index === 0
  const isLast = index === total - 1

  const items =
    kind === 'col'
      ? [
          { id: 'insert-left', title: 'Insert left', icon: ArrowLeft },
          { id: 'insert-right', title: 'Insert right', icon: ArrowRight },
          { id: 'move-left', title: 'Move left', icon: ArrowLeft, disabled: isFirst },
          { id: 'move-right', title: 'Move right', icon: ArrowRight, disabled: isLast },
          { id: 'duplicate', title: 'Duplicate', icon: Copy, kbd: '⌘D' },
          { id: 'clear', title: 'Clear contents', icon: CircleX },
          { id: 'delete', title: 'Delete', icon: Trash2, danger: true },
        ]
      : [
          { id: 'insert-above', title: 'Insert above', icon: ArrowUp },
          { id: 'insert-below', title: 'Insert below', icon: ArrowDown },
          { id: 'move-up', title: 'Move up', icon: ArrowUp, disabled: isFirst },
          { id: 'move-down', title: 'Move down', icon: ArrowDown, disabled: isLast },
          { id: 'duplicate', title: 'Duplicate', icon: Copy, kbd: '⌘D' },
          { id: 'clear', title: 'Clear contents', icon: CircleX },
          { id: 'delete', title: 'Delete', icon: Trash2, danger: true },
        ]

  const filtered = items.filter((it) =>
    it.title.toLowerCase().includes(q.toLowerCase()),
  )

  const hasColor = onSetTextColor && onSetBgColor

  return (
    <div
      ref={ref}
      className="cell-menu fixed z-[70]"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="w-[200px] p-1.5 rounded-lg bg-popover text-popover-foreground border border-border text-[13.5px] shadow-md">
        <input
          className="block w-full px-2 py-1.5 mb-1 rounded-md border-[1.5px] border-primary text-[13px] text-foreground bg-background outline-none placeholder:text-muted-foreground"
          autoFocus
          placeholder="Search actions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {hasColor && (
          <>
            <div
              className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-foreground"
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              <span className="w-4 grid place-items-center text-muted-foreground">
                <Palette size={14} />
              </span>
              <span>Color</span>
              <ChevronRight
                size={14}
                className="ml-auto text-muted-foreground"
              />
            </div>
            <div className="h-px bg-border mx-1.5 my-1" />
          </>
        )}

        {filtered.map((it, i) => (
          <div key={it.id}>
            {it.danger &&
              filtered[i - 1] &&
              !filtered[i - 1].danger && (
                <div className="h-px bg-border mx-1.5 my-1" />
              )}
            <div
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded ${
                it.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : it.danger
                    ? 'text-destructive cursor-pointer hover:bg-muted'
                    : 'text-foreground cursor-pointer hover:bg-muted'
              }`}
              onClick={() => { if (!it.disabled) onAction(it.id) }}
            >
              <span
                className={`w-4 grid place-items-center ${
                  it.danger
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                <it.icon size={14} />
              </span>
              <span>{it.title}</span>
              {it.kbd && (
                <span className="ml-auto text-[11px] text-muted-foreground font-mono">
                  {it.kbd}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasColor && showColors && (
        <div
          className="absolute left-[calc(100%+6px)] top-0 w-[200px] p-1.5 rounded-lg bg-popover border border-border shadow-md"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <div className="px-2 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium">
            Text color
          </div>
          <div className="grid grid-cols-5 gap-1 px-1.5 pb-1.5">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                className={`aspect-square rounded border bg-background text-foreground grid place-items-center font-bold text-[13px] hover:border-muted-foreground ${
                  (currentTextColor || 'default') === c.value
                    ? 'ring-2 ring-primary border-transparent'
                    : 'border-border'
                }`}
                style={{ color: c.css || undefined }}
                title={c.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSetTextColor!(c.value)}
              >
                A
              </button>
            ))}
          </div>
          <div className="px-2 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium">
            Background
          </div>
          <div className="grid grid-cols-5 gap-1 px-1.5 pb-1.5">
            {BG_COLORS.map((c) => (
              <button
                key={c.value}
                className={`aspect-square rounded border grid place-items-center hover:border-muted-foreground ${
                  (currentBgColor || 'default') === c.value
                    ? 'ring-2 ring-primary border-transparent'
                    : 'border-border'
                }`}
                style={{
                  background: c.css || 'hsl(var(--background))',
                }}
                title={c.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSetBgColor!(c.value)}
              >
                {c.value === 'default' && (
                  <span className="text-[13px] text-muted-foreground">
                    —
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
