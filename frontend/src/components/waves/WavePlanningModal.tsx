import { X, Kanban } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { WavePlanningBoard } from './WavePlanningBoard'
import type { Project } from '@/types'
import type { Wave } from '@/types/wave'

interface Props {
  open: boolean
  onClose: () => void
  projects: Project[]
  allWaves: Wave[]
  onAssign: (projectIds: string[], waveId: string | undefined) => void
  showCompleted: boolean
  onShowCompletedChange: (val: boolean) => void
}

export function WavePlanningModal({ 
  open, 
  onClose, 
  projects, 
  allWaves, 
  onAssign,
  showCompleted,
  onShowCompletedChange
}: Props) {
  if (!open) return null

  const filteredWaves = allWaves.filter(w => showCompleted || w.status !== 'completed')

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Kanban size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg leading-none">Wave Planning Board</h2>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">Design and organize migration waves with ease.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
            <Switch 
              id="modal-show-completed" 
              checked={showCompleted} 
              onCheckedChange={onShowCompletedChange} 
            />
            <Label htmlFor="modal-show-completed" className="text-sm font-semibold cursor-pointer whitespace-nowrap">
              Show Completed
            </Label>
          </div>
          
          <div className="w-px h-6 bg-border mx-2" />
          
          <button 
            onClick={onClose} 
            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <span className="text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Close</span>
            <X size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 min-h-0 bg-muted/10 relative">
        <div className="absolute inset-0 p-8 overflow-hidden">
          <WavePlanningBoard 
            projects={projects}
            waves={filteredWaves}
            onAssign={onAssign}
          />
        </div>
      </div>
    </div>
  )
}
