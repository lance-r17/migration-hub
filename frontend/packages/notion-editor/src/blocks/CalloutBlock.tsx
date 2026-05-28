import { useState, useRef } from 'react'
import { Editable } from '../Editable'
import { EmojiPickerPopover } from './EmojiPickerPopover'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

export function CalloutBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  const [openIconPick, setOpenIconPick] = useState(false)
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const b = block as Extract<Block, { type: 'callout' }>

  const hasBg = !!b.bgColor
  const calloutStyle: React.CSSProperties = {
    color: b.textColor,
    backgroundColor: b.bgColor,
    border: hasBg ? undefined : '1px solid var(--border)',
    borderRadius: 10,
  }

  const handleTriggerClick = () => {
    if (readOnly) return
    if (openIconPick) {
      setOpenIconPick(false)
      setTriggerRect(null)
    } else {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setTriggerRect(rect)
      setOpenIconPick(true)
    }
  }

  const isImageIcon = b.icon?.startsWith('data:') || b.icon?.startsWith('http')

  return (
    <div className="flex gap-3 px-4 py-3.5 rounded-[10px]" style={calloutStyle}>
      <div
        ref={triggerRef}
        className="flex-none w-[28px] h-[28px] text-[24px] leading-[1.4] grid place-items-center cursor-pointer"
        onMouseDown={e => e.preventDefault()}
        onClick={handleTriggerClick}
      >
        {isImageIcon ? (
          <img src={b.icon} alt="" className="w-[26px] h-[26px] object-cover rounded-sm" />
        ) : (
          b.icon || '💡'
        )}
      </div>

      {openIconPick && triggerRect && (
        <EmojiPickerPopover
          triggerRef={triggerRef}
          triggerRect={triggerRect}
          onSelect={icon => onChange({ icon })}
          onRemove={() => onChange({ icon: '' })}
          onClose={() => { setOpenIconPick(false); setTriggerRect(null) }}
        />
      )}

      <Editable
        className="flex-1 min-w-0 text-[15.5px] leading-[1.55]"
        style={{ color: b.textColor }}
        value={block.content}
        onChange={html => onChange({ content: html })}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="Write something…"
        autoFocus={autoFocus}
        blockId={block.id}
        readOnly={readOnly}
      />
    </div>
  )
}
