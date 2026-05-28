import { useState, useEffect, useRef, useMemo } from 'react'

export interface VariableOption {
  key: string
  label: string
  example: string
}

interface VariableMenuProps {
  query: string
  pos: { left: number; top: number }
  variables: readonly VariableOption[]
  onPick: (key: string) => void
  onClose: () => void
}

export function VariableMenu({ query, pos, variables, onPick, onClose }: VariableMenuProps) {
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return variables
    return variables.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q),
    )
  }, [query])

  useEffect(() => {
    setSel(0)
  }, [query])

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
          onPick(filtered[sel].key)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [filtered, sel, onPick, onClose])

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

  if (!pos) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const menuW = 400
  const menuH = 480
  let left = pos.left
  let top = pos.top
  if (left + menuW > vw - 8) left = vw - menuW - 8
  if (top + menuH > vh - 8) top = pos.top - menuH - 8
  if (top < 8) top = 8

  return (
    <div
      ref={ref}
      className="fixed z-[70] w-[400px] max-h-[480px] rounded-xl bg-popover border border-border shadow-lg flex flex-col overflow-hidden"
      style={{ left, top }}
    >
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-2">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-base text-muted-foreground">
            No matching variables
          </div>
        )}

        {filtered.map((v, i) => (
          <div
            key={v.key}
            data-idx={i}
            className={`flex flex-col gap-0.5 px-3 py-2.5 mx-2 rounded-lg select-none cursor-pointer ${
              sel === i ? 'bg-primary/10' : 'hover:bg-muted'
            }`}
            onMouseEnter={() => setSel(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(v.key)
            }}
          >
            <span className="text-sm font-medium text-primary font-mono">
              {'{{'}{v.key}{'}}'}
            </span>
            <span className="text-xs text-muted-foreground">
              {v.label} · ex. {v.example}
            </span>
          </div>
        ))}
      </div>

      <div
        className="shrink-0 border-t border-border px-4 py-2.5 text-sm text-muted-foreground bg-popover rounded-b-xl flex items-center justify-between cursor-pointer hover:bg-muted"
        onMouseDown={(e) => { e.preventDefault(); onClose() }}
      >
        <span>Close menu</span>
        <span className="text-xs text-muted-foreground font-mono">esc</span>
      </div>
    </div>
  )
}
