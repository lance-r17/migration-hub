import { useState } from 'react'
import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

export function CalloutBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  const [openIconPick, setOpenIconPick] = useState(false)
  const b = block as Extract<Block, { type: 'callout' }>
  const icons = ['💡', '⚠️', '✅', '🔥', '📌', 'ℹ️', '🎯', '🧠', '✨', '🚧']

  const hasBg = !!b.bgColor
  const calloutStyle: React.CSSProperties = {
    color: b.textColor,
    backgroundColor: b.bgColor,
    border: hasBg ? undefined : '1px solid var(--border)',
    borderRadius: 10,
  }

  return (
    <div className="flex gap-3 px-4 py-3.5 rounded-[10px]" style={calloutStyle}>
      <div
        className="flex-none w-[22px] h-[22px] text-[18px] leading-[1.4] grid place-items-center cursor-pointer relative"
        onClick={() => !readOnly && setOpenIconPick(s => !s)}
        onMouseDown={(e) => e.preventDefault()}
      >
        {b.icon || '💡'}
        {openIconPick && !readOnly && (
          <div className="absolute z-50 top-7 left-0 w-[180px] flex flex-wrap gap-1 p-1.5 rounded-md bg-popover border border-border shadow-md">
            {icons.map(i => (
              <button
                key={i}
                className="w-[26px] h-[26px] rounded border border-border text-base hover:bg-muted"
                onClick={(e) => { e.stopPropagation(); onChange({ icon: i }); setOpenIconPick(false) }}
              >
                {i}
              </button>
            ))}
          </div>
        )}
      </div>
      <Editable
        className="flex-1 min-w-0 text-[15.5px] leading-[1.55]"
        style={{ color: b.textColor }}
        value={block.content}
        onChange={(html) => onChange({ content: html })}
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
