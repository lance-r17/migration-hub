import { useRef, useEffect, useState, useCallback } from 'react'
import { CircleX, ChevronRight, Palette } from 'lucide-react'
import { ColorPicker } from './ColorPicker'

interface CellStyleMenuProps {
  pos: { left: number; top: number }
  current: { textColor?: string; bgColor?: string }
  onClose: () => void
  onSetTextColor: (v: string) => void
  onSetBgColor: (v: string) => void
  onClear: () => void
}

export function CellStyleMenu({ pos, current, onClose, onSetTextColor, onSetBgColor, onClear }: CellStyleMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showColors, setShowColors] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    const kh = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', kh)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', kh) }
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

  return (
    <div
      ref={ref}
      className="cell-menu fixed z-[70]"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Root menu */}
      <div className="w-[200px] p-1.5 rounded-lg bg-popover border border-border shadow-md text-[13.5px]">
        <div
          className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-foreground"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <span className="w-4 grid place-items-center text-muted-foreground">
            <Palette size={14} />
          </span>
          <span>Color</span>
          <ChevronRight size={14} className="ml-auto text-muted-foreground" />
        </div>
        <div className="h-px bg-border mx-1.5 my-1" />
        <div
          className="flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-foreground"
          onClick={onClear}
        >
          <span className="w-4 grid place-items-center text-muted-foreground"><CircleX size={14} /></span>
          <span>Clear contents</span>
        </div>
      </div>

      {/* Color flyout */}
      {showColors && (
        <div
          className="absolute left-[calc(100%+6px)] top-0"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <ColorPicker
            current={current}
            onSetTextColor={onSetTextColor}
            onSetBgColor={onSetBgColor}
          />
        </div>
      )}
    </div>
  )
}
