import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Save, Loader2 } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LeftPanel } from './LeftPanel'
import { Canvas } from './Canvas'
import { RightPanel } from './RightPanel'
import type {
  EmailTemplate,
  EmailComponent,
  EmailRow,
  EmailColumn,
  LayoutType,
  ComponentType,
  TableConfig,
  RowStyle,
} from '@/types/email'
import { getPlatformConfig } from '@/services/emailService'

// ─── Helpers (shared with Canvas for creating new rows/components) ────────────

let _seq = 1
const uid = () => `c-${Date.now()}-${_seq++}`

function makeColumns(layout: LayoutType): EmailColumn[] {
  const count =
    layout === 'full' ? 1
    : layout === 'two-col' ? 2
    : layout === 'three-col' ? 3
    : layout === 'left-sidebar' ? 2
    : 3 // table
  return Array.from({ length: count }, () => ({ id: uid(), components: [] }))
}

function makeComponent(type: ComponentType): EmailComponent {
  const defaults: Record<ComponentType, EmailComponent['content']> = {
    text: { html: '<p>Click to edit text…</p>' },
    'hero-image': { imageUrl: '', altText: 'Hero image' },
    image: { imageUrl: '', altText: 'Image' },
    cta: { buttonText: 'Click here' },
    divider: { color: '#e5e7eb', thickness: 1 },
    spacer: { spacerHeight: 24 },
    footer: {},
  }
  return {
    id: uid(),
    type,
    style: {
      paddingTop: type === 'divider' || type === 'spacer' || type === 'footer' ? 0 : 8,
      paddingBottom: type === 'divider' || type === 'spacer' || type === 'footer' ? 0 : 8,
      paddingLeft: 0,
      paddingRight: 0,
      textAlign: 'left',
    },
    content: defaults[type] ?? {},
    config: {},
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  template: EmailTemplate
  saving: boolean
  onTemplateChange: (updated: EmailTemplate) => void
  onSave: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailBuilderLayout({ template, saving, onTemplateChange, onSave }: Props) {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null)
  const [emailBannerUrl, setEmailBannerUrl] = useState('/email-banner.png')
  const editorRef = useRef<{ insertVariable: (v: string) => void } | null>(null)

  useEffect(() => {
    getPlatformConfig()
      .then(cfg => { if (cfg.emailBannerUrl) setEmailBannerUrl(cfg.emailBannerUrl) })
      .catch(() => {})
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // ── Convenience accessors ─────────────────────────────────────────────────

  const rows = template.rows

  const selectedComponent = selectedId
    ? rows.flatMap(r => r.columns).flatMap(c => c.components).find(c => c.id === selectedId) ?? null
    : null

  const selectedRow = selectedRowId ? rows.find(r => r.id === selectedRowId) ?? null : null

  const handleSelectComponent = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) setSelectedRowId(null)
  }, [])

  const handleSelectRow = useCallback((id: string | null) => {
    setSelectedRowId(id)
    if (id) setSelectedId(null)
  }, [])

  const handleStartEdit = useCallback((id: string) => {
    setEditingComponentId(id)
    setSelectedId(id)
    setSelectedRowId(null)
  }, [])

  const handleFinishEdit = useCallback(() => {
    setEditingComponentId(null)
  }, [])

  // ── Mutation helpers ──────────────────────────────────────────────────────

  const handleRowsChange = useCallback((next: EmailRow[]) => {
    onTemplateChange({ ...template, rows: next })
  }, [template, onTemplateChange])

  const handleTemplateStyleChange = useCallback((style: EmailTemplate['templateStyle']) => {
    onTemplateChange({ ...template, templateStyle: style })
  }, [template, onTemplateChange])

  const handleTemplateChange = useCallback((partial: Partial<EmailTemplate>) => {
    onTemplateChange({ ...template, ...partial })
  }, [template, onTemplateChange])

  const patchComponent = useCallback((id: string, patch: Partial<EmailComponent>) => {
    onTemplateChange({
      ...template,
      rows: template.rows.map(row => ({
        ...row,
        columns: row.columns.map(col => ({
          ...col,
          components: col.components.map(c => c.id === id ? { ...c, ...patch } : c),
        })),
      })),
    })
  }, [template, onTemplateChange])

  const handleComponentStyleChange = useCallback((style: EmailComponent['style']) => {
    if (selectedId) patchComponent(selectedId, { style })
  }, [selectedId, patchComponent])

  const handleComponentContentChange = useCallback((content: EmailComponent['content']) => {
    if (selectedId) patchComponent(selectedId, { content })
  }, [selectedId, patchComponent])

  const handleComponentConfigChange = useCallback((config: EmailComponent['config']) => {
    if (selectedId) patchComponent(selectedId, { config })
  }, [selectedId, patchComponent])

  const handleRowStyleChange = useCallback((rowStyle: RowStyle) => {
    if (!selectedRowId) return
    handleRowsChange(rows.map(r => r.id === selectedRowId ? { ...r, rowStyle } : r))
  }, [selectedRowId, rows, handleRowsChange])

  const handleTableConfigChange = useCallback((tableConfig: TableConfig) => {
    if (!selectedRowId) return
    const currentRow = rows.find(r => r.id === selectedRowId)
    if (!currentRow) return
    let columns = currentRow.columns
    if (tableConfig.numCols !== columns.length) {
      if (tableConfig.numCols > columns.length) {
        const added = Array.from({ length: tableConfig.numCols - columns.length }, () => ({ id: uid(), components: [] }))
        columns = [...columns, ...added]
      } else {
        columns = columns.slice(0, tableConfig.numCols)
      }
    }
    handleRowsChange(rows.map(r => r.id === selectedRowId ? { ...r, tableConfig, columns } : r))
  }, [selectedRowId, rows, handleRowsChange])

  const handleColumnWidthsChange = useCallback((columnWidths: string[]) => {
    if (!selectedRowId) return
    handleRowsChange(rows.map(r => r.id === selectedRowId ? { ...r, columnWidths } : r))
  }, [selectedRowId, rows, handleRowsChange])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as Record<string, unknown>
    const overId = String(over.id)

    // Helper: resolve any over.id → the owning row's id
    const resolveRowId = (id: string): string | undefined => {
      if (id.startsWith('col::')) return id.split('::')[1]
      if (id === 'canvas-drop-zone') return undefined
      if (rows.find(r => r.id === id)) return id
      for (const row of rows) {
        for (const col of row.columns) {
          if (col.components.find(c => c.id === id)) return row.id
        }
      }
      return undefined
    }

    // ── 1. Layout from left panel → new row ────────────────────────────────
    if (activeData?.kind === 'layout') {
      const layoutType = activeData.layoutType as LayoutType
      const newRow: EmailRow = { id: uid(), layout: layoutType, columns: makeColumns(layoutType) }

      if (overId === 'canvas-drop-zone' || rows.length === 0) {
        handleRowsChange([...rows, newRow])
        return
      }
      const targetRowId = resolveRowId(overId)
      if (targetRowId) {
        const idx = rows.findIndex(r => r.id === targetRowId)
        const next = [...rows]
        next.splice(idx >= 0 ? idx : rows.length, 0, newRow)
        handleRowsChange(next)
      } else {
        handleRowsChange([...rows, newRow])
      }
      return
    }

    // ── 2. Component from left panel → column ──────────────────────────────
    if (activeData?.kind === 'component') {
      if (!overId.startsWith('col::')) return
      const [, rowId, colId] = overId.split('::')
      const comp = makeComponent(activeData.componentType as ComponentType)
      handleRowsChange(rows.map(row =>
        row.id !== rowId ? row : {
          ...row,
          columns: row.columns.map(col =>
            col.id !== colId ? col : { ...col, components: [...col.components, comp] }
          ),
        }
      ))
      return
    }

    // ── 3. Row reorder ──────────────────────────────────────────────────────
    if (activeData?.kind === 'row') {
      const activeRowId = String(active.id)
      const targetRowId = resolveRowId(overId)
      if (!targetRowId || activeRowId === targetRowId) return
      const from = rows.findIndex(r => r.id === activeRowId)
      const to = rows.findIndex(r => r.id === targetRowId)
      if (from >= 0 && to >= 0) handleRowsChange(arrayMove(rows, from, to))
      return
    }

    // ── 4. Canvas-component reorder / cross-column move ────────────────────
    if (activeData?.kind === 'canvas-component') {
      const activeCompId = String(active.id)

      // Find source location
      let srcRowId = '', srcColId = '', srcIdx = -1
      outer: for (const row of rows) {
        for (const col of row.columns) {
          const i = col.components.findIndex(c => c.id === activeCompId)
          if (i >= 0) { srcRowId = row.id; srcColId = col.id; srcIdx = i; break outer }
        }
      }
      if (!srcRowId || srcIdx < 0) return

      const srcComp = rows.find(r => r.id === srcRowId)!
        .columns.find(c => c.id === srcColId)!
        .components[srcIdx]

      // Dropped on a column droppable (empty or not)
      if (overId.startsWith('col::')) {
        const [, dstRowId, dstColId] = overId.split('::')
        if (srcRowId === dstRowId && srcColId === dstColId) return
        handleRowsChange(rows.map(row => ({
          ...row,
          columns: row.columns.map(col => {
            if (row.id === srcRowId && col.id === srcColId)
              return { ...col, components: col.components.filter((_, i) => i !== srcIdx) }
            if (row.id === dstRowId && col.id === dstColId)
              return { ...col, components: [...col.components, srcComp] }
            return col
          }),
        })))
        return
      }

      // Dropped on another component
      let dstRowId = '', dstColId = '', dstIdx = -1
      outer2: for (const row of rows) {
        for (const col of row.columns) {
          const i = col.components.findIndex(c => c.id === overId)
          if (i >= 0) { dstRowId = row.id; dstColId = col.id; dstIdx = i; break outer2 }
        }
      }
      if (!dstRowId || activeCompId === overId) return

      if (srcRowId === dstRowId && srcColId === dstColId) {
        // Same column — reorder
        handleRowsChange(rows.map(row =>
          row.id !== srcRowId ? row : {
            ...row,
            columns: row.columns.map(col =>
              col.id !== srcColId ? col : {
                ...col, components: arrayMove(col.components, srcIdx, dstIdx),
              }
            ),
          }
        ))
      } else {
        // Cross-column move — remove from source, insert at destination index
        handleRowsChange(rows.map(row => ({
          ...row,
          columns: row.columns.map(col => {
            if (row.id === srcRowId && col.id === srcColId)
              return { ...col, components: col.components.filter((_, i) => i !== srcIdx) }
            if (row.id === dstRowId && col.id === dstColId) {
              const next = [...col.components]
              next.splice(dstIdx, 0, srcComp)
              return { ...col, components: next }
            }
            return col
          }),
        })))
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navigate('/email')}>
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={template.name}
          onChange={e => handleTemplateChange({ name: e.target.value })}
          className="h-8 w-56 font-medium text-sm border-transparent bg-transparent hover:border-border focus:border-border transition-colors"
        />
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => navigate(`/email/${template.id}/preview`)}
        >
          <Eye className="size-3.5" /> Preview
        </Button>
        <Button size="sm" className="h-8 gap-1.5" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </div>

      {/* 3-column builder — DndContext wraps ALL three panels */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 min-h-0">
          <div className="w-[280px] shrink-0 flex flex-col min-h-0">
            <LeftPanel />
          </div>

          <Canvas
            rows={rows}
            templateStyle={template.templateStyle}
            emailBannerUrl={emailBannerUrl}
            selectedComponentId={selectedId}
            selectedRowId={selectedRowId}
            editingComponentId={editingComponentId}
            onSelectComponent={handleSelectComponent}
            onSelectRow={handleSelectRow}
            onRowsChange={handleRowsChange}
            onStartEdit={handleStartEdit}
            onFinishEdit={handleFinishEdit}
            editorRef={editorRef}
          />

          <div className="w-[320px] shrink-0 flex flex-col min-h-0">
            <RightPanel
              template={template}
              selectedComponent={selectedComponent}
              selectedRow={selectedRow}
              onTemplateStyleChange={handleTemplateStyleChange}
              onTemplateChange={handleTemplateChange}
              onComponentStyleChange={handleComponentStyleChange}
              onComponentContentChange={handleComponentContentChange}
              onComponentConfigChange={handleComponentConfigChange}
              onRowStyleChange={handleRowStyleChange}
              onTableConfigChange={handleTableConfigChange}
              onColumnWidthsChange={handleColumnWidthsChange}
            />
          </div>
        </div>

        <DragOverlay>
          {activeId && (
            <div className="rounded-lg border-2 border-primary bg-primary/10 px-4 py-2 text-xs font-medium text-primary shadow-lg pointer-events-none">
              Dragging…
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
