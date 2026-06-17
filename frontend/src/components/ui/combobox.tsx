import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  search: string
  setSearch: (v: string) => void
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null)

function useCombobox() {
  const ctx = React.useContext(ComboboxContext)
  if (!ctx) throw new Error("Combobox parts must be used inside <Combobox>")
  return ctx
}

// ─── Root ────────────────────────────────────────────────────────────────────

interface ComboboxProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
  search?: string
  onSearchChange?: (v: string) => void
}

function Combobox({ open: controlledOpen, onOpenChange, defaultOpen = false, children, search: controlledSearch, onSearchChange }: ComboboxProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const [uncontrolledSearch, setUncontrolledSearch] = React.useState("")
  const search = controlledSearch !== undefined ? controlledSearch : uncontrolledSearch
  const setSearch = (v: string) => {
    setUncontrolledSearch(v)
    onSearchChange?.(v)
  }

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = (value: boolean) => {
    setUncontrolledOpen(value)
    onOpenChange?.(value)
  }

  return (
    <ComboboxContext.Provider value={{ open, setOpen, search, setSearch }}>
      {children}
    </ComboboxContext.Provider>
  )
}

// ─── Trigger ─────────────────────────────────────────────────────────────────

interface ComboboxTriggerProps {
  placeholder?: string
  selectionLabel?: (count: number) => string
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

function ComboboxTrigger({
  placeholder = "Select...",
  selectionLabel,
  className,
  children,
  disabled,
}: ComboboxTriggerProps) {
  const { open } = useCombobox()

  return (
    <PopoverTrigger asChild disabled={disabled}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between px-2.5 font-normal text-sm h-8",
          className
        )}
      >
        {children ?? placeholder}
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
  )
}

// ─── Content ─────────────────────────────────────────────────────────────────

function ComboboxContent({
  className,
  children,
  align = "start",
  sideOffset = 4,
}: {
  className?: string
  children: React.ReactNode
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  return (
    <PopoverContent
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "w-(--radix-popover-trigger-width) p-0 overflow-hidden",
        className
      )}
    >
      <div className="flex flex-col max-h-72">
        {children}
      </div>
    </PopoverContent>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface ComboboxInputProps {
  placeholder?: string
  className?: string
  value?: string
  onValueChange?: (v: string) => void
}

function ComboboxInput({ placeholder = "Search...", className, value, onValueChange }: ComboboxInputProps) {
  const { search, setSearch } = useCombobox()
  const inputValue = value !== undefined ? value : search
  const handleChange = (v: string) => {
    onValueChange?.(v)
    if (value === undefined) setSearch(v)
  }

  return (
    <div className={cn("relative border-b", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full h-9 bg-transparent pl-8 pr-3 text-sm outline-hidden placeholder:text-muted-foreground"
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ─── List ────────────────────────────────────────────────────────────────────

function ComboboxList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-y-auto p-1", className)}>
      {children}
    </div>
  )
}

// ─── Empty ───────────────────────────────────────────────────────────────────

function ComboboxEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}

// ─── Item ────────────────────────────────────────────────────────────────────

interface ComboboxItemProps {
  value: string
  selected?: boolean
  onSelect?: (value: string) => void
  children: React.ReactNode
  className?: string
}

function ComboboxItem({
  value,
  selected,
  onSelect,
  children,
  className,
}: ComboboxItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(value)}
      className={cn(
        "relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        className
      )}
    >
      <Check
        className={cn(
          "mr-2 h-4 w-4 shrink-0",
          selected ? "opacity-100" : "opacity-0"
        )}
      />
      {children}
    </button>
  )
}

// ─── Multi root wrapper that wires Popover into Combobox context ─────────────

function ComboboxPopover({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { open, setOpen } = useCombobox()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>{children}</div>
    </Popover>
  )
}

export {
  Combobox,
  ComboboxPopover,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxItem,
}
