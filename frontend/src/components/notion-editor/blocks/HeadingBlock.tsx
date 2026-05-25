import { Editable } from '../Editable'
import type { BlockRendererProps } from './types'

const HEADING_STYLES: Record<string, string> = {
  h1: 'text-[30px] font-bold tracking-[-0.015em] leading-[1.2] pt-3.5 pb-0.5 px-[2px]',
  h2: 'text-2xl font-semibold tracking-[-0.01em] leading-[1.25] pt-3 pb-0.5 px-[2px]',
  h3: 'text-[19px] font-semibold leading-[1.3] pt-2 pb-0.5 px-[2px]',
}

export function HeadingBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  const placeholderMap: Record<string, string> = { h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' }
  return (
    <Editable
      className={HEADING_STYLES[block.type]}
      value={block.content}
      onChange={(html) => onChange({ content: html })}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholderMap[block.type]}
      autoFocus={autoFocus}
      blockId={block.id}
      readOnly={readOnly}
    />
  )
}
