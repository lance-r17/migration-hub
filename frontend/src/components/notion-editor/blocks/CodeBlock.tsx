import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

export function CodeBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'code' }>
  return (
    <div className="bg-muted text-foreground rounded-md px-[18px] py-4 font-mono text-[13.5px] leading-[1.55] overflow-x-auto relative">
      <div className="absolute top-2.5 right-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{b.language || 'code'}</div>
      <Editable
        className="font-mono whitespace-pre min-h-[1.55em]"
        value={block.content}
        onChange={(html) => onChange({ content: html })}
        onKeyDown={(e) => {
          if (readOnly) return
          if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); return }
          if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); return }
          onKeyDown?.(e)
        }}
        onFocus={onFocus}
        placeholder="// code"
        plain
        autoFocus={autoFocus}
        blockId={block.id}
        readOnly={readOnly}
      />
    </div>
  )
}
