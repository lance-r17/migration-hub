import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxPopover,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxItem,
} from '@/components/ui/combobox'

export interface MultiAutocompleteProps {
  label: string
  available: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  search: string
  onSearchChange: (v: string) => void
}

export function MultiAutocomplete({
  label,
  available,
  selected,
  onChange,
  search,
  onSearchChange,
}: MultiAutocompleteProps) {
  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () => available.filter(v => v.toLowerCase().includes(q) && !selected.has(v)),
    [available, q, selected]
  )

  const triggerLabel = selected.size === 0
    ? `Select ${label}...`
    : `${selected.size} ${label} selected`

  const toggleValue = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  return (
    <Combobox>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Array.from(selected).map(v => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--g-accent-soft)] text-[var(--g-accent)] text-[11px] font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => {
                  const n = new Set(selected)
                  n.delete(v)
                  onChange(n)
                }}
                className="shrink-0 rounded-full hover:bg-[var(--g-accent)]/10 p-0.5"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <ComboboxPopover className="w-full">
        <ComboboxTrigger className="w-full">
          {triggerLabel}
        </ComboboxTrigger>
        <ComboboxContent align="start" className="w-full">
          <ComboboxInput
            placeholder="Search values..."
            value={search}
            onValueChange={onSearchChange}
          />
          <ComboboxList>
            {filtered.length === 0 ? (
              <ComboboxEmpty>No values found</ComboboxEmpty>
            ) : (
              [...selected].map(v => (
                <ComboboxItem
                  key={v}
                  value={v}
                  selected
                  onSelect={() => toggleValue(v)}
                >
                  {v}
                </ComboboxItem>
              )).concat(
                filtered.map(v => (
                  <ComboboxItem
                    key={v}
                    value={v}
                    onSelect={() => {
                      toggleValue(v)
                      onSearchChange('')
                    }}
                  >
                    {v}
                  </ComboboxItem>
                ))
              )
            )}
          </ComboboxList>
          {selected.size > 0 && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 text-muted-foreground hover:text-foreground"
                onClick={() => onChange(new Set())}
              >
                Clear {label}
              </Button>
            </div>
          )}
        </ComboboxContent>
      </ComboboxPopover>
    </Combobox>
  )
}
