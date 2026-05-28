import { useState, useRef, useEffect } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

const LANGUAGES = [
  'javascript', 'typescript', 'jsx', 'tsx', 'python', 'rust', 'go',
  'java', 'cpp', 'csharp', 'html', 'css', 'json', 'bash', 'sql',
  'yaml', 'markdown', 'ruby', 'php', 'mermaid',
]

const ACTIVE_THEME = themes.vsDark
const BG = ACTIVE_THEME.plain.backgroundColor as string
const FG = ACTIVE_THEME.plain.color as string

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code.trim() || !ref.current) return
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' })
      const id = `mmd-${Math.random().toString(36).slice(2, 9)}`
      mermaid.render(id, code)
        .then(({ svg }) => {
          if (ref.current) ref.current.innerHTML = svg
          setError(null)
        })
        .catch((err: Error) => setError(err.message ?? 'Invalid diagram'))
    })
  }, [code])

  if (error) return <div className="text-[12px] text-red-400 px-1 py-2 whitespace-pre-wrap font-mono">{error}</div>
  return <div ref={ref} className="flex justify-center py-2" />
}

function decodeHtml(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent ?? ''
}

export function CodeBlock({ block, onChange, onKeyDown, onFocus, autoFocus, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'code' }>
  const [focused, setFocused] = useState(false)
  const [openLangPick, setOpenLangPick] = useState(false)
  const [langQuery, setLangQuery] = useState('')
  const langPickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openLangPick) return
    const handler = (e: MouseEvent) => {
      if (langPickRef.current && !langPickRef.current.contains(e.target as Node)) {
        setOpenLangPick(false)
        setLangQuery('')
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [openLangPick])

  const filteredLangs = langQuery
    ? LANGUAGES.filter(l => l.includes(langQuery.toLowerCase()))
    : LANGUAGES

  const codeText = decodeHtml(block.content || '')

  return (
    <div className="rounded-2xl relative font-mono text-[13.5px] leading-[1.55]" style={{ backgroundColor: BG }}>
      {/* header bar */}
      <div className="flex items-center justify-end gap-1.5 px-4 pt-3 pb-1">
        {/* language picker */}
        <div className="relative">
          <button
            className="font-mono text-[11px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: FG, opacity: 0.6 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { if (readOnly) return; setOpenLangPick(v => { if (v) setLangQuery(''); return !v }) }}
            tabIndex={-1}
          >
            {b.language || 'code'}
          </button>
          {openLangPick && !readOnly && (
            <div
              ref={langPickRef}
              className="absolute z-50 top-[calc(100%+4px)] right-0 w-[200px] rounded-lg bg-popover border border-border shadow-md select-none"
            >
              <div className="p-2 pb-1">
                <input
                  autoFocus
                  className="w-full px-2 py-1.5 rounded-md border border-border text-[13px] text-foreground bg-background outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-[2px] focus:ring-primary/20"
                  placeholder="Search language..."
                  value={langQuery}
                  onChange={(e) => setLangQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setOpenLangPick(false); setLangQuery('') }
                    if (e.key === 'Enter' && filteredLangs.length > 0) {
                      onChange({ language: filteredLangs[0] }); setOpenLangPick(false); setLangQuery('')
                    }
                  }}
                />
              </div>
              <div className="px-3 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground tracking-wide">Language</div>
              <div className="max-h-[200px] overflow-y-auto pb-1">
                {filteredLangs.length > 0 ? filteredLangs.map(lang => (
                  <div
                    key={lang}
                    className={`flex items-center mx-1 px-2 py-1.5 rounded text-[13px] font-mono cursor-pointer hover:bg-muted ${lang === b.language ? 'bg-muted font-medium' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange({ language: lang }); setOpenLangPick(false); setLangQuery('') }}
                  >
                    {lang}
                  </div>
                )) : (
                  <div className="px-3 py-2 text-[13px] text-muted-foreground">No results</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* code area */}
      <div className="px-5 pb-5">
        {focused && !readOnly ? (
          <Editable
            className="font-mono whitespace-pre min-h-[1.55em] outline-none"
            style={{ color: FG }}
            value={block.content}
            onChange={(html) => onChange({ content: html })}
            onKeyDown={(e) => {
              if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); return }
              if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); return }
              onKeyDown?.(e)
            }}
            onFocus={() => { setFocused(true); onFocus?.() }}
            onBlur={() => setFocused(false)}
            placeholder="// code"
            plain
            autoFocus={autoFocus}
            blockId={block.id}
            readOnly={false}
          />
        ) : b.language === 'mermaid' ? (
          <div
            className="cursor-text outline-none"
            onClick={() => { if (!readOnly) { setOpenLangPick(false); setFocused(true) } }}
            onFocus={() => { if (!readOnly) { setOpenLangPick(false); setFocused(true) } }}
            tabIndex={readOnly ? undefined : 0}
          >
            {codeText
              ? <MermaidDiagram code={codeText} />
              : <span style={{ opacity: 0.4, color: FG }}>{'// mermaid diagram'}</span>
            }
          </div>
        ) : (
          <Highlight theme={ACTIVE_THEME} code={codeText || ' '} language={b.language as Parameters<typeof Highlight>[0]['language']}>
            {({ tokens, getLineProps, getTokenProps }) => (
              <pre
                className="font-mono whitespace-pre min-h-[1.55em] m-0 p-0 bg-transparent cursor-text outline-none"
                style={{ fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', color: FG }}
                onClick={() => { if (!readOnly) { setOpenLangPick(false); setFocused(true) } }}
                onFocus={() => { if (!readOnly) { setOpenLangPick(false); setFocused(true) } }}
                tabIndex={readOnly ? undefined : 0}
              >
                {codeText
                  ? tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                      </div>
                    ))
                  : <span style={{ opacity: 0.4 }}>{'// code'}</span>
                }
              </pre>
            )}
          </Highlight>
        )}
      </div>
    </div>
  )
}
