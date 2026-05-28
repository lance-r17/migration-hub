import { Check } from 'lucide-react'
import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

export function TodoBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  const done = (block as Extract<Block, { type: 'todo' }>).checked
  return (
    <div className="flex gap-2 items-start py-[3px] px-[2px]">
      <div
        className={`flex-none w-[18px] h-[18px] rounded border-[1.5px] mt-1 grid place-items-center cursor-pointer transition-colors duration-100 ${done ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-muted-foreground'}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !readOnly && onChange({ checked: !done })}
      >
        {done && <Check size={14} />}
      </div>
      <Editable
        className={`text-base leading-[1.6] flex-1 min-w-0 ${done ? 'text-muted-foreground line-through' : ''}`}
        value={block.content}
        onChange={(html) => onChange({ content: html })}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="To-do"
        autoFocus={autoFocus}
        blockId={block.id}
        readOnly={readOnly}
      />
    </div>
  )
}
