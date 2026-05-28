import { useState } from 'react'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

export function BookmarkBlock({ block, onChange, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'bookmark' }>
  const [editing, setEditing] = useState(!b.url)
  const [url, setUrl] = useState(b.url || '')

  const apply = () => {
    const u = url.trim()
    if (!u) { setEditing(false); return }
    try {
      const parsed = new URL(u.match(/^https?:/) ? u : `https://${u}`)
      const host = parsed.hostname.replace(/^www\./, '')
      onChange({
        url: parsed.toString(),
        title: b.title || host,
        desc: b.desc || `Saved bookmark · ${host}`,
      })
    } catch {
      onChange({ url: u, title: u })
    }
    setEditing(false)
  }

  if (editing && !readOnly) {
    return (
      <div className="relative flex gap-1.5 p-2 rounded-md border border-border bg-background">
        <input
          autoFocus
          value={url}
          placeholder="Paste a link to bookmark…"
          className="flex-1 min-w-0 text-[13.5px] border border-border bg-background text-foreground rounded px-2.5 py-1.5 outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') setEditing(false) }}
        />
        <button
          className="bg-primary text-primary-foreground px-3 h-[30px] rounded text-[13px] font-medium hover:bg-primary/90"
          onClick={apply}
        >Embed</button>
      </div>
    )
  }

  let host = 'link'
  try { host = new URL(b.url).hostname.replace(/^www\./, '') } catch { /* noop */ }

  return (
    <div
      className="flex gap-3 border border-border rounded-md p-3 bg-background cursor-pointer hover:bg-muted transition-colors"
      onClick={() => !readOnly && setEditing(true)}
    >
      <div className="w-7 h-7 flex-none rounded grid place-items-center text-white text-[14px] font-bold bg-gradient-to-br from-primary to-primary/70">
        {host[0]?.toUpperCase() || 'L'}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{b.title || host}</div>
        <div className="text-[12.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{b.desc || 'Saved bookmark'}</div>
        <div className="text-xs text-muted-foreground font-mono">{b.url}</div>
      </div>
    </div>
  )
}
