import { useState, useRef, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import data from '@emoji-mart/data'

const Picker = lazy(() => import('@emoji-mart/react'))

interface EmojiPickerPopoverProps {
  triggerRef: React.RefObject<HTMLDivElement | null>
  triggerRect: DOMRect
  onSelect: (icon: string) => void
  onRemove: () => void
  onClose: () => void
}

export function EmojiPickerPopover({ triggerRef, triggerRect, onSelect, onRemove, onClose }: EmojiPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const reposition = () => {
      const h = el.offsetHeight
      const w = el.offsetWidth
      if (h === 0) return
      const gap = 6
      const spaceBelow = window.innerHeight - triggerRect.bottom - gap
      const top = spaceBelow >= h
        ? triggerRect.bottom + gap
        : Math.max(8, triggerRect.top - h - gap)
      const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - w - 8))
      setPos({ top, left })
    }

    reposition()
    const observer = new ResizeObserver(reposition)
    observer.observe(el)
    return () => observer.disconnect()
  }, [triggerRect])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !triggerRef.current?.contains(target))
        onCloseRef.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [triggerRef])

  const isDark = document.documentElement.classList.contains('dark')

  const pickerVars = useMemo(() => {
    const root = document.documentElement
    const get = (prop: string) => getComputedStyle(root).getPropertyValue(prop).trim()

    const toRgb = (cssColor: string) => {
      const el = Object.assign(document.createElement('div'), {
        style: `position:fixed;visibility:hidden;background-color:${cssColor}`,
      })
      document.body.appendChild(el)
      const rgb = getComputedStyle(el).backgroundColor
      document.body.removeChild(el)
      const m = rgb.match(/\d+/g)
      return m ? `${m[0]}, ${m[1]}, ${m[2]}` : undefined
    }

    return {
      '--rgb-background': toRgb(get('--popover')),
      '--rgb-input':      toRgb(get('--muted')),
      '--rgb-color':      toRgb(get('--foreground')),
      '--rgb-accent':     toRgb(get('--primary')),
      '--color-border':      get('--border'),
      '--color-border-over': get('--border'),
    } as React.CSSProperties
  }, [])

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    top: pos?.top ?? triggerRect.bottom + 6,
    left: pos?.left ?? triggerRect.left,
    visibility: pos ? 'visible' : 'hidden',
  }

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="rounded-xl bg-popover border border-border shadow-xl overflow-hidden"
    >
      <div className="flex items-center justify-end border-b border-border px-1">
        <button
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onRemove(); onClose() }}
        >
          Remove
        </button>
      </div>
      <div style={pickerVars}>
        <Suspense fallback={<div className="w-[352px] h-[435px]" />}>
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => { onSelect(emoji.native); onClose() }}
            theme={isDark ? 'dark' : 'light'}
            previewPosition="none"
            skinTonePosition="none"
            navPosition="bottom"
            perLine={9}
          />
        </Suspense>
      </div>
    </div>,
    document.body
  )
}
