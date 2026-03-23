import type { ReactNode, ElementType } from 'react'
import { cn } from '@/lib/utils'
import { MotionCard } from '@/components/shared/MotionCard'
import {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

interface SectionCardProps {
  icon: ElementType
  title: string
  iconBg?: string
  iconColor?: string
  headerRight?: ReactNode
  onEdit?: () => void
  children: ReactNode
  className?: string
  titleClassName?: string
}

export function SectionCard({
  icon: Icon,
  title,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
  headerRight,
  onEdit,
  children,
  className,
  titleClassName,
}: SectionCardProps) {
  return (
    <MotionCard className={cn(
        'cursor-pointer py-6 hover:border-primary/20',
        className
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded flex items-center justify-center', iconBg, iconColor)}>
              <Icon size={20} />
            </div>
            <CardTitle className={cn('text-lg font-semibold', titleClassName)}>{title}</CardTitle>
          </div>
          {headerRight && <div>{headerRight}</div>}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
              <Pencil size={14} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </MotionCard>
  )
}
