import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Smile, Link, Trash2 } from 'lucide-react'
import { NotionEditor } from '../NotionEditor'
import { createBlock } from '../model'
import { getDraggedBlock, finishDrag, cancelDrag } from '../drag-state'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

const EMOJIS = ['💡', '🔥', '⭐', '📌', '📝', '📎', '🔗', '📊', '📁', '🗂️', '⚙️', '🎯', '✅', '❌', '🚀', '📅', '🏷️', '🔖', '📋', '💻']

export function TabsBlock({ block, onChange, readOnly }: BlockRendererProps) {
  const b = block as Extract<Block, { type: 'tabs' }>
  const tabs = b.tabs
  const activeIdx = b.activeTab ?? 0
  const safeIdx = Math.min(Math.max(0, activeIdx), tabs.length - 1)

  const [editingTitle, setEditingTitle] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ idx: number; pos: { left: number; top: number } } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null)
        setShowEmojiPicker(false)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const apply = (patch: Partial<Extract<Block, { type: 'tabs' }>>) => onChange(patch)

  const setActive = (i: number) => {
    if (i === safeIdx) return
    setMenu(null)
    setShowEmojiPicker(false)
    apply({ activeTab: i })
  }

  const updateTabTitle = (i: number, title: string) => {
    apply({
      tabs: tabs.map((t, idx) => idx === i ? { ...t, title: title || `Tab ${idx + 1}` } : t),
    })
  }

  const updateTabIcon = (i: number, icon: string | undefined) => {
    apply({
      tabs: tabs.map((t, idx) => idx === i ? { ...t, icon } : t),
    })
  }

  const updateTabBlocks = (i: number, blocks: Block[]) => {
    apply({
      tabs: tabs.map((t, idx) => idx === i ? { ...t, blocks } : t),
    })
  }

  const addTab = () => {
    const next = [...tabs, { title: `Tab ${tabs.length + 1}`, blocks: [] as Block[] }]
    apply({ tabs: next, activeTab: next.length - 1 })
  }

  const removeTab = (i: number) => {
    if (tabs.length <= 1) return
    const next = tabs.filter((_, idx) => idx !== i)
    apply({ tabs: next, activeTab: Math.min(safeIdx, next.length - 1) })
  }

  const activeTab = tabs[safeIdx]
  const isEmpty = !activeTab?.blocks?.length

  const handleEmptyClick = () => {
    if (readOnly) return
    updateTabBlocks(safeIdx, [createBlock('paragraph')])
  }

  const [dragOverEmpty, setDragOverEmpty] = useState(false)

  const openMenu = (e: React.MouseEvent, i: number) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ idx: i, pos: { left: rect.left, top: rect.bottom + 4 } })
    setShowEmojiPicker(false)
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
      <div className="group/tabs-area flex items-center gap-1 px-3 pt-3 pb-1 overflow-x-auto">
        {tabs.map((tab, i) => {
          const isActive = i === safeIdx
          return (
            <div
              key={`${tab.title}-${i}`}
              className={`group/tab relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] cursor-pointer select-none transition-colors ${
                isActive
                  ? 'bg-muted text-foreground font-medium rounded-full'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={(e) => {
                if (editingTitle === i) return
                if (i === safeIdx) {
                  openMenu(e, i)
                } else {
                  setActive(i)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                openMenu(e, i)
              }}
            >
              {editingTitle === i ? (
                <input
                  autoFocus
                  className="w-[80px] bg-transparent outline-none text-foreground border-b border-primary"
                  value={tab.title}
                  onChange={(e) => updateTabTitle(i, e.target.value)}
                  onBlur={() => setEditingTitle(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingTitle(null)
                    if (e.key === 'Escape') setEditingTitle(null)
                  }}
                />
              ) : (
                <>
                  {tab.icon && <span className="text-base leading-none">{tab.icon}</span>}
                  <span
                    className="truncate max-w-[120px]"
                    onDoubleClick={() => {
                      if (readOnly) return
                      setEditingTitle(i)
                    }}
                  >
                    {tab.title}
                  </span>
                </>
              )}

            </div>
          )
        })}
        {!readOnly && (
          <button
            className="flex-none opacity-0 group-hover/tabs-area:opacity-100 w-7 h-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all ml-1 mb-1 border border-border"
            title="Add tab"
            onClick={addTab}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="px-4 py-4 min-h-[3em]">
        {isEmpty ? (
          readOnly ? (
            <div className="min-h-[1.5em]">&nbsp;</div>
          ) : (
            <div
              className={`rounded-md transition-colors ${dragOverEmpty ? 'bg-muted/60 ring-1 ring-primary/40' : ''}`}
              onDragOver={(e) => {
                if (readOnly) return
                if (getDraggedBlock()) {
                  e.preventDefault()
                  setDragOverEmpty(true)
                }
              }}
              onDragLeave={() => setDragOverEmpty(false)}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragOverEmpty(false)
                const dragged = getDraggedBlock()
                if (dragged && !readOnly) {
                  updateTabBlocks(safeIdx, [dragged])
                  const isFromSameTab = activeTab.blocks.some(b => b.id === dragged.id)
                  if (isFromSameTab) {
                    cancelDrag()
                  } else {
                    finishDrag()
                  }
                }
              }}
            >
              <button
                className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer bg-transparent border-0 p-0"
                onClick={handleEmptyClick}
              >
                Empty tab. Click or drop blocks inside.
              </button>
            </div>
          )
        ) : (
          <NotionEditor
            blocks={activeTab.blocks}
            onBlocksChange={(blocks) => updateTabBlocks(safeIdx, blocks)}
            readOnly={readOnly}
            nested
          />
        )}
      </div>

      {menu && !readOnly && (
        <div
          ref={menuRef}
          className="fixed z-50 w-[200px] p-1 rounded-md bg-popover border border-border shadow-md"
          style={{ left: menu.pos.left, top: menu.pos.top }}
        >
          <div
            className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] cursor-pointer hover:bg-muted"
            onClick={() => { setEditingTitle(menu.idx); setMenu(null); setShowEmojiPicker(false); }}
          >
            <Pencil size={14} className="text-muted-foreground" /> Rename
          </div>
          <div
            className="relative"
            onMouseEnter={() => setShowEmojiPicker(true)}
            onMouseLeave={() => setShowEmojiPicker(false)}
          >
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] cursor-pointer hover:bg-muted">
              <Smile size={14} className="text-muted-foreground" /> Edit icon
            </div>
            {showEmojiPicker && (
              <div className="absolute left-full top-0 ml-1 w-[180px] p-2 rounded-md bg-popover border border-border shadow-md">
                <div className="grid grid-cols-5 gap-1">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      className="w-7 h-7 rounded hover:bg-muted grid place-items-center text-base"
                      onClick={(e) => { e.stopPropagation(); updateTabIcon(menu.idx, emoji); setShowEmojiPicker(false); setMenu(null); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="h-px bg-border my-1" />
                <button
                  className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                  onClick={(e) => { e.stopPropagation(); updateTabIcon(menu.idx, undefined); setShowEmojiPicker(false); setMenu(null); }}
                >
                  Remove icon
                </button>
              </div>
            )}
          </div>
          <div
            className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] cursor-pointer hover:bg-muted"
            onClick={() => {
              navigator.clipboard.writeText(tabs[menu.idx].title)
              setMenu(null)
              setShowEmojiPicker(false)
            }}
          >
            <Link size={14} className="text-muted-foreground" /> Copy link
          </div>
          <div className="h-px bg-border mx-1.5 my-1" />
          <div
            className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] cursor-pointer hover:bg-muted text-destructive"
            onClick={() => { removeTab(menu.idx); setMenu(null); setShowEmojiPicker(false); }}
          >
            <Trash2 size={14} className="text-destructive" /> Delete
          </div>
        </div>
      )}
    </div>
  )
}
