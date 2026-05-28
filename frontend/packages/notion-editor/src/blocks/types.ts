import type { Block } from '../model'

export interface BlockRendererProps {
  block: Block
  onChange: (patch: Partial<Block>) => void
  onDelete?: () => void
  onFlatten?: (blocks: Block[]) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onFocus?: () => void
  autoFocus?: boolean
  number?: number
  readOnly?: boolean
}

export interface TableMenuState {
  kind: 'col' | 'row' | 'cell'
  index?: number
  r?: number
  c?: number
  pos: { left: number; top: number }
}
