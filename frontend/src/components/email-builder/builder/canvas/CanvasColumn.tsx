import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { EmailColumn, EmailComponent, EmailTemplate } from '@/types/email'
import { CanvasComponent } from './CanvasComponent'

interface Props {
  column: EmailColumn
  rowId: string
  selectedComponentId: string | null
  editingComponentId: string | null
  onSelectComponent: (id: string) => void
  onUpdateComponent: (rowId: string, colId: string, updated: EmailComponent) => void
  onCopyComponent: (rowId: string, colId: string, compId: string) => void
  onDeleteComponent: (rowId: string, colId: string, compId: string) => void
  onStartEdit: (id: string) => void
  templateStyle: EmailTemplate['templateStyle']
  colSpan?: string
}

export function CanvasColumn({
  column,
  rowId,
  selectedComponentId,
  editingComponentId,
  onSelectComponent,
  onUpdateComponent,
  onCopyComponent,
  onDeleteComponent,
  onStartEdit,
  templateStyle,
  colSpan = 'flex-1',
}: Props) {
  const droppableId = `col::${rowId}::${column.id}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { kind: 'column', rowId, colId: column.id } })

  return (
    <div
      ref={setNodeRef}
      className={`${colSpan} min-w-0 min-h-[40px] flex flex-col gap-1 rounded transition-colors ${isOver ? 'bg-primary/5 ring-1 ring-primary/30' : ''} ${column.components.length === 0 ? 'border border-dashed border-border/60' : ''}`}
    >
      {column.components.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50 p-3">
          Drop component here
        </div>
      )}
      <SortableContext
        items={column.components.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {column.components.map(comp => (
          <CanvasComponent
            key={comp.id}
            component={comp}
            rowId={rowId}
            colId={column.id}
            isSelected={selectedComponentId === comp.id}
            isEditing={editingComponentId === comp.id}
            onSelect={onSelectComponent}
            onStartEdit={onStartEdit}
            onUpdate={updated => onUpdateComponent(rowId, column.id, updated)}
            onCopy={() => onCopyComponent(rowId, column.id, comp.id)}
            onDelete={() => onDeleteComponent(rowId, column.id, comp.id)}
            templateStyle={templateStyle}
          />
        ))}
      </SortableContext>
    </div>
  )
}
