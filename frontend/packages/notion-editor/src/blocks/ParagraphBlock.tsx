import { Editable } from '../Editable'
import type { BlockRendererProps } from './types'

export function ParagraphBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  return (
    <Editable
      className="text-base leading-[1.6] px-[2px] py-[3px]"
      value={block.content}
      onChange={(html) => onChange({ content: html })}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={readOnly ? '' : "Type '/' for commands"}
      autoFocus={autoFocus}
      blockId={block.id}
      readOnly={readOnly}
    />
  )
}
