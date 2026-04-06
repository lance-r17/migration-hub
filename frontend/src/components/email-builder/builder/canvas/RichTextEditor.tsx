import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, CaseUpper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { TEMPLATE_VARIABLES } from '@/types/email'

interface Props {
  html: string
  onChange: (html: string) => void
  onClose: () => void
  editorRef?: MutableRefObject<{ insertVariable: (v: string) => void } | null>
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: Record<string, string>) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFontSize: (fontSize: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize }).run(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as ReturnType<Extension['addCommands']>
  },
})

const Uppercase = Mark.create({
  name: 'uppercase',
  parseHTML() {
    return [{ style: 'text-transform=uppercase' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { style: 'text-transform: uppercase' }), 0]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toggleUppercase: () => ({ commands }: any) => commands.toggleMark(this.name),
    } as ReturnType<Mark['addCommands']>
  },
})

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32]

export function RichTextEditor({ html, onChange, onClose, editorRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [varMenu, setVarMenu] = useState<{ x: number; y: number; query: string } | null>(null)
  const [varMenuIndex, setVarMenuIndex] = useState(0)

  const filteredVars = varMenu
    ? TEMPLATE_VARIABLES.filter(v =>
        v.key.toLowerCase().includes(varMenu.query.toLowerCase()) ||
        v.label.toLowerCase().includes(varMenu.query.toLowerCase())
      )
    : []

  const commitVariable = (varKey: string, editorInstance: ReturnType<typeof useEditor>) => {
    if (!editorInstance) return
    const pos = editorInstance.state.selection.head
    const textBefore = editorInstance.state.doc.textBetween(Math.max(0, pos - 60), pos)
    const match = textBefore.match(/\{\{([^{}]*)$/)
    if (match) {
      editorInstance.chain()
        .focus()
        .deleteRange({ from: pos - match[0].length, to: pos })
        .insertContent(`{{${varKey}}}`)
        .run()
    }
    setVarMenu(null)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      FontSize,
      Uppercase,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'underline text-primary' } }),
    ],
    content: html,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())

      // Detect {{ for variable autocomplete
      const pos = ed.state.selection.head
      const textBefore = ed.state.doc.textBetween(Math.max(0, pos - 60), pos)
      const match = textBefore.match(/\{\{([^{}]*)$/)
      if (match) {
        const coords = ed.view.coordsAtPos(pos)
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          setVarMenu({ x: coords.left - rect.left, y: coords.bottom - rect.top + 4, query: match[1] })
          setVarMenuIndex(0)
        }
      } else {
        setVarMenu(null)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none min-h-[60px] px-2 py-1',
      },
      handleKeyDown: (_view, event) => {
        if (!varMenu || filteredVars.length === 0) return false
        if (event.key === 'ArrowDown') {
          setVarMenuIndex(i => Math.min(i + 1, filteredVars.length - 1))
          return true
        }
        if (event.key === 'ArrowUp') {
          setVarMenuIndex(i => Math.max(i - 1, 0))
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (filteredVars[varMenuIndex]) {
            commitVariable(filteredVars[varMenuIndex].key, editor)
          }
          return true
        }
        if (event.key === 'Escape') {
          setVarMenu(null)
          return true
        }
        return false
      },
    },
  })

  // Wire editorRef for external variable insertion (e.g. right panel)
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = {
        insertVariable: (variable: string) => editor.chain().focus().insertContent(variable).run(),
      }
      return () => { editorRef.current = null }
    }
  }, [editor, editorRef])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !varMenu) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, varMenu])

  if (!editor) return null

  const setLink = () => {
    const url = window.prompt('Enter URL', editor.getAttributes('link').href ?? '')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const insertVariableTrigger = () => {
    editor.chain().focus().insertContent('{{').run()
  }

  const currentFontSize = editor.getAttributes('textStyle').fontSize ?? ''

  return (
    <div ref={containerRef} className="relative flex flex-col rounded-lg border border-primary shadow-lg bg-background overflow-visible z-50 w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border px-1 py-1 bg-muted/40">
        <Button
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-6"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          title="Bold"
        >
          <Bold className="size-3" />
        </Button>
        <Button
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-6"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          title="Italic"
        >
          <Italic className="size-3" />
        </Button>
        <Button
          variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-6"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}
          title="Underline"
        >
          <UnderlineIcon className="size-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        {/* Font size */}
        <select
          className="h-6 text-[11px] bg-transparent border border-border rounded px-1 cursor-pointer focus:outline-none"
          title="Font size"
          value={currentFontSize}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => {
            const val = e.target.value
            if (val) {
              editor.chain().focus().setFontSize(val).run()
            } else {
              editor.chain().focus().unsetFontSize().run()
            }
          }}
        >
          <option value="">–</option>
          {FONT_SIZES.map(s => (
            <option key={s} value={`${s}px`}>{s}</option>
          ))}
        </select>
        {/* Uppercase */}
        <Button
          variant={editor.isActive('uppercase') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-6"
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUppercase().run() }}
          title="Uppercase"
        >
          <CaseUpper className="size-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <Button
          variant={editor.isActive('link') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-6"
          onMouseDown={e => { e.preventDefault(); setLink() }}
          title="Link"
        >
          <LinkIcon className="size-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <input
          type="color"
          className="size-5 cursor-pointer rounded border-0 p-0 bg-transparent"
          title="Text color"
          value={editor.getAttributes('textStyle').color ?? '#000000'}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
        />
        <div className="flex-1" />
        {/* Insert variable button */}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 font-mono text-[11px] leading-none"
          onMouseDown={e => { e.preventDefault(); insertVariableTrigger() }}
          title="Insert variable"
        >
          {'{}'}
        </Button>
      </div>
      {/* Editor */}
      <div className="px-1">
        <EditorContent editor={editor} />
      </div>

      {/* Variable autocomplete dropdown */}
      {varMenu && filteredVars.length > 0 && (
        <div
          className="absolute z-50 w-56 rounded-md border border-border bg-popover shadow-md overflow-hidden"
          style={{ top: varMenu.y, left: Math.max(0, varMenu.x) }}
        >
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-b border-border bg-muted/40">
            Variables — type to filter
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredVars.map((v, i) => (
              <button
                key={v.key}
                className={`w-full text-left px-2 py-1 text-xs font-mono flex items-center gap-2 ${
                  i === varMenuIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                }`}
                onMouseDown={e => { e.preventDefault(); commitVariable(v.key, editor) }}
                onMouseEnter={() => setVarMenuIndex(i)}
              >
                <span className="opacity-60 text-[10px] shrink-0">{v.category}</span>
                <span>{`{{${v.key}}}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
