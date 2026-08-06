import { getInfraFootprintScore, type InfraFootprintLevel, formatTb } from '@/lib/scoring'
import type { Project } from '@/types'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface InfraFootprintTooltipProps {
  project: Project
  children: React.ReactNode
}

function cellClass(isActive: boolean): string {
  return isActive
    ? 'bg-primary/10 text-primary font-semibold px-2 py-1'
    : 'text-muted-foreground px-2 py-1'
}

function rowClass(hasActive: boolean): string {
  return hasActive ? 'border-l-2 border-l-primary' : ''
}

export function InfraFootprintTooltip({ project, children }: InfraFootprintTooltipProps) {
  const result = getInfraFootprintScore(project)

  const matrix: { level: InfraFootprintLevel; ecs: string; data: string; maxcompute: string }[] = [
    { level: 'Lightweight', ecs: '1 – 10', data: '< 1 TB', maxcompute: '0' },
    { level: 'Mid-tier', ecs: '11 – 20', data: '1 – 10 TB', maxcompute: '1 – 20' },
    { level: 'Large', ecs: '21 – 30', data: '10 – 100 TB', maxcompute: '21 – 50' },
    { level: 'Extended', ecs: '> 30', data: '> 100 TB', maxcompute: '> 50' },
  ]

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-none bg-popover text-popover-foreground border border-border shadow-lg px-0 py-2"
        sideOffset={4}
        arrowClassName="fill-popover bg-popover"
      >
        <div className="flex flex-col max-w-[520px]">
          <div className="px-3 pb-2 border-b border-border font-semibold text-sm">
            Infra Footprint: {result.score ?? 'N/A'}
          </div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">Score</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">No. of ECS</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">Data Volume (DB / OSS)</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">No. of MaxCompute</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => {
                  const ecsActive = result.ecsLevel === row.level
                  const dataActive = result.dataVolumeLevel === row.level
                  const maxcomputeActive = result.maxcomputeLevel === row.level
                  const hasActive = ecsActive || dataActive || maxcomputeActive
                  return (
                    <tr key={row.level} className={`border-b border-border/50 ${rowClass(hasActive)}`}>
                      <td className={`px-2 py-1 font-medium ${hasActive ? 'text-primary' : ''}`}>{row.level}</td>
                      <td className={cellClass(ecsActive)}>{row.ecs}</td>
                      <td className={cellClass(dataActive)}>{row.data}</td>
                      <td className={cellClass(maxcomputeActive)}>{row.maxcompute}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 pt-2 text-[10px] text-muted-foreground border-t border-border/50 mt-1 bg-muted/50">
            Raw values: ECS {result.ecsCount}, Data {formatTb(result.dataVolumeTb)}, MaxCompute {result.maxcomputeCount}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
