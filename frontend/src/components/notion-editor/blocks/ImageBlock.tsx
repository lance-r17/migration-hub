import { useRef, useState, useEffect } from 'react'
import { Image, AlignLeft, AlignCenter, AlignRight, MessageSquare, Crop, Maximize2, ChevronDown, Check } from 'lucide-react'
import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

/* ─── helpers ─── */

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/* ─── Toolbar button ─── */

function ToolBtn({
  icon: Icon,
  active,
  title,
  onClick,
}: {
  icon: React.ElementType
  active?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      className={`p-1.5 rounded transition-colors hover:bg-white/20 ${active ? 'text-white' : 'text-white/60'}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <Icon size={14} />
    </button>
  )
}

/* ─── Crop dialog ─── */

type CropRect = { x: number; y: number; w: number; h: number } // 0-100 %
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
type AspectRatio = 'freeform' | 'circle' | 'square' | '4:3' | '7:5' | '3:2' | '5:3' | '16:9'

const ASPECT_RATIOS: Array<{ label: string; value: AspectRatio; ratio?: number }> = [
  { label: 'Freeform', value: 'freeform' },
  { label: 'Circle',   value: 'circle',  ratio: 1 },
  { label: 'Square',   value: 'square',  ratio: 1 },
  { label: '4 : 3',   value: '4:3',     ratio: 4 / 3 },
  { label: '7 : 5',   value: '7:5',     ratio: 7 / 5 },
  { label: '3 : 2',   value: '3:2',     ratio: 3 / 2 },
  { label: '5 : 3',   value: '5:3',     ratio: 5 / 3 },
  { label: '16 : 9',  value: '16:9',    ratio: 16 / 9 },
]

function CropDialog({
  src,
  initialCrop,
  initialAspectRatio,
  onClose,
  onApply,
}: {
  src: string
  initialCrop?: CropRect
  initialAspectRatio?: string
  onClose: () => void
  onApply: (croppedSrc: string, crop: CropRect, aspectRatio: AspectRatio) => void
}) {
  const [crop, setCrop] = useState<CropRect>(initialCrop ?? { x: 0, y: 0, w: 100, h: 100 })
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    (initialAspectRatio as AspectRatio | undefined) ?? 'freeform'
  )
  const [showRatioMenu, setShowRatioMenu] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    init: CropRect
  } | null>(null)

  const getFixedRatio = (ar: AspectRatio) =>
    ASPECT_RATIOS.find((r) => r.value === ar)?.ratio

  const applyAspectRatio = (ar: AspectRatio) => {
    setAspectRatio(ar)
    if (ar === 'circle' || ar === 'square') {
      // Set crop to the largest square fitting the image, centred, based on shorter edge
      const img = imgRef.current
      const nw = img?.naturalWidth ?? 0
      const nh = img?.naturalHeight ?? 0
      if (nw > 0 && nh > 0) {
        const wPct = nw >= nh ? (nh / nw) * 100 : 100
        const hPct = nw >= nh ? 100 : (nw / nh) * 100
        setCrop({ x: (100 - wPct) / 2, y: (100 - hPct) / 2, w: wPct, h: hPct })
      }
      return
    }
    const ratio = ASPECT_RATIOS.find((r) => r.value === ar)?.ratio
    if (!ratio) return
    // Convert pixel ratio → percentage-space ratio:
    // c.w% * imgW = c.h% * imgH * ratio  →  c.w/c.h = ratio * imgH/imgW
    const el = containerRef.current
    const pctRatio = el && el.offsetWidth > 0 ? ratio * el.offsetHeight / el.offsetWidth : ratio
    setCrop((prev) => {
      const cx = prev.x + prev.w / 2
      const cy = prev.y + prev.h / 2
      let newW = prev.w
      let newH = newW / pctRatio
      if (newH > 100) { newH = 100; newW = newH * pctRatio }
      return {
        x: clamp(cx - newW / 2, 0, 100 - newW),
        y: clamp(cy - newH / 2, 0, 100 - newH),
        w: newW,
        h: newH,
      }
    })
  }

  const startDrag = (e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, init: { ...crop } }
    const ratio = getFixedRatio(aspectRatio)

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((ev.clientX - d.startX) / rect.width) * 100
      const dy = ((ev.clientY - d.startY) / rect.height) * 100
      // Convert pixel ratio → percentage-space ratio so 1:1 stays square on non-square images
      const pctRatio = ratio != null && rect.width > 0 ? ratio * rect.height / rect.width : undefined
      const c = { ...d.init }

      if (d.mode === 'move') {
        c.x = clamp(c.x + dx, 0, 100 - c.w)
        c.y = clamp(c.y + dy, 0, 100 - c.h)
      } else if (d.mode === 'se') {
        c.w = clamp(c.w + dx, 5, 100 - c.x)
        if (pctRatio) { c.h = clamp(c.w / pctRatio, 5, 100 - c.y); c.w = c.h * pctRatio }
        else { c.h = clamp(c.h + dy, 5, 100 - c.y) }
      } else if (d.mode === 'sw') {
        const nx = clamp(c.x + dx, 0, c.x + c.w - 5)
        const newW = c.x + c.w - nx
        if (pctRatio) {
          const newH = clamp(newW / pctRatio, 5, 100 - c.y)
          c.x = c.x + c.w - newH * pctRatio; c.w = newH * pctRatio; c.h = newH
        } else {
          c.w = newW; c.x = nx; c.h = clamp(c.h + dy, 5, 100 - c.y)
        }
      } else if (d.mode === 'ne') {
        c.w = clamp(c.w + dx, 5, 100 - c.x)
        if (pctRatio) {
          const newH = clamp(c.w / pctRatio, 5, c.y + c.h)
          c.y = c.y + c.h - newH; c.h = newH; c.w = newH * pctRatio
        } else {
          const ny = clamp(c.y + dy, 0, c.y + c.h - 5)
          c.h = c.y + c.h - ny; c.y = ny
        }
      } else if (d.mode === 'nw') {
        const nx = clamp(c.x + dx, 0, c.x + c.w - 5)
        const newW = c.x + c.w - nx
        if (pctRatio) {
          const newH = clamp(newW / pctRatio, 5, c.y + c.h)
          c.x = c.x + c.w - newH * pctRatio; c.w = newH * pctRatio
          c.y = c.y + c.h - newH; c.h = newH
        } else {
          c.w = newW; c.x = nx
          const ny = clamp(c.y + dy, 0, c.y + c.h - 5)
          c.h = c.y + c.h - ny; c.y = ny
        }
      } else if (d.mode === 'n') {
        const ny = clamp(c.y + dy, 0, c.y + c.h - 5)
        const newH = c.y + c.h - ny
        if (pctRatio) { const newW = clamp(newH * pctRatio, 5, 100); c.x = clamp(c.x + c.w / 2 - newW / 2, 0, 100 - newW); c.w = newW }
        c.h = newH; c.y = ny
      } else if (d.mode === 's') {
        const newH = clamp(c.h + dy, 5, 100 - c.y)
        if (pctRatio) { const newW = clamp(newH * pctRatio, 5, 100); c.x = clamp(c.x + c.w / 2 - newW / 2, 0, 100 - newW); c.w = newW }
        c.h = newH
      } else if (d.mode === 'w') {
        const nx = clamp(c.x + dx, 0, c.x + c.w - 5)
        const newW = c.x + c.w - nx
        if (pctRatio) { const newH = clamp(newW / pctRatio, 5, 100); c.y = clamp(c.y + c.h / 2 - newH / 2, 0, 100 - newH); c.h = newH }
        c.w = newW; c.x = nx
      } else if (d.mode === 'e') {
        const newW = clamp(c.w + dx, 5, 100 - c.x)
        if (pctRatio) { const newH = clamp(newW / pctRatio, 5, 100); c.y = clamp(c.y + c.h / 2 - newH / 2, 0, 100 - newH); c.h = newH }
        c.w = newW
      }
      setCrop(c)
    }

    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const applyCrop = () => {
    const img = new window.Image()
    img.onload = () => {
      const cx = (crop.x / 100) * img.naturalWidth
      const cy = (crop.y / 100) * img.naturalHeight
      const cw = (crop.w / 100) * img.naturalWidth
      const ch = (crop.h / 100) * img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(cw)
      canvas.height = Math.round(ch)
      const ctx = canvas.getContext('2d')!
      if (aspectRatio === 'circle') {
        ctx.beginPath()
        ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2)
        ctx.clip()
      }
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height)
      onApply(canvas.toDataURL(), crop, aspectRatio)
    }
    img.crossOrigin = 'anonymous'
    img.src = src
  }

  const isCircle = aspectRatio === 'circle'
  const currentLabel = ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label ?? 'Freeform'
  // Shared handle classes
  const hBase = 'absolute z-20 bg-white border-2 border-white/80 shadow-sm'
  const hCorner = `${hBase} w-3 h-3`
  const hEdge  = `${hBase} w-2.5 h-2.5 rounded-sm`

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={() => setShowRatioMenu(false)}
    >
      <div
        className="bg-background rounded-xl shadow-2xl flex flex-col overflow-hidden max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          {/* Aspect ratio picker */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
              onClick={() => setShowRatioMenu((v) => !v)}
            >
              {currentLabel}
              <ChevronDown size={13} className="text-muted-foreground" />
            </button>
            {showRatioMenu && (
              <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden min-w-[130px] z-10">
                {ASPECT_RATIOS.map((r) => (
                  <button
                    key={r.value}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-6"
                    onClick={() => { applyAspectRatio(r.value); setShowRatioMenu(false) }}
                  >
                    {r.label}
                    {r.value === aspectRatio && <Check size={13} className="text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium pointer-events-none">
            Crop image
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              onClick={applyCrop}
            >
              Save
            </button>
          </div>
        </div>

        {/* Image + crop overlay */}
        <div className="p-4 overflow-auto">
          <div ref={containerRef} className="relative inline-block overflow-hidden select-none">
            <img
              ref={imgRef}
              src={src}
              className="block max-w-[75vw] max-h-[65vh] object-contain"
              draggable={false}
            />
            {/* Crop rect */}
            <div
              className="absolute border border-white cursor-move"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                borderRadius: isCircle ? '50%' : undefined,
              }}
              onMouseDown={(e) => startDrag(e, 'move')}
            >
              {/* Rule-of-thirds grid */}
              {!isCircle && (
                <div className="absolute inset-0 pointer-events-none">
                  {[33.33, 66.66].map((p) => (
                    <div key={`v${p}`} className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${p}%` }} />
                  ))}
                  {[33.33, 66.66].map((p) => (
                    <div key={`h${p}`} className="absolute left-0 right-0 h-px bg-white/25" style={{ top: `${p}%` }} />
                  ))}
                </div>
              )}
              {/* 4 corners */}
              <div className={`${hCorner} top-0 left-0 cursor-nw-resize`}     onMouseDown={(e) => startDrag(e, 'nw')} />
              <div className={`${hCorner} top-0 right-0 cursor-ne-resize`}    onMouseDown={(e) => startDrag(e, 'ne')} />
              <div className={`${hCorner} bottom-0 left-0 cursor-sw-resize`}  onMouseDown={(e) => startDrag(e, 'sw')} />
              <div className={`${hCorner} bottom-0 right-0 cursor-se-resize`} onMouseDown={(e) => startDrag(e, 'se')} />
              {/* 4 edges (hidden for circle) */}
              {!isCircle && (
                <>
                  <div className={`${hEdge} top-0 left-1/2 -translate-x-1/2 cursor-ns-resize`}  onMouseDown={(e) => startDrag(e, 'n')} />
                  <div className={`${hEdge} bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize`} onMouseDown={(e) => startDrag(e, 's')} />
                  <div className={`${hEdge} left-0 top-1/2 -translate-y-1/2 cursor-ew-resize`}  onMouseDown={(e) => startDrag(e, 'w')} />
                  <div className={`${hEdge} right-0 top-1/2 -translate-y-1/2 cursor-ew-resize`} onMouseDown={(e) => startDrag(e, 'e')} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── ImageBlock ─── */

export function ImageBlock({ block, onChange, readOnly }: BlockRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const b = block as Extract<Block, { type: 'image' }>

  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showCrop, setShowCrop] = useState(false)
  const [widthPct, setWidthPct] = useState(b.width ?? 100)
  const [showCaption, setShowCaption] = useState(!!b.caption)
  const widthRef = useRef(widthPct)
  useEffect(() => { widthRef.current = widthPct }, [widthPct])

  const align = b.align ?? 'center'

  const onFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ src: reader.result as string })
    reader.readAsDataURL(file)
  }

  const startResize = (e: React.MouseEvent, side: 'left' | 'right') => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const startX = e.clientX
    const startWidthPx = container.offsetWidth
    const parentWidth = container.parentElement?.offsetWidth ?? startWidthPx

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const delta = side === 'right' ? dx : -dx
      const newPct = clamp(Math.round(((startWidthPx + delta) / parentWidth) * 100), 10, 100)
      setWidthPct(newPct)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      onChange({ width: widthRef.current })
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const toggleCaption = () => {
    if (showCaption) {
      setShowCaption(false)
      onChange({ caption: '' })
    } else {
      setShowCaption(true)
    }
  }

  const justifyClass =
    align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'

  return (
    <>
      {/* Upload / empty state */}
      {!b.src && (
        <div className="rounded-md overflow-hidden">
          {!readOnly ? (
            <div
              className="flex gap-3 items-center px-4 py-3.5 text-sm text-muted-foreground cursor-pointer hover:bg-border hover:text-foreground"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
            >
              <Image size={18} />
              <span>Click to upload an image, or drag &amp; drop</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="flex gap-3 items-center px-4 py-3.5 text-sm text-muted-foreground">
              <Image size={18} />
              <span>No image</span>
            </div>
          )}
        </div>
      )}

      {/* Image with resize + toolbar */}
      {b.src && (
        <div
          className={`flex ${justifyClass}`}
          onMouseEnter={() => !readOnly && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div ref={containerRef} className="relative" style={{ width: `${widthPct}%` }}>
            {/* Image + overlays */}
            <div className="relative rounded-md overflow-hidden">
              <img className="block w-full h-auto" src={b.src} alt="" />

              {/* Resize handles */}
              {hovered && (
                <>
                  <div
                    className="absolute left-0 inset-y-0 w-6 flex items-center justify-start cursor-ew-resize z-10 group"
                    onMouseDown={(e) => startResize(e, 'left')}
                  >
                    <div className="ml-1 h-14 w-1.5 bg-black/25 group-hover:bg-black/55 rounded-full transition-colors" />
                  </div>
                  <div
                    className="absolute right-0 inset-y-0 w-6 flex items-center justify-end cursor-ew-resize z-10 group"
                    onMouseDown={(e) => startResize(e, 'right')}
                  >
                    <div className="mr-1 h-14 w-1.5 bg-black/25 group-hover:bg-black/55 rounded-full transition-colors" />
                  </div>
                </>
              )}

              {/* Toolbar */}
              {hovered && (
                <div className="absolute top-2 right-2 z-20 flex items-center bg-black/50 backdrop-blur-sm rounded-md p-0.5 gap-px">
                  <ToolBtn icon={AlignLeft} active={align === 'left'} title="Align left" onClick={() => onChange({ align: 'left' })} />
                  <ToolBtn icon={AlignCenter} active={align === 'center'} title="Align center" onClick={() => onChange({ align: 'center' })} />
                  <ToolBtn icon={AlignRight} active={align === 'right'} title="Align right" onClick={() => onChange({ align: 'right' })} />
                  <div className="w-px h-4 bg-white/25 mx-0.5" />
                  <ToolBtn icon={MessageSquare} active={showCaption} title="Toggle caption" onClick={toggleCaption} />
                  <ToolBtn icon={Crop} title="Crop" onClick={() => setShowCrop(true)} />
                  <ToolBtn icon={Maximize2} title="Expand" onClick={() => setExpanded(true)} />
                </div>
              )}
            </div>

            {/* Caption */}
            {showCaption && (
              <Editable
                className="px-1 py-1.5 text-[13px] text-muted-foreground"
                value={b.caption}
                onChange={(html) => onChange({ caption: html })}
                placeholder="Write a caption…"
                readOnly={readOnly}
              />
            )}
          </div>
        </div>
      )}

      {/* Expand (lightbox) */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
          onClick={() => setExpanded(false)}
        >
          <img
            className="max-w-[92vw] max-h-[92vh] object-contain rounded shadow-2xl"
            src={b.src}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Crop dialog */}
      {showCrop && (
        <CropDialog
          src={b.originalSrc ?? b.src!}
          initialCrop={b.cropRect}
          initialAspectRatio={b.cropAspectRatio}
          onClose={() => setShowCrop(false)}
          onApply={(croppedSrc, cropRect, cropAspectRatio) => {
            onChange({ src: croppedSrc, originalSrc: b.originalSrc ?? b.src, cropRect, cropAspectRatio })
            setShowCrop(false)
          }}
        />
      )}
    </>
  )
}
