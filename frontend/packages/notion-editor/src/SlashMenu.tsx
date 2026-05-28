import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { SLASH_ITEMS } from './model'
import { Icon } from './icons'

/* module-level recency cache (persists across re-renders / instances) */
const recentTypes: string[] = []
const DEFAULT_SUGGESTED = ['table', 'bullet', 'paragraph', 'h1']

function recordPick(type: string) {
  const idx = recentTypes.indexOf(type)
  if (idx > -1) recentTypes.splice(idx, 1)
  recentTypes.unshift(type)
  if (recentTypes.length > 10) recentTypes.length = 10
}

function getSuggestedItems() {
  const source = recentTypes.length ? recentTypes : DEFAULT_SUGGESTED
  return source
    .map((t) => SLASH_ITEMS.find((it) => it.type === t))
    .filter(Boolean) as typeof SLASH_ITEMS
}

interface SlashMenuProps {
  query: string
  pos: { left: number; top: number }
  onPick: (item: (typeof SLASH_ITEMS)[number]) => void
  onClose: () => void
}

export function SlashMenu({ query, pos, onPick, onClose }: SlashMenuProps) {
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const suggested = useMemo(() => getSuggestedItems(), [])

  const allItems = useMemo(() => {
    if (suggested.length === 0) return SLASH_ITEMS
    return [
      ...suggested.map((it) => ({ ...it, group: 'Suggested' })),
      ...SLASH_ITEMS,
    ]
  }, [suggested])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return allItems
    return allItems.filter(
      (it) =>
        it.keys.some((k) => k.includes(q)) ||
        it.title.toLowerCase().includes(q),
    )
  }, [query, allItems])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSel(0)
  }, [query])

  const handlePick = useCallback(
    (item: (typeof SLASH_ITEMS)[number]) => {
      recordPick(item.type)
      onPick(item)
    },
    [onPick],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel((s) => Math.min(filtered.length - 1, s + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((s) => Math.max(0, s - 1))
      } else if (e.key === 'Enter') {
        if (filtered[sel]) {
          e.preventDefault()
          handlePick(filtered[sel])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [filtered, sel, handlePick, onClose])

  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-idx="${sel}"]`)
    if (el && (el as HTMLElement).scrollIntoView) {
      const menu = scrollRef.current
      const rEl = el.getBoundingClientRect()
      const rMenu = menu.getBoundingClientRect()
      if (rEl.bottom > rMenu.bottom)
        menu.scrollTop += rEl.bottom - rMenu.bottom + 4
      else if (rEl.top < rMenu.top)
        menu.scrollTop -= rMenu.top - rEl.top + 4
    }
  }, [sel])

  const grouped = useMemo(() => {
    const g: Array<
      | { header: string }
      | { item: (typeof SLASH_ITEMS)[number]; idx: number }
    > = []
    let last: string | null = null
    filtered.forEach((it, i) => {
      if (it.group !== last) {
        g.push({ header: it.group })
        last = it.group
      }
      g.push({ item: it, idx: i })
    })
    return g
  }, [filtered])

  if (!pos) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const menuW = 280
  const menuH = 360
  let left = pos.left
  let top = pos.top
  if (left + menuW > vw - 8) left = vw - menuW - 8
  if (top + menuH > vh - 8) top = pos.top - menuH - 8
  if (top < 8) top = 8

  return (
    <div
      ref={ref}
      className="fixed z-[70] w-[280px] max-h-[360px] rounded-xl bg-popover border border-border shadow-lg flex flex-col overflow-hidden"
      style={{ left, top }}
    >
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-1.5">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No matching blocks
          </div>
        )}

        {grouped.map((row, i) =>
          'header' in row ? (
            <div
              key={`h-${i}`}
              className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground"
            >
              {row.header}
            </div>
          ) : (
            <div
              key={row.item!.type + i}
              data-idx={row.idx}
              className={`flex items-center gap-2.5 px-2 py-1.5 mx-1.5 rounded select-none cursor-pointer ${
                sel === row.idx ? 'bg-primary/10' : 'hover:bg-muted'
              }`}
              onMouseEnter={() => setSel(row.idx!)}
              onMouseDown={(e) => {
                e.preventDefault()
                handlePick(row.item!)
              }}
            >
              <div className="w-7 h-7 flex-none rounded bg-background border border-border grid place-items-center text-foreground">
                <Icon name={row.item!.icon} size={16} />
              </div>
              <span className="flex-1 min-w-0 text-[13.5px] text-foreground truncate">
                {row.item!.title}
              </span>
              {row.item!.kbd && (
                <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                  {row.item!.kbd}
                </span>
              )}
            </div>
          ),
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="shrink-0 border-t border-border px-3 py-2 text-[12px] text-muted-foreground bg-popover rounded-b-xl flex items-center justify-between cursor-pointer hover:bg-muted"
        onMouseDown={(e) => { e.preventDefault(); onClose() }}
      >
        <span>Close menu</span>
        <span className="text-[11px] text-muted-foreground font-mono">esc</span>
      </div>
    </div>
  )
}
