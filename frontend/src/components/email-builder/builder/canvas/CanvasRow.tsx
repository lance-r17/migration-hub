import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MutableRefObject } from 'react'
import type { EmailRow, EmailComponent, EmailTemplate } from '@/types/email'
import { LAYOUT_LABELS, TABLE_DATA_SOURCES } from '@/types/email'
import { CanvasColumn } from './CanvasColumn'
import { RichTextEditor } from './RichTextEditor'

interface Props {
  row: EmailRow
  isSelected: boolean
  selectedComponentId: string | null
  editingComponentId: string | null
  onSelectComponent: (id: string) => void
  onSelectRow: (id: string | null) => void
  onUpdateComponent: (rowId: string, colId: string, updated: EmailComponent) => void
  onCopyComponent: (rowId: string, colId: string, compId: string) => void
  onDeleteComponent: (rowId: string, colId: string, compId: string) => void
  onDeleteRow: (rowId: string) => void
  onStartEdit: (id: string) => void
  onFinishEdit: () => void
  templateStyle: EmailTemplate['templateStyle']
  editorRef: MutableRefObject<{ insertVariable: (v: string) => void } | null>
}

function getColumnLayout(row: EmailRow): { colSpan: string }[] {
  if (row.columnWidths && row.columnWidths.length === row.columns.length) {
    return row.columnWidths.map(w => ({ colSpan: w === 'flex-1' ? 'flex-1' : `w-[${w}]` }))
  }
  switch (row.layout) {
    case 'full': return [{ colSpan: 'flex-1' }]
    case 'two-col': return [{ colSpan: 'flex-1' }, { colSpan: 'flex-1' }]
    case 'three-col': return [{ colSpan: 'flex-1' }, { colSpan: 'flex-1' }, { colSpan: 'flex-1' }]
    case 'left-sidebar': return [{ colSpan: 'w-[35%]' }, { colSpan: 'flex-1' }]
    case 'table': return row.columns.map(() => ({ colSpan: 'flex-1' }))
    default: return [{ colSpan: 'flex-1' }]
  }
}

export function CanvasRow({
  row,
  isSelected,
  selectedComponentId,
  editingComponentId,
  onSelectComponent,
  onSelectRow,
  onUpdateComponent,
  onCopyComponent,
  onDeleteComponent,
  onDeleteRow,
  onStartEdit,
  onFinishEdit,
  templateStyle,
  editorRef,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    data: { kind: 'row', rowId: row.id },
  })

  const columnLayouts = getColumnLayout(row)

  // Find if any component in this row is being edited
  let editingComponent: EmailComponent | null = null
  let editingColId = ''
  if (editingComponentId) {
    for (const col of row.columns) {
      const found = col.components.find(c => c.id === editingComponentId)
      if (found) { editingComponent = found; editingColId = col.id; break }
    }
  }
  const isEditingInRow = editingComponent !== null

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: row.rowStyle?.backgroundColor,
      }}
      onClick={e => { e.stopPropagation(); onSelectRow(row.id) }}
      className={`group/row relative rounded-lg border transition-colors ${
        isDragging ? 'opacity-40 ring-2 ring-primary' :
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-border'
      }`}
    >
      {/* Selection label */}
      {isSelected && (
        <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-t-sm bg-primary text-primary-foreground text-[10px] font-medium leading-none">
          {LAYOUT_LABELS[row.layout]}
        </div>
      )}

      {/* Row controls */}
      <div className="absolute -left-7 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <div
          {...listeners}
          {...attributes}
          className="flex size-5 items-center justify-center rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <GripVertical className="size-3" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-destructive/60 hover:text-destructive"
          onClick={() => onDeleteRow(row.id)}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Table header row */}
      {row.layout === 'table' && row.tableConfig?.headerEnabled && (row.tableConfig.headerTexts?.length ?? 0) > 0 && (
        <div className="flex gap-2 px-2 pt-2">
          {row.columns.map((_, i) => (
            <div
              key={i}
              className="flex-1 px-2 py-1 text-xs font-semibold bg-muted rounded text-muted-foreground border border-dashed border-border truncate"
            >
              {row.tableConfig!.headerTexts[i] || `Column ${i + 1}`}
            </div>
          ))}
        </div>
      )}

      {/* Table data stub rows */}
      {row.layout === 'table' && (() => {
        const tc = row.tableConfig
        if (!tc) return null
        const source = TABLE_DATA_SOURCES.find(ds => ds.key === tc.dataSource)
        const numPreviewRows = Math.min(tc.numRows || 3, 3)
        if (!source) {
          return (
            <div className="flex gap-2 px-2 py-1">
              {row.columns.map((_, i) => (
                <div key={i} className="flex-1 px-2 py-0.5 text-[10px] text-muted-foreground/40 italic">
                  {i === 0 ? 'Configure data source →' : ''}
                </div>
              ))}
            </div>
          )
        }
        return (
          <div className="space-y-0 px-2 pb-1">
            {Array.from({ length: numPreviewRows }).map((_, rowIdx) => (
              <div key={rowIdx} className={`flex gap-2 ${rowIdx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                {row.columns.map((_, colIdx) => {
                  const cc = tc.columnConfigs?.[colIdx]
                  const field = cc ? source.fields.find(f => f.key === cc.fieldKey) : source.fields[colIdx]
                  const isLink = cc?.type === 'link'
                  return (
                    <div
                      key={colIdx}
                      className={`flex-1 px-2 py-0.5 text-[10px] italic truncate opacity-60 ${
                        isLink ? 'text-blue-500 underline' : 'text-muted-foreground'
                      }`}
                    >
                      {field?.example ?? '—'}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })()}

      {/* Columns + full-width editing overlay */}
      <div className="relative">
        <div className={`flex gap-2 p-2 transition-opacity ${isEditingInRow ? 'opacity-30 pointer-events-none select-none' : ''}`}>
          {row.columns.map((col, idx) => (
            <CanvasColumn
              key={col.id}
              column={col}
              rowId={row.id}
              selectedComponentId={selectedComponentId}
              editingComponentId={editingComponentId}
              onSelectComponent={onSelectComponent}
              onUpdateComponent={onUpdateComponent}
              onCopyComponent={onCopyComponent}
              onDeleteComponent={onDeleteComponent}
              onStartEdit={onStartEdit}
              templateStyle={templateStyle}
              colSpan={columnLayouts[idx]?.colSpan ?? 'flex-1'}
            />
          ))}
        </div>

        {/* Full-width editor overlay */}
        {isEditingInRow && editingComponent && (
          <div className="absolute -inset-px z-40" onClick={e => e.stopPropagation()}>
            <RichTextEditor
              html={editingComponent.type === 'cta' ? (editingComponent.content.buttonText ?? '') : (editingComponent.content.html ?? '')}
              onChange={html => {
                const patch = editingComponent!.type === 'cta'
                  ? { ...editingComponent!.content, buttonText: html }
                  : { ...editingComponent!.content, html }
                onUpdateComponent(row.id, editingColId, { ...editingComponent!, content: patch })
              }}
              onClose={onFinishEdit}
              editorRef={editorRef}
            />
          </div>
        )}
      </div>
    </div>
  )
}
