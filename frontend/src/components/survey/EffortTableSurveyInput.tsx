import { EffortTableEditor } from '@/components/project/EffortTableEditor'
import type { EffortTable } from '@/types'

interface EffortTableSurveyInputProps {
  value: { tables?: EffortTable[]; tableMode?: 'single' | 'multiple' } | undefined
  onChange: (value: { tables: EffortTable[]; tableMode: 'single' | 'multiple' }) => void
  projectBaId?: string
  softwareOrigin?: string
  disabled?: boolean
}

export function EffortTableSurveyInput({
  value,
  onChange,
  projectBaId,
  softwareOrigin,
  disabled,
}: EffortTableSurveyInputProps) {
  const tables = value?.tables ?? []
  const tableMode = value?.tableMode ?? 'single'

  const handleChange = (nextTables: EffortTable[], nextMode: 'single' | 'multiple') => {
    onChange({ tables: nextTables, tableMode: nextMode })
  }

  return (
    <div className="w-full">
      <EffortTableEditor
        tables={tables}
        tableMode={tableMode}
        projectBaId={projectBaId}
        softwareOrigin={softwareOrigin}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}
