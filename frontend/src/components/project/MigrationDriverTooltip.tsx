import { getMigrationDriverScore, type MigrationDriverLevel } from '@/lib/scoring'
import type { Project } from '@/types'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MigrationDriverTooltipProps {
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

export function MigrationDriverTooltip({ project, children }: MigrationDriverTooltipProps) {
  const result = getMigrationDriverScore(project)

  const matrix: { level: MigrationDriverLevel; tier: string; thirdParty: string; dep: string; external: string; internal: string; apps: string }[] = [
    { level: 'Low', tier: 'Tier 3 / Tier 2', thirdParty: '1 – 2 FTE', dep: '1 – 4', external: '1 – 1000', internal: '1 – 1000', apps: '1' },
    { level: 'Medium', tier: 'Tier 2 + IITA / Tier 1', thirdParty: '3 – 4 FTE', dep: '5 – 10', external: '1001 – 10000', internal: '1001 – 5000', apps: '2 – 5' },
    { level: 'High', tier: 'Tier 1 + IITA / Tier 0', thirdParty: '> 4 FTE', dep: '> 10', external: '> 10000', internal: '> 5000', apps: '> 5' },
  ]

  const tierText = result.applicationTier
    ? `Tier ${result.applicationTier}${result.iitaApplicability ? ' + IITA' : ''}`
    : '—'

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-none bg-popover text-popover-foreground border border-border shadow-lg px-0 py-2"
        sideOffset={4}
        arrowClassName="fill-popover bg-popover"
      >
        <div className="flex flex-col max-w-[640px]">
          <div className="px-3 pb-2 border-b border-border font-semibold text-sm">
            Migration Driver: {result.score ?? 'N/A'}
          </div>
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">Score</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">App Tier / IITA</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">Third-party Effort</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">Dependency</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">External Users</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">Internal Users</th>
                  <th className="text-left px-2 py-1 font-medium whitespace-nowrap">No. of Apps</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => {
                  const tierActive = result.tierLevel === row.level
                  const thirdPartyActive = result.thirdPartyLevel === row.level
                  const depActive = result.dependencyLevel === row.level
                  const externalActive = result.externalUserLevel === row.level
                  const internalActive = result.internalUserLevel === row.level
                  const appsActive = result.appLevel === row.level
                  const hasActive = tierActive || thirdPartyActive || depActive || externalActive || internalActive || appsActive
                  return (
                    <tr key={row.level} className={`border-b border-border/50 ${rowClass(hasActive)}`}>
                      <td className={`px-2 py-1 font-medium ${hasActive ? 'text-primary' : ''}`}>{row.level}</td>
                      <td className={cellClass(tierActive)}>{row.tier}</td>
                      <td className={cellClass(thirdPartyActive)}>{row.thirdParty}</td>
                      <td className={cellClass(depActive)}>{row.dep}</td>
                      <td className={cellClass(externalActive)}>{row.external}</td>
                      <td className={cellClass(internalActive)}>{row.internal}</td>
                      <td className={cellClass(appsActive)}>{row.apps}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 pt-2 text-[10px] text-muted-foreground border-t border-border/50 mt-1 bg-muted/50">
            Raw values: {tierText}, Third-party {result.thirdPartyEffort.toFixed(1)} FTE, Dependencies {result.dependencyCount},
            External {result.externalUserCount.toLocaleString()}, Internal {result.internalUserCount.toLocaleString()}, Apps {result.appCount}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
