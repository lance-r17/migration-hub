import { TEXT_COLORS, BG_COLORS } from './table-constants'

interface ColorPickerProps {
  current?: { textColor?: string; bgColor?: string }
  onSetTextColor: (v: string) => void
  onSetBgColor: (v: string) => void
}

export function ColorPicker({ current, onSetTextColor, onSetBgColor }: ColorPickerProps) {
  return (
    <div className="w-[200px] p-1.5 rounded-lg bg-popover border border-border shadow-md">
      <div className="px-2 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium">Text color</div>
      <div className="grid grid-cols-5 gap-1 px-1.5 pb-1.5">
        {TEXT_COLORS.map(c => (
          <button
            key={c.value}
            className={`aspect-square rounded border bg-background text-foreground grid place-items-center font-bold text-[13px] hover:border-muted-foreground ${
              (current?.textColor || 'default') === c.value ? 'ring-2 ring-primary border-transparent' : 'border-border'
            }`}
            style={{ color: c.css || undefined }}
            title={c.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSetTextColor(c.value)}
          >A</button>
        ))}
      </div>
      <div className="px-2 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium">Background</div>
      <div className="grid grid-cols-5 gap-1 px-1.5 pb-1.5">
        {BG_COLORS.map(c => (
          <button
            key={c.value}
            className={`aspect-square rounded border grid place-items-center hover:border-muted-foreground ${
              (current?.bgColor || 'default') === c.value ? 'ring-2 ring-primary border-transparent' : 'border-border'
            }`}
            style={{ background: c.css || 'var(--background)' }}
            title={c.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSetBgColor(c.value)}
          >
            {c.value === 'default' && <span className="text-[13px] text-muted-foreground">—</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
