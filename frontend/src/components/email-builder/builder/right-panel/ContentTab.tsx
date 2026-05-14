import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EmailComponent, EmailRow, TableConfig, TableColumnConfig } from '@/types/email'
import { TABLE_DATA_SOURCES } from '@/types/email'

interface Props {
  selectedComponent: EmailComponent | null
  onComponentContentChange: (content: EmailComponent['content']) => void
  selectedRow: EmailRow | null
  onTableConfigChange: (tableConfig: TableConfig) => void
}

export function ContentTab({ selectedComponent, onComponentContentChange, selectedRow, onTableConfigChange }: Props) {
  // Show table content when a table layout row is selected (and no component is selected)
  if (selectedRow && !selectedComponent) {
    if (selectedRow.layout !== 'table') {
      return (
        <div className="p-4 text-center text-xs text-muted-foreground py-8">
          No content properties for this layout type
        </div>
      )
    }

    const tc: TableConfig = selectedRow.tableConfig ?? {
      numCols: selectedRow.columns.length,
      numRows: 3,
      headerEnabled: false,
      headerTexts: [],
      dataSource: '',
    }
    const setTc = (partial: Partial<TableConfig>) => onTableConfigChange({ ...tc, ...partial })

    return (
      <div className="p-4 space-y-4 overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Table Content
        </p>

        {/* Header toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Enable Header Row</Label>
          <Switch
            checked={tc.headerEnabled}
            onCheckedChange={v => setTc({ headerEnabled: v })}
          />
        </div>

        {/* Header text */}
        {tc.headerEnabled && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Header Labels</Label>
            {Array.from({ length: tc.numCols }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">Col {i + 1}</span>
                <Input
                  value={tc.headerTexts?.[i] ?? ''}
                  onChange={e => {
                    const next = [...(tc.headerTexts ?? [])]
                    next[i] = e.target.value
                    setTc({ headerTexts: next })
                  }}
                  className="h-7 text-xs"
                  placeholder={`Column ${i + 1} label`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border" />

        {/* Data source selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Data Source</Label>
          <Select
            value={tc.dataSource || '__none__'}
            onValueChange={v => {
              const key = v === '__none__' ? '' : v
              const source = TABLE_DATA_SOURCES.find(ds => ds.key === key)
              const defaultConfigs: TableColumnConfig[] = Array.from({ length: tc.numCols }, (_, i) => ({
                fieldKey: source?.fields[i]?.key ?? source?.fields[0]?.key ?? '',
                type: 'text' as const,
              }))
              setTc({ dataSource: key, columnConfigs: key ? defaultConfigs : [] })
            }}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Choose a data source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs text-muted-foreground">None</SelectItem>
              {TABLE_DATA_SOURCES.map(ds => (
                <SelectItem key={ds.key} value={ds.key} className="text-xs">{ds.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Data array to populate this table at send time
          </p>
        </div>

        {/* Per-column field configuration */}
        {tc.dataSource && (() => {
          const source = TABLE_DATA_SOURCES.find(ds => ds.key === tc.dataSource)
          if (!source) return null
          return (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Column Fields</Label>
              {Array.from({ length: tc.numCols }).map((_, i) => {
                const cc: TableColumnConfig = tc.columnConfigs?.[i] ?? { fieldKey: source.fields[0]?.key ?? '', type: 'text' }
                const setCol = (partial: Partial<TableColumnConfig>) => {
                  const base = tc.columnConfigs ?? Array.from({ length: tc.numCols }, (__, j) => ({
                    fieldKey: source.fields[j]?.key ?? source.fields[0]?.key ?? '',
                    type: 'text' as const,
                  }))
                  const next = [...base]
                  next[i] = { ...cc, ...partial }
                  setTc({ columnConfigs: next })
                }
                return (
                  <div key={i} className="rounded-md border border-border p-2 space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Col {i + 1}</p>
                    <Select value={cc.fieldKey} onValueChange={v => setCol({ fieldKey: v })}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {source.fields.map(f => (
                          <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={cc.type} onValueChange={v => setCol({ type: v as 'text' | 'link' })}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text" className="text-xs">Text</SelectItem>
                        <SelectItem value="link" className="text-xs">Link</SelectItem>
                      </SelectContent>
                    </Select>
                    {cc.type === 'link' && (
                      <div className="space-y-1">
                        <Input
                          value={cc.linkPattern ?? ''}
                          onChange={e => setCol({ linkPattern: e.target.value })}
                          className="h-7 text-xs font-mono"
                          placeholder={`https://…/{${cc.fieldKey}}`}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Use {'{'+'fieldName}'} tokens from the data item, {'{{'}variable{'}}'} for template vars
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    )
  }

  if (!selectedComponent) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground py-8">
        Select a component on the canvas to edit its content
      </div>
    )
  }

  const comp = selectedComponent
  const setContent = (partial: Partial<EmailComponent['content']>) =>
    onComponentContentChange({ ...comp.content, ...partial })

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Content — {comp.type}
      </p>

      {/* Text/CTA: no editable content field here — editing happens via popover on canvas */}
      {(comp.type === 'text') && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          Double-click the text block on the canvas to open the rich text editor
        </p>
      )}

      {/* Footer */}
      {comp.type === 'footer' && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
          Footer content is configured globally via platform settings (platform name and URL)
        </p>
      )}

      {/* CTA button text */}
      {comp.type === 'cta' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Button Text</Label>
          <Input
            value={comp.content.buttonText ?? ''}
            onChange={e => setContent({ buttonText: e.target.value })}
            className="h-7 text-xs"
            placeholder="Click here"
          />
          <p className="text-[10px] text-muted-foreground">Or double-click the button on the canvas to use the rich text editor</p>
        </div>
      )}

      {/* Image / Hero */}
      {(comp.type === 'image' || comp.type === 'hero-image') && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Image URL</Label>
            <Input
              value={comp.content.imageUrl ?? ''}
              onChange={e => setContent({ imageUrl: e.target.value })}
              className="h-7 text-xs"
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Alt Text</Label>
            <Input
              value={comp.content.altText ?? ''}
              onChange={e => setContent({ altText: e.target.value })}
              className="h-7 text-xs"
              placeholder="Describe the image"
            />
          </div>
        </>
      )}

      {/* Divider */}
      {comp.type === 'divider' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={comp.content.color ?? '#e5e7eb'}
                onChange={e => setContent({ color: e.target.value })}
                className="size-6 cursor-pointer rounded border border-border"
              />
              <Input
                value={comp.content.color ?? '#e5e7eb'}
                onChange={e => setContent({ color: e.target.value })}
                className="h-6 flex-1 text-xs font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Thickness (px)</Label>
            <Input
              type="number"
              value={comp.content.thickness ?? 1}
              onChange={e => setContent({ thickness: Number(e.target.value) })}
              className="h-7 text-xs"
              min={1}
              max={8}
            />
          </div>
        </>
      )}

      {/* Spacer */}
      {comp.type === 'spacer' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Height (px)</Label>
          <Input
            type="number"
            value={comp.content.spacerHeight ?? 16}
            onChange={e => setContent({ spacerHeight: Number(e.target.value) })}
            className="h-7 text-xs"
            min={4}
            max={200}
          />
        </div>
      )}

    </div>
  )
}
