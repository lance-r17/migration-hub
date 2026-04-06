import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import type { EmailTemplate, EmailComponent, EmailRow, TableConfig, RowStyle } from '@/types/email'

interface Props {
  templateStyle: EmailTemplate['templateStyle']
  onTemplateStyleChange: (style: EmailTemplate['templateStyle']) => void
  selectedComponent: EmailComponent | null
  onComponentStyleChange: (style: EmailComponent['style']) => void
  selectedRow: EmailRow | null
  onRowStyleChange: (rowStyle: RowStyle) => void
  onTableConfigChange: (tableConfig: TableConfig) => void
  onColumnWidthsChange: (columnWidths: string[]) => void
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="size-6 cursor-pointer rounded border border-border"
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-6 w-20 text-xs font-mono"
        />
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, unit = 'px', min, max }: { label: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(Number(e.target.value))}
          className="h-6 w-16 text-xs"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

const TWO_COL_PRESETS: { label: string; widths: string[] }[] = [
  { label: '50 / 50', widths: ['flex-1', 'flex-1'] },
  { label: '60 / 40', widths: ['60%', '40%'] },
  { label: '70 / 30', widths: ['70%', '30%'] },
  { label: '40 / 60', widths: ['40%', '60%'] },
  { label: '30 / 70', widths: ['30%', '70%'] },
]

const SIDEBAR_PRESETS: { label: string; widths: string[] }[] = [
  { label: '25 / 75', widths: ['25%', 'flex-1'] },
  { label: '30 / 70', widths: ['30%', 'flex-1'] },
  { label: '35 / 65 (default)', widths: ['35%', 'flex-1'] },
  { label: '40 / 60', widths: ['40%', 'flex-1'] },
]

function matchPresetValue(widths: string[] | undefined, presets: { label: string; widths: string[] }[]): string {
  if (!widths) return presets.find(p => p.label.includes('default'))?.label ?? presets[0].label
  const match = presets.find(p => p.widths[0] === widths[0] && p.widths[1] === widths[1])
  return match?.label ?? presets[0].label
}

export function StyleTab({
  templateStyle,
  onTemplateStyleChange,
  selectedComponent,
  onComponentStyleChange,
  selectedRow,
  onRowStyleChange,
  onTableConfigChange,
  onColumnWidthsChange,
}: Props) {
  const ts = templateStyle
  const setTs = (partial: Partial<typeof ts>) => onTemplateStyleChange({ ...ts, ...partial })

  const cs = selectedComponent?.style
  const setCs = (partial: Partial<NonNullable<typeof cs>>) =>
    cs && onComponentStyleChange({ ...cs, ...partial })

  const isAnythingSelected = selectedComponent !== null || selectedRow !== null

  // Default tableConfig values
  const tc = selectedRow?.tableConfig ?? { numCols: selectedRow?.columns.length ?? 3, numRows: 3, headerEnabled: false, headerTexts: [], dataSource: '' }
  const setTc = (partial: Partial<TableConfig>) => onTableConfigChange({ ...tc, ...partial })

  const rowBg = selectedRow?.rowStyle?.backgroundColor ?? ''
  const setRowBg = (backgroundColor: string) => onRowStyleChange({ ...selectedRow?.rowStyle, backgroundColor })

  return (
    <div className="p-4 space-y-5 overflow-y-auto">
      {/* Template Style — hidden when anything is selected */}
      {!isAnythingSelected && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Template</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Font Family</Label>
              <Select value={ts.fontFamily} onValueChange={v => setTs({ fontFamily: v })}>
                <SelectTrigger className="h-6 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Montserrat', 'Inter', 'Arial', 'Georgia', 'Times New Roman'].map(f => (
                    <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberField label="Font Size" value={ts.fontSize} onChange={v => setTs({ fontSize: v })} />
            <ColorField label="Text Color" value={ts.textColor} onChange={v => setTs({ textColor: v })} />
            <ColorField label="Accent Color" value={ts.accentColor} onChange={v => setTs({ accentColor: v })} />
            <ColorField label="Background" value={ts.backgroundColor} onChange={v => setTs({ backgroundColor: v })} />
            <NumberField label="Max Width" value={ts.maxWidth} onChange={v => setTs({ maxWidth: v })} />
            <NumberField label="Padding X" value={ts.paddingX} onChange={v => setTs({ paddingX: v })} />
            <NumberField label="Padding Y" value={ts.paddingY} onChange={v => setTs({ paddingY: v })} />
          </div>
        </div>
      )}

      {/* Row / Layout Style */}
      {selectedRow && !selectedComponent && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Layout</p>
          <div className="space-y-3">
            {/* Background color — all layouts */}
            <ColorField
              label="Background"
              value={rowBg || '#ffffff'}
              onChange={setRowBg}
            />

            {/* Two-col width ratio */}
            {selectedRow.layout === 'two-col' && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Column Widths</Label>
                <Select
                  value={matchPresetValue(selectedRow.columnWidths, TWO_COL_PRESETS)}
                  onValueChange={v => {
                    const preset = TWO_COL_PRESETS.find(p => p.label === v)
                    if (preset) onColumnWidthsChange(preset.widths)
                  }}
                >
                  <SelectTrigger className="h-6 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TWO_COL_PRESETS.map(p => (
                      <SelectItem key={p.label} value={p.label} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Left-sidebar width */}
            {selectedRow.layout === 'left-sidebar' && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Sidebar Width</Label>
                <Select
                  value={matchPresetValue(selectedRow.columnWidths, SIDEBAR_PRESETS)}
                  onValueChange={v => {
                    const preset = SIDEBAR_PRESETS.find(p => p.label === v)
                    if (preset) onColumnWidthsChange(preset.widths)
                  }}
                >
                  <SelectTrigger className="h-6 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIDEBAR_PRESETS.map(p => (
                      <SelectItem key={p.label} value={p.label} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Table dimensions */}
            {selectedRow.layout === 'table' && (
              <>
                <div className="border-t border-border" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Table</p>
                <NumberField
                  label="Columns"
                  value={tc.numCols}
                  onChange={v => setTc({ numCols: Math.max(1, Math.min(6, v)) })}
                  unit=""
                  min={1}
                  max={6}
                />
                <NumberField
                  label="Rows (preview)"
                  value={tc.numRows}
                  onChange={v => setTc({ numRows: Math.max(1, Math.min(10, v)) })}
                  unit=""
                  min={1}
                  max={10}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Component Style */}
      {cs && selectedComponent && (
        <>
          <div className="border-t border-border" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Component — {selectedComponent.type}
            </p>
            <div className="space-y-3">
              {/* Alignment */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Alignment</Label>
                <ToggleGroup
                  type="single"
                  value={cs.textAlign ?? 'left'}
                  onValueChange={v => v && setCs({ textAlign: v as 'left' | 'center' | 'right' })}
                  className="h-6"
                >
                  <ToggleGroupItem value="left" className="size-6 p-0"><AlignLeft className="size-3" /></ToggleGroupItem>
                  <ToggleGroupItem value="center" className="size-6 p-0"><AlignCenter className="size-3" /></ToggleGroupItem>
                  <ToggleGroupItem value="right" className="size-6 p-0"><AlignRight className="size-3" /></ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Padding */}
              <div className="grid grid-cols-2 gap-2">
                {(['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'] as const).map(key => (
                  <div key={key} className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground capitalize">{key.replace('padding', '')}</Label>
                    <Input
                      type="number"
                      value={cs[key] ?? 0}
                      onChange={e => setCs({ [key]: Number(e.target.value) })}
                      className="h-6 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Image-specific */}
              {(selectedComponent.type === 'image' || selectedComponent.type === 'hero-image') && (
                <>
                  <NumberField label="Border Radius" value={cs.borderRadius ?? 0} onChange={v => setCs({ borderRadius: v })} />
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Width</Label>
                    <Input
                      value={cs.width ?? '100%'}
                      onChange={e => setCs({ width: e.target.value })}
                      className="h-6 w-20 text-xs"
                    />
                  </div>
                </>
              )}

              {/* CTA-specific */}
              {selectedComponent.type === 'cta' && (
                <>
                  <ColorField
                    label="Button Color"
                    value={cs.backgroundColor ?? templateStyle.accentColor}
                    onChange={v => setCs({ backgroundColor: v })}
                  />
                  <ColorField
                    label="Button Text"
                    value={cs.textColor ?? '#ffffff'}
                    onChange={v => setCs({ textColor: v })}
                  />
                  <NumberField label="Border Radius" value={cs.borderRadius ?? 6} onChange={v => setCs({ borderRadius: v })} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
