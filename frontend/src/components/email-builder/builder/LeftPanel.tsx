import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LayoutPanelLeft, Library } from 'lucide-react'
import { LayoutsTab } from './left-panel/LayoutsTab'
import { LibraryTab } from './left-panel/LibraryTab'

export function LeftPanel() {
  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Elements</p>
      </div>
      <Tabs defaultValue="layouts" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-3 mt-3 mb-0 grid grid-cols-2 h-8">
          <TabsTrigger value="layouts" className="text-xs gap-1.5">
            <LayoutPanelLeft className="size-3" /> Layouts
          </TabsTrigger>
          <TabsTrigger value="library" className="text-xs gap-1.5">
            <Library className="size-3" /> Library
          </TabsTrigger>
        </TabsList>
        <TabsContent value="layouts" className="flex-1 overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <LayoutsTab />
        </TabsContent>
        <TabsContent value="library" className="flex-1 overflow-y-auto mt-0 data-[state=active]:flex data-[state=active]:flex-col">
          <LibraryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
