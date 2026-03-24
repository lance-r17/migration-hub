import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-4", className)} {...props} />
}

export function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />
}

export const FieldLabel = Label

export function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export function FieldSeparator({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex items-center gap-3", className)}>
      <div className="flex-1 border-t border-border" />
      {children && (
        <span className="shrink-0 text-xs text-muted-foreground">{children}</span>
      )}
      <div className="flex-1 border-t border-border" />
    </div>
  )
}
