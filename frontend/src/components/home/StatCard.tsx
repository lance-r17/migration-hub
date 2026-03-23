import type { ElementType } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: ElementType
  value: number | string
  label: string
  iconBg?: string
  iconColor?: string
}

export function StatCard({ icon: Icon, value, label, iconBg = 'bg-secondary', iconColor = 'text-secondary-foreground' }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg, iconColor)}>
            <Icon size={20} />
          </div>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
