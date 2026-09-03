import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export function RecipientsCell({ toAddrs }: { toAddrs: string[] }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  if (toAddrs.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const [first, ...rest] = toAddrs
  const handleEnter = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const handleLeave = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-sm text-muted-foreground truncate max-w-[220px]">{first}</span>
      {rest.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <span onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
              <Badge variant="secondary" className="cursor-default shrink-0">
                +{rest.length}
              </Badge>
            </span>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-xs p-3"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recipients
            </p>
            <ul className="space-y-1">
              {toAddrs.map((addr) => (
                <li key={addr} className="text-xs text-foreground break-all">
                  {addr}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
