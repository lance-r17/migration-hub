import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EmailComponent, EmailTemplate } from '@/types/email'
import { ComponentToolbar } from './ComponentToolbar'

interface Props {
  component: EmailComponent
  rowId: string
  colId: string
  isSelected: boolean
  isEditing: boolean
  onSelect: (id: string) => void
  onStartEdit: (id: string) => void
  onUpdate: (updated: EmailComponent) => void
  onCopy: () => void
  onDelete: () => void
  templateStyle: EmailTemplate['templateStyle']
}

function renderComponentPreview(comp: EmailComponent, templateStyle: EmailTemplate['templateStyle']) {
  const baseStyle: React.CSSProperties = {
    paddingTop: comp.style.paddingTop ?? 0,
    paddingBottom: comp.style.paddingBottom ?? 0,
    paddingLeft: comp.style.paddingLeft ?? 0,
    paddingRight: comp.style.paddingRight ?? 0,
    textAlign: comp.style.textAlign ?? 'left',
    fontFamily: templateStyle.fontFamily,
    color: templateStyle.textColor,
    fontSize: templateStyle.fontSize,
  }

  switch (comp.type) {
    case 'text':
      return (
        <div
          style={baseStyle}
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: comp.content.html ?? '<p>Click to edit text…</p>' }}
        />
      )

    case 'hero-image':
      return comp.content.imageUrl ? (
        <img
          src={comp.content.imageUrl}
          alt={comp.content.altText ?? ''}
          style={{
            ...baseStyle,
            width: comp.style.width ?? '100%',
            height: comp.style.height ?? 'auto',
            objectFit: 'cover',
            display: 'block',
            borderRadius: comp.style.borderRadius ?? 0,
          }}
        />
      ) : (
        <div
          style={{ ...baseStyle, height: comp.style.height ?? '160px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          className="text-muted-foreground text-xs rounded"
        >
          Hero Image — set URL in Style tab
        </div>
      )

    case 'image':
      return comp.content.imageUrl ? (
        <img
          src={comp.content.imageUrl}
          alt={comp.content.altText ?? ''}
          style={{
            ...baseStyle,
            width: comp.style.width ?? 'auto',
            maxWidth: '100%',
            height: comp.style.height ?? 'auto',
            borderRadius: comp.style.borderRadius ?? 0,
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{ ...baseStyle, height: '80px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          className="text-muted-foreground text-xs rounded"
        >
          Image — set URL in Content tab
        </div>
      )

    case 'cta':
      return (
        <div style={{ ...baseStyle, display: 'flex', justifyContent: comp.style.textAlign === 'right' ? 'flex-end' : comp.style.textAlign === 'center' ? 'center' : 'flex-start' }}>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: comp.style.backgroundColor ?? templateStyle.accentColor,
              color: comp.style.textColor ?? '#ffffff',
              padding: '10px 24px',
              borderRadius: comp.style.borderRadius ?? 6,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            dangerouslySetInnerHTML={{ __html: comp.content.buttonText ?? 'Button' }}
          />
        </div>
      )

    case 'divider':
      return (
        <div style={baseStyle}>
          <hr style={{ border: 'none', borderTop: `${comp.content.thickness ?? 1}px solid ${comp.content.color ?? '#e5e7eb'}` }} />
        </div>
      )

    case 'spacer':
      return <div style={{ height: comp.content.spacerHeight ?? 16 }} />

    default:
      return null
  }
}

export function CanvasComponent({
  component,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onUpdate,
  onCopy,
  onDelete,
  templateStyle,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { kind: 'canvas-component', component },
  })

  const handleDoubleClick = useCallback(() => {
    if (component.type === 'text' || component.type === 'cta') {
      onStartEdit(component.id)
    }
  }, [component.id, component.type, onStartEdit])

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative group/component ${isDragging ? 'opacity-40' : ''}`}
      onClick={e => { e.stopPropagation(); onSelect(component.id) }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Selection ring */}
      <div
        className={`relative rounded transition-all ${
          isSelected || isEditing
            ? 'ring-2 ring-primary ring-offset-1'
            : 'hover:ring-1 hover:ring-primary/30'
        }`}
      >
        <ComponentToolbar
          onCopy={onCopy}
          onDelete={onDelete}
          dragHandleProps={listeners}
        />

        {/* Component preview */}
        <div className="pointer-events-none select-none">
          {renderComponentPreview(component, templateStyle)}
        </div>
      </div>
    </div>
  )
}
