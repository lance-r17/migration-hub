import { cn } from '@/lib/utils'

type ProgressVariant = 'primary' | 'tertiary' | 'error' | 'muted'

const variantClass: Record<ProgressVariant, string> = {
  primary: 'bg-primary',
  tertiary: 'bg-emerald-500',
  error: 'bg-destructive',
  muted: 'bg-muted-foreground',
}

interface ProgressBarProps {
  value: number // 0-100
  variant?: ProgressVariant
  height?: string
  className?: string
}

export function ProgressBar({ value, variant = 'primary', height = 'h-1.5', className }: ProgressBarProps) {
  return (
    <div className={cn('w-full bg-muted rounded-full overflow-hidden', height, className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', variantClass[variant])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
