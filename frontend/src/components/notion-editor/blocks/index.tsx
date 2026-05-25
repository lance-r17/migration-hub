import type { BlockRendererProps } from './types'
import { ParagraphBlock } from './ParagraphBlock'
import { HeadingBlock } from './HeadingBlock'
import { BulletBlock } from './BulletBlock'
import { NumberedBlock } from './NumberedBlock'
import { TodoBlock } from './TodoBlock'
import { CalloutBlock } from './CalloutBlock'
import { QuoteBlock } from './QuoteBlock'
import { CodeBlock } from './CodeBlock'
import { DividerBlock } from './DividerBlock'
import { TableBlock } from './TableBlock'
import { ImageBlock } from './ImageBlock'
import { BookmarkBlock } from './BookmarkBlock'
import { TabsBlock } from './TabsBlock'
import { ColumnsBlock } from './ColumnsBlock'

export type { BlockRendererProps }
export type { TableMenuState } from './types'

const RENDERERS: Record<string, React.FC<BlockRendererProps>> = {
  paragraph: ParagraphBlock,
  h1: HeadingBlock,
  h2: HeadingBlock,
  h3: HeadingBlock,
  bullet: BulletBlock,
  numbered: NumberedBlock,
  todo: TodoBlock,
  callout: CalloutBlock,
  quote: QuoteBlock,
  code: CodeBlock,
  divider: DividerBlock,
  table: TableBlock,
  image: ImageBlock,
  bookmark: BookmarkBlock,
  tabs: TabsBlock,
  columns: ColumnsBlock,
}

export default RENDERERS
