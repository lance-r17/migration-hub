import { Editable } from '../Editable'
import type { BlockRendererProps } from './types'

export function BulletBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  return (
    <div className="flex gap-2 items-start py-[3px] px-[2px]">
      <div className="flex-none w-[22px] flex justify-center text-[20px] leading-[1.3] text-foreground select-none">•</div>
      <Editable
        className="text-base leading-[1.6] flex-1 min-w-0"
        value={block.content}
        onChange={(html) => onChange({ content: html })}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="List"
        autoFocus={autoFocus}
        blockId={block.id}
        readOnly={readOnly}
      />
    </div>
  )
}
