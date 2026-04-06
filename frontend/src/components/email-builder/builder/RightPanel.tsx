import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Paintbrush, FileText, Settings2 } from 'lucide-react'
import { StyleTab } from './right-panel/StyleTab'
import { ContentTab } from './right-panel/ContentTab'
import { ConfigTab } from './right-panel/ConfigTab'
import type { EmailTemplate, EmailComponent, EmailRow, TableConfig, RowStyle } from '@/types/email'
import { LAYOUT_LABELS } from '@/types/email'

interface Props {
  template: EmailTemplate
  selectedComponent: EmailComponent | null
  selectedRow: EmailRow | null
  onTemplateStyleChange: (style: EmailTemplate['templateStyle']) => void
  onTemplateChange: (partial: Partial<EmailTemplate>) => void
  onComponentStyleChange: (style: EmailComponent['style']) => void
  onComponentContentChange: (content: EmailComponent['content']) => void
  onComponentConfigChange: (config: EmailComponent['config']) => void
  onRowStyleChange: (rowStyle: RowStyle) => void
  onTableConfigChange: (tableConfig: TableConfig) => void
  onColumnWidthsChange: (columnWidths: string[]) => void
}

export function RightPanel({
  template,
  selectedComponent,
  selectedRow,
  onTemplateStyleChange,
  onTemplateChange,
  onComponentStyleChange,
  onComponentContentChange,
  onComponentConfigChange,
  onRowStyleChange,
  onTableConfigChange,
  onColumnWidthsChange,
}: Props) {
  const panelTitle = selectedRow && !selectedComponent
    ? `Layout — ${LAYOUT_LABELS[selectedRow.layout]}`
    : 'Properties'
  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{panelTitle}</p>
      </div>
      <Tabs defaultValue="style" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-3 mt-3 mb-0 grid grid-cols-3 h-8">
          <TabsTrigger value="style" className="text-xs gap-1">
            <Paintbrush className="size-3" /> Style
          </TabsTrigger>
          <TabsTrigger value="content" className="text-xs gap-1">
            <FileText className="size-3" /> Content
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs gap-1">
            <Settings2 className="size-3" /> Config
          </TabsTrigger>
        </TabsList>
        <TabsContent value="style" className="flex-1 overflow-y-auto mt-0">
          <StyleTab
            templateStyle={template.templateStyle}
            onTemplateStyleChange={onTemplateStyleChange}
            selectedComponent={selectedComponent}
            onComponentStyleChange={onComponentStyleChange}
            selectedRow={selectedRow}
            onRowStyleChange={onRowStyleChange}
            onTableConfigChange={onTableConfigChange}
            onColumnWidthsChange={onColumnWidthsChange}
          />
        </TabsContent>
        <TabsContent value="content" className="flex-1 overflow-y-auto mt-0">
          <ContentTab
            selectedComponent={selectedComponent}
            onComponentContentChange={onComponentContentChange}
            selectedRow={selectedRow}
            onTableConfigChange={onTableConfigChange}
          />
        </TabsContent>
        <TabsContent value="config" className="flex-1 overflow-y-auto mt-0">
          <ConfigTab
            template={template}
            onTemplateChange={onTemplateChange}
            selectedComponent={selectedComponent}
            onComponentConfigChange={onComponentConfigChange}
            selectedRow={selectedRow}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
