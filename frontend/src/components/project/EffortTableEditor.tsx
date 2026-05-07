import { useMemo } from 'react'
import { Plus, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { EffortTable, EffortTask } from '@/types'

export const EFFORT_TYPE_OPTIONS = [
  { key: 'app_specific', label: 'App specific migration effort' },
  { key: 'third_party_license', label: 'Third party license' },
  { key: 'third_party_services', label: 'Third party services' },
  { key: 'dependency', label: 'Dependency effort' },
  { key: 'new_cloud_consumption', label: 'New cloud consumption outside waiver period' },
  { key: 'miscellaneous', label: 'Miscellaneous' },
] as const

export function getEffortTypeLabel(key: string): string {
  const found = EFFORT_TYPE_OPTIONS.find((o) => o.key === key)
  if (found) return found.label
  // Fallback for legacy data stored with the full label string
  const legacy = EFFORT_TYPE_OPTIONS.find((o) => o.label === key)
  if (legacy) return legacy.label
  return key
}

function createEmptyTable(softwareOrigin?: string): EffortTable {
  const defaultThirdParty = softwareOrigin === '3rd party' ? true : false
  return {
    tasks: EFFORT_TYPE_OPTIONS.map(({ key }) => ({ effortType: key, thirdParty: defaultThirdParty })),
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function calcTaskCost(task: EffortTask): number {
  return (task.effort ?? 0) * (task.effortTime ?? 0) * (task.rate ?? 0)
}

interface EffortTableEditorProps {
  tables: EffortTable[]
  tableMode: 'single' | 'multiple'
  projectBaId?: string
  softwareOrigin?: string
  onChange: (tables: EffortTable[], tableMode: 'single' | 'multiple') => void
  disabled?: boolean
  className?: string
}

function TableTotals({ tasks }: { tasks: EffortTask[] }) {
  const totalCost = tasks.reduce((sum, t) => sum + calcTaskCost(t), 0)

  return (
    <tr className="bg-muted/50 font-semibold">
      <td className="px-3 py-1 text-xs border-t">Total</td>
      <td className="px-3 py-1 text-xs border-t text-center">—</td>
      <td className="px-3 py-1 text-xs border-t text-center">—</td>
      <td className="px-3 py-1 text-xs border-t text-center">—</td>
      <td className="px-3 py-1 text-xs border-t text-right font-bold text-primary">{formatCurrency(totalCost)}</td>
      <td className="px-3 py-1 text-xs border-t" />
      <td className="px-3 py-1 text-xs border-t" />
    </tr>
  )
}

function SingleTableRow({
  task,
  onUpdate,
  disabled,
}: {
  task: EffortTask
  onUpdate: (patch: Partial<EffortTask>) => void
  disabled?: boolean
}) {
  const cost = calcTaskCost(task)

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-1 text-xs border-t font-medium text-foreground whitespace-nowrap">
        {getEffortTypeLabel(task.effortType)}
      </td>
      <td className="px-2 py-1 border-t">
        <Input
          type="number"
          min={0}
          step="0.1"
          value={task.effort ?? ''}
          onChange={(e) => onUpdate({ effort: e.target.value === '' ? undefined : Number(e.target.value) })}
          disabled={disabled}
          className="h-7 text-xs text-center px-1"
          placeholder="0"
        />
      </td>
      <td className="px-2 py-1 border-t">
        <Input
          type="number"
          min={0}
          step="0.1"
          value={task.effortTime ?? ''}
          onChange={(e) => onUpdate({ effortTime: e.target.value === '' ? undefined : Number(e.target.value) })}
          disabled={disabled}
          className="h-7 text-xs text-center px-1"
          placeholder="0"
        />
      </td>
      <td className="px-2 py-1 border-t">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={task.rate ?? ''}
          onChange={(e) => onUpdate({ rate: e.target.value === '' ? undefined : Number(e.target.value) })}
          disabled={disabled}
          className="h-7 text-xs text-right px-2"
          placeholder="0"
        />
      </td>
      <td className="px-3 py-1 border-t text-xs text-right text-muted-foreground">
        {cost > 0 ? formatCurrency(cost) : '—'}
      </td>
      <td className="px-2 py-1 border-t">
        <ToggleGroup
          type="single"
          value={task.thirdParty === true ? 'yes' : task.thirdParty === false ? 'no' : undefined}
          onValueChange={(v) => onUpdate({ thirdParty: v === 'yes' ? true : v === 'no' ? false : undefined })}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="justify-center"
        >
          <ToggleGroupItem value="yes" className="text-[11px] h-6 px-1.5">Yes</ToggleGroupItem>
          <ToggleGroupItem value="no" className="text-[11px] h-6 px-1.5">No</ToggleGroupItem>
        </ToggleGroup>
      </td>
      <td className="px-2 py-1 border-t">
        <Input
          value={task.remarks ?? ''}
          onChange={(e) => onUpdate({ remarks: e.target.value })}
          disabled={disabled}
          className="h-7 text-xs px-2"
          placeholder="Optional"
        />
      </td>
    </tr>
  )
}

function EffortTableCard({
  table,
  tableIndex,
  onTableChange,
  onRemove,
  showRemove,
  projectBaId,
  disabled,
}: {
  table: EffortTable
  tableIndex: number
  onTableChange: (table: EffortTable) => void
  onRemove?: () => void
  showRemove: boolean
  projectBaId?: string
  disabled?: boolean
}) {
  const isLocked = tableIndex === 0 && projectBaId !== undefined && table.baId === projectBaId

  const updateTask = (taskIndex: number, patch: Partial<EffortTask>) => {
    const nextTasks = table.tasks.map((t, i) => (i === taskIndex ? { ...t, ...patch } : t))
    onTableChange({ ...table, tasks: nextTasks })
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            BA ID
          </span>
          <Input
            value={table.baId ?? ''}
            onChange={(e) => onTableChange({ ...table, baId: e.target.value })}
            disabled={disabled || isLocked}
            className={cn('h-7 text-xs w-48', isLocked && 'bg-muted/50')}
            placeholder="e.g. BA-12345"
          />
          {isLocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                  <Lock size={12} />
                  from project
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>This BA ID is inherited from the project and cannot be changed.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {showRemove && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
          >
            <Trash2 size={12} className="mr-1" />
            Remove
          </Button>
        )}
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30 text-[11px] text-muted-foreground uppercase tracking-wide">
            <th className="px-3 py-1.5 text-left font-medium">Effort Type</th>
            <th className="px-3 py-1.5 text-center font-medium w-20">Effort Unit (FTE)</th>
            <th className="px-3 py-1.5 text-center font-medium w-20">Effort Time (Month)</th>
            <th className="px-3 py-1.5 text-center font-medium w-28">Rate (Monthly Cost USD)</th>
            <th className="px-3 py-1.5 text-right font-medium w-24">Cost (USD)</th>
            <th className="px-3 py-1.5 text-center font-medium w-20">Third party?</th>
            <th className="px-3 py-1.5 text-left font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {table.tasks.map((task, i) => (
            <SingleTableRow
              key={i}
              task={task}
              onUpdate={(patch) => updateTask(i, patch)}
              disabled={disabled}
            />
          ))}
          <TableTotals tasks={table.tasks} />
        </tbody>
      </table>
    </div>
  )
}

export function EffortTableEditor({
  tables,
  tableMode,
  projectBaId,
  softwareOrigin,
  onChange,
  disabled,
  className,
}: EffortTableEditorProps) {
  const normalizedTables = useMemo(() => {
    if (tables.length === 0) {
      return [{ ...createEmptyTable(softwareOrigin), baId: projectBaId }]
    }
    return tables
  }, [tables, projectBaId, softwareOrigin])

  const grandTotal = useMemo(
    () => normalizedTables.reduce((sum, t) => sum + t.tasks.reduce((s, task) => s + calcTaskCost(task), 0), 0),
    [normalizedTables]
  )

  const handleModeChange = (mode: 'single' | 'multiple') => {
    if (mode === 'single') {
      const first = normalizedTables[0] ?? createEmptyTable(softwareOrigin)
      onChange([{ ...first, baId: first.baId || projectBaId }], mode)
    } else {
      onChange(normalizedTables, mode)
    }
  }

  const handleTableChange = (index: number, table: EffortTable) => {
    const next = [...normalizedTables]
    next[index] = table
    onChange(next, tableMode)
  }

  const handleAddTable = () => {
    onChange([...normalizedTables, createEmptyTable(softwareOrigin)], tableMode)
  }

  const handleRemoveTable = (index: number) => {
    const next = normalizedTables.filter((_, i) => i !== index)
    onChange(next, tableMode)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-3">
        <ToggleGroup
          type="single"
          value={tableMode}
          onValueChange={(v) => v && handleModeChange(v as 'single' | 'multiple')}
          disabled={disabled}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="single" className="text-xs">Single BA</ToggleGroupItem>
          <ToggleGroupItem value="multiple" className="text-xs">Multiple BAs</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Tables */}
      <div className="space-y-3">
        {normalizedTables.map((table, index) => (
          <EffortTableCard
            key={index}
            table={table}
            tableIndex={index}
            onTableChange={(t) => handleTableChange(index, t)}
            onRemove={tableMode === 'multiple' ? () => handleRemoveTable(index) : undefined}
            showRemove={
              tableMode === 'multiple' &&
              normalizedTables.length > 1 &&
              !(index === 0 && projectBaId && table.baId === projectBaId)
            }
            projectBaId={projectBaId}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Add Table button (multiple mode) */}
      {tableMode === 'multiple' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddTable}
          disabled={disabled}
          className="w-full"
        >
          <Plus size={14} className="mr-1.5" />
          Add Table
        </Button>
      )}

      {/* Grand Total */}
      {tableMode === 'multiple' && normalizedTables.length > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg border">
          <span className="text-xs font-semibold">Grand Total Cost</span>
          <span className="text-xs font-bold text-primary">{formatCurrency(grandTotal)}</span>
        </div>
      )}
    </div>
  )
}
