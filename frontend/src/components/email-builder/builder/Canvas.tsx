import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { MutableRefObject } from 'react'
import type { EmailTemplate, EmailRow, EmailComponent } from '@/types/email'
import { CanvasRow } from './canvas/CanvasRow'

// ─── Helpers (used by CanvasRow/CanvasColumn mutation callbacks) ──────────────

let _seq = 1
const uid = () => `cv-${Date.now()}-${_seq++}`

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  rows: EmailRow[]
  templateStyle: EmailTemplate['templateStyle']
  emailBannerUrl: string
  selectedComponentId: string | null
  selectedRowId: string | null
  editingComponentId: string | null
  onSelectComponent: (id: string | null) => void
  onSelectRow: (id: string | null) => void
  onRowsChange: (rows: EmailRow[]) => void
  onStartEdit: (id: string) => void
  onFinishEdit: () => void
  editorRef: MutableRefObject<{ insertVariable: (v: string) => void } | null>
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas({ rows, templateStyle, emailBannerUrl, selectedComponentId, selectedRowId, editingComponentId, onSelectComponent, onSelectRow, onRowsChange, onStartEdit, onFinishEdit, editorRef }: Props) {
  // Canvas-level droppable — catches layout drops on the empty canvas
  const { setNodeRef: setCanvasRef, isOver: isCanvasOver } = useDroppable({
    id: 'canvas-drop-zone',
    data: { kind: 'canvas' },
  })

  // ── Mutation helpers (for existing canvas items) ───────────────────────────

  const updateComponent = (rowId: string, colId: string, updated: EmailComponent) => {
    onRowsChange(rows.map(row =>
      row.id !== rowId ? row : {
        ...row,
        columns: row.columns.map(col =>
          col.id !== colId ? col : {
            ...col,
            components: col.components.map(c => c.id === updated.id ? updated : c),
          }
        ),
      }
    ))
  }

  const copyComponent = (rowId: string, colId: string, compId: string) => {
    onRowsChange(rows.map(row =>
      row.id !== rowId ? row : {
        ...row,
        columns: row.columns.map(col => {
          if (col.id !== colId) return col
          const idx = col.components.findIndex(c => c.id === compId)
          if (idx < 0) return col
          const clone = { ...col.components[idx], id: uid() }
          const next = [...col.components]
          next.splice(idx + 1, 0, clone)
          return { ...col, components: next }
        }),
      }
    ))
  }

  const deleteComponent = (rowId: string, colId: string, compId: string) => {
    onRowsChange(rows.map(row =>
      row.id !== rowId ? row : {
        ...row,
        columns: row.columns.map(col =>
          col.id !== colId ? col : {
            ...col,
            components: col.components.filter(c => c.id !== compId),
          }
        ),
      }
    ))
    if (selectedComponentId === compId) onSelectComponent(null)
  }

  const deleteRow = (rowId: string) => {
    onRowsChange(rows.filter(r => r.id !== rowId))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex-1 overflow-y-auto p-8 bg-muted/30"
      onClick={() => { onSelectComponent(null); onSelectRow(null) }}
    >
      {/* Email "paper" */}
      <div
        className="mx-auto shadow-lg rounded-sm overflow-hidden"
        style={{
          maxWidth: templateStyle.maxWidth,
          backgroundColor: templateStyle.backgroundColor,
          fontFamily: templateStyle.fontFamily,
          fontSize: templateStyle.fontSize,
          color: templateStyle.textColor,
        }}
      >
        {/* Fixed branding banner — not editable, not part of rows */}
        <img
          src={emailBannerUrl}
          alt="Migration Engine"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        {/* Rows content with padding */}
        <div
          style={{
            paddingLeft: templateStyle.paddingX,
            paddingRight: templateStyle.paddingX,
            paddingTop: templateStyle.paddingY,
            paddingBottom: templateStyle.paddingY,
          }}
        >
          <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
            {rows.map(row => (
              <CanvasRow
                key={row.id}
                row={row}
                isSelected={selectedRowId === row.id}
                selectedComponentId={selectedComponentId}
                editingComponentId={editingComponentId}
                onSelectComponent={onSelectComponent}
                onSelectRow={onSelectRow}
                onUpdateComponent={updateComponent}
                onCopyComponent={copyComponent}
                onDeleteComponent={deleteComponent}
                onDeleteRow={deleteRow}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                templateStyle={templateStyle}
                editorRef={editorRef}
              />
            ))}
          </SortableContext>

          {/* Empty state — also acts as the droppable target for the first layout drop */}
          {rows.length === 0 && (
            <div
              ref={setCanvasRef}
              className={`flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border-2 border-dashed rounded-lg transition-colors ${
                isCanvasOver ? 'border-primary/60 bg-primary/5 text-primary' : 'border-border/40'
              }`}
            >
              <p className="text-sm font-medium">Drag a layout here to start building</p>
              <p className="text-xs opacity-60">Choose a row layout from the left panel</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
