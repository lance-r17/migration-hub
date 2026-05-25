export interface BaseBlock {
  id: string
  type: string
  content?: string
  textColor?: string
  bgColor?: string
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph'
}

export interface HeadingBlock extends BaseBlock {
  type: 'h1' | 'h2' | 'h3'
}

export interface ListBlock extends BaseBlock {
  type: 'bullet' | 'numbered'
}

export interface TodoBlock extends BaseBlock {
  type: 'todo'
  checked: boolean
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout'
  variant: 'info' | 'warn' | 'success' | 'danger' | 'neutral'
  icon: string
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote'
}

export interface CodeBlock extends BaseBlock {
  type: 'code'
  language: string
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
}

export interface TableBlock extends BaseBlock {
  type: 'table'
  cols: number
  rows: string[][]
  cellStyles?: Record<string, { textColor?: string; bgColor?: string }>
}

export interface ImageBlock extends BaseBlock {
  type: 'image'
  src: string
  caption?: string
}

export interface BookmarkBlock extends BaseBlock {
  type: 'bookmark'
  url: string
  title: string
  desc: string
}

export interface TabsBlock extends BaseBlock {
  type: 'tabs'
  tabs: Array<{ title: string; icon?: string; blocks: Block[] }>
  activeTab: number
}

export interface ColumnsBlock extends BaseBlock {
  type: 'columns'
  count: number
  columns: Block[][]
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | TodoBlock
  | CalloutBlock
  | QuoteBlock
  | CodeBlock
  | DividerBlock
  | TableBlock
  | ImageBlock
  | BookmarkBlock
  | TabsBlock
  | ColumnsBlock

import { TEXT_COLOR_MAP, BG_COLOR_MAP } from './blocks/table-constants'

export const uid = () => Math.random().toString(36).slice(2, 10)

export function cloneBlock(block: Block): Block {
  const base: Block = { ...block, id: uid() }
  switch (base.type) {
    case 'columns':
      return { ...base, columns: base.columns.map(col => col.map(cloneBlock)) }
    case 'tabs':
      return { ...base, tabs: base.tabs.map(tab => ({ ...tab, blocks: tab.blocks.map(cloneBlock) })) }
    default:
      return base
  }
}

export function createBlock(type: Block['type'], init: Partial<Omit<Block, 'type'>> = {}): Block {
  const base = { id: uid(), type, content: '' }
  switch (type) {
    case 'paragraph':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'bullet':
    case 'numbered':
      return { ...base, ...init } as Block
    case 'todo':
      return { ...base, checked: false, ...init } as Block
    case 'callout': {
      const variant = (init as any)?.variant || 'info'
      return {
        ...base,
        variant,
        icon: '💡',
        textColor: TEXT_COLOR_MAP['default'],
        bgColor: BG_COLOR_MAP['default'],
        ...init,
      } as Block
    }
    case 'quote':
      return { ...base, ...init } as Block
    case 'code':
      return { ...base, language: 'javascript', ...init } as Block
    case 'divider':
      return { ...base, ...init } as Block
    case 'table':
      return {
        ...base,
        cols: 3,
        rows: [
          ['Name', 'Status', 'Owner'],
          ['', '', ''],
          ['', '', ''],
        ],
        cellStyles: {},
        ...init,
      } as Block
    case 'image':
      return { ...base, src: '', caption: '', ...init } as Block
    case 'bookmark':
      return { ...base, url: '', title: '', desc: '', ...init } as Block
    case 'tabs':
      return { ...base, tabs: [{ title: 'Tab 1', blocks: [] }, { title: 'Tab 2', blocks: [] }, { title: 'Tab 3', blocks: [] }], activeTab: 0, ...init } as Block
    case 'columns': {
      const count = Math.min(Math.max((init as any)?.count || 2, 2), 4)
      return { ...base, count, columns: Array.from({ length: count }, () => [createBlock('paragraph')]), ...init } as Block
    }
    default:
      return { ...base, type: 'paragraph' } as Block
  }
}

export interface SlashItem {
  group: string
  type: Block['type']
  title: string
  sub: string
  icon: string
  keys: string[]
  kbd?: string
  init?: Partial<Omit<Block, 'type'>>
}

export const SLASH_ITEMS: SlashItem[] = [
  { group: 'Basic blocks', type: 'paragraph', title: 'Text', sub: 'Just start writing with plain text.', icon: 'paragraph', keys: ['text', 'paragraph', 'p'] },
  { group: 'Basic blocks', type: 'h1', title: 'Heading 1', sub: 'Big section heading.', icon: 'h1', keys: ['heading 1', 'h1', 'title'], kbd: '#' },
  { group: 'Basic blocks', type: 'h2', title: 'Heading 2', sub: 'Medium section heading.', icon: 'h2', keys: ['heading 2', 'h2'], kbd: '##' },
  { group: 'Basic blocks', type: 'h3', title: 'Heading 3', sub: 'Small section heading.', icon: 'h3', keys: ['heading 3', 'h3'], kbd: '###' },
  { group: 'Basic blocks', type: 'bullet', title: 'Bulleted list', sub: 'Create a simple bulleted list.', icon: 'bullet', keys: ['bullet', 'list', 'ul'], kbd: '-' },
  { group: 'Basic blocks', type: 'numbered', title: 'Numbered list', sub: 'Create a list with numbering.', icon: 'numbered', keys: ['numbered', 'ol', 'list'], kbd: '1.' },
  { group: 'Basic blocks', type: 'todo', title: 'To‑do list', sub: 'Track tasks with a checkbox.', icon: 'todo', keys: ['todo', 'task', 'check'], kbd: '[]' },
  { group: 'Basic blocks', type: 'divider', title: 'Divider', sub: 'A horizontal line separator.', icon: 'divider', keys: ['divider', 'hr', 'line'], kbd: '---' },
  { group: 'Rich blocks', type: 'callout', title: 'Callout', sub: 'Highlight an idea or warning.', icon: 'callout', keys: ['callout', 'info', 'note'] },
  { group: 'Rich blocks', type: 'quote', title: 'Quote', sub: 'Capture a quote.', icon: 'quote', keys: ['quote', 'blockquote'], kbd: '>' },
  { group: 'Rich blocks', type: 'code', title: 'Code', sub: 'Code snippet with monospace.', icon: 'code-block', keys: ['code', 'snippet', 'monospace'], kbd: '```' },
  { group: 'Rich blocks', type: 'table', title: 'Table', sub: 'Add a simple structured table.', icon: 'table', keys: ['table', 'grid'] },
  { group: 'Media', type: 'image', title: 'Image', sub: 'Upload or embed an image.', icon: 'img', keys: ['image', 'img', 'picture'] },
  { group: 'Media', type: 'bookmark', title: 'Web bookmark', sub: 'Save a link as a visual bookmark.', icon: 'bookmark', keys: ['bookmark', 'link', 'url'] },
  { group: 'Advanced blocks', type: 'tabs', title: 'Tabs', sub: 'Organize content into tabbed sections.', icon: 'tabs', keys: ['tabs', 'tab', 'panel'] },
  { group: 'Layout', type: 'columns', title: '2 columns', sub: 'Side-by-side two columns.', icon: 'columns', keys: ['2 columns', 'columns', 'col'], init: { count: 2 } },
  { group: 'Layout', type: 'columns', title: '3 columns', sub: 'Side-by-side three columns.', icon: 'columns', keys: ['3 columns'], init: { count: 3 } },
  { group: 'Layout', type: 'columns', title: '4 columns', sub: 'Side-by-side four columns.', icon: 'columns', keys: ['4 columns'], init: { count: 4 } },
]
