import { useState, useEffect } from 'react'
import { format, isBefore, isAfter } from 'date-fns'
import { X, CalendarIcon, Loader2 } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CATEGORY_MILESTONE_COLORS } from '@/types/categoryMilestone'
import { CATEGORY_ICONS } from '@/lib/categoryMilestoneIcons'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import type { CategoryMilestone } from '@/types/categoryMilestone'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryMilestone?: CategoryMilestone | null
  onSave: (data: Omit<CategoryMilestone, 'id' | 'createdAt'>) => void
  saving?: boolean
}

function formatRange(start: string, end: string): string {
  if (!start) return 'Pick a date range'
  const from = format(new Date(start), 'MMM d, y')
  if (!end) return from
  return `${from} – ${format(new Date(end), 'MMM d, y')}`
}

export function CategoryMilestoneDrawer({ open, onOpenChange, categoryMilestone, onSave, saving }: Props) {
  const { settings } = useMigrationSettings()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [color, setColor] = useState<string>(CATEGORY_MILESTONE_COLORS[0])
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0].name)
  const [calOpen, setCalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (categoryMilestone) {
      setName(categoryMilestone.name)
      setStartDate(categoryMilestone.startDate)
      setEndDate(categoryMilestone.endDate)
      setColor(categoryMilestone.color ?? CATEGORY_MILESTONE_COLORS[0])
      setIcon(categoryMilestone.icon ?? CATEGORY_ICONS[0].name)
    } else {
      setName('')
      setStartDate('')
      setEndDate('')
      setColor(CATEGORY_MILESTONE_COLORS[0])
      setIcon(CATEGORY_ICONS[0].name)
    }
    setError(null)
  }, [categoryMilestone, open])

  const handleClose = () => {
    if (saving) return
    onOpenChange(false)
  }

  const handleRangeSelect = (range: DateRange | undefined) => {
    setStartDate(range?.from ? format(range.from, 'yyyy-MM-dd') : '')
    setEndDate(range?.to ? format(range.to, 'yyyy-MM-dd') : '')
    setError(null)
  }

  const validateDates = (start: string, end: string): string | null => {
    const pp = settings?.platformPeriod
    const csp = settings?.cloudSetupPeriod
    const effectiveStart = csp?.startDate || pp?.startDate
    const effectiveEnd = pp?.endDate
    if (!effectiveStart || !effectiveEnd) return null
    if (isBefore(new Date(start), new Date(effectiveStart)) || isAfter(new Date(end), new Date(effectiveEnd))) {
      return `Dates must fall within ${format(new Date(effectiveStart), 'MMM d, y')} – ${format(new Date(effectiveEnd), 'MMM d, y')}.`
    }
    return null
  }

  const handleSave = () => {
    if (!name.trim() || !startDate || !endDate) {
      setError('Name, start date, and end date are required')
      return
    }
    if (startDate > endDate) {
      setError('Start date must be before end date')
      return
    }
    const dateError = validateDates(startDate, endDate)
    if (dateError) {
      setError(dateError)
      return
    }
    setError(null)
    onSave({ name: name.trim(), startDate, endDate, color, icon })
  }

  const selectedRange: DateRange = {
    from: startDate ? new Date(startDate) : undefined,
    to: endDate ? new Date(endDate) : undefined,
  }

  const pp = settings?.platformPeriod
  const csp = settings?.cloudSetupPeriod
  const effectiveStart = csp?.startDate || pp?.startDate
  const effectiveEnd = pp?.endDate
  const disabledDates = effectiveStart && effectiveEnd
    ? [
        { before: new Date(effectiveStart) },
        { after: new Date(effectiveEnd) },
      ]
    : undefined

  return (
    <Sheet open={open} onOpenChange={handleClose} data-testid="category-milestone-drawer">
      <SheetContent side="right" className="w-[480px] sm:!max-w-[480px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>{categoryMilestone ? 'Edit Category Milestone' : 'Create Category Milestone'}</SheetTitle>
              <SheetDescription>Manage category milestone name, dates, color, and icon.</SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} disabled={saving}>
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. API Gateway Modernization" data-testid="category-milestone-name-input" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date Range <span className="text-destructive">*</span>
            </label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                  data-testid="category-milestone-date-range"
                >
                  <CalendarIcon size={14} className="mr-2 shrink-0" />
                  {formatRange(startDate, endDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  defaultMonth={startDate ? new Date(startDate) : effectiveStart ? new Date(effectiveStart) : undefined}
                  selected={selectedRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                  disabled={disabledDates}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORY_MILESTONE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'size-7 rounded-full transition-all',
                    color === c && 'ring-2 ring-offset-2 ring-foreground'
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icon</label>
            <TooltipProvider>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ICONS.map(ic => {
                  const Icon = ic.icon
                  return (
                    <Tooltip key={ic.name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setIcon(ic.name)}
                          className={cn(
                            'flex items-center justify-center size-9 rounded-md border transition-all',
                            icon === ic.name
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <Icon className="size-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{ic.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </TooltipProvider>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[120px]" data-testid="category-milestone-save-btn">
            {saving ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Saving…</>
            ) : categoryMilestone ? 'Save Changes' : 'Create'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
