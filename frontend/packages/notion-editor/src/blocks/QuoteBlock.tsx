import { Editable } from '../Editable'
import type { BlockRendererProps } from './types'

export function QuoteBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  return (
    <div className="border-l-[3px] py-1 pl-4 text-[17px] leading-[1.5]" style={{ borderColor: block.textColor || undefined }}>
      <Editable
        value={block.content}
        onChange={(html) => onChange({ content: html })}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="Empty quote"
        autoFocus={autoFocus}
        blockId={block.id}
        readOnly={readOnly}
      />
    </div>
  )
}
