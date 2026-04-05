import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface MonthPickerProps {
  value: string           // YYYY-MM or empty string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function formatLabel(value: string): string {
  if (!value) return ''
  const [year, month] = value.split('-')
  const label = MONTH_LABELS[parseInt(month ?? '0', 10) - 1]
  return label ? `${label} ${year}` : value
}

export function MonthPicker({
  value,
  onChange,
  placeholder = 'Pick a month',
  disabled = false,
  className,
}: MonthPickerProps) {
  const currentYear = new Date().getFullYear()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0] ?? String(currentYear), 10)
    return currentYear
  })

  const selectedYear = value ? parseInt(value.split('-')[0] ?? '0', 10) : null
  const selectedMonthIdx = value ? parseInt(value.split('-')[1] ?? '0', 10) - 1 : null

  const handleSelect = (monthIdx: number) => {
    const mm = String(monthIdx + 1).padStart(2, '0')
    onChange(`${year}-${mm}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon size={14} className="shrink-0" />
          {value ? formatLabel(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear(y => y - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setYear(y => y + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_LABELS.map((label, idx) => {
            const isSelected = selectedYear === year && selectedMonthIdx === idx
            return (
              <button
                key={label}
                onClick={() => handleSelect(idx)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
