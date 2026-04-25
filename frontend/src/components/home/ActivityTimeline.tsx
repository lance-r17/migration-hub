import { Check, AlertCircle } from 'lucide-react'
import { format, isToday, isYesterday, parseISO, formatDistanceToNow, differenceInHours } from 'date-fns'
import type { Activity } from '@/types'

interface ActivityTimelineProps {
  activities: Activity[]
}

function ActivityDot({ type }: { type: Activity['type'] }) {
  if (type === 'success') {
    return (
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center border-4 border-background z-10">
        <Check size={10} className="text-emerald-700 dark:text-emerald-300 font-bold" strokeWidth={3} />
      </div>
    )
  }
  if (type === 'error') {
    return (
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center border-4 border-background z-10">
        <AlertCircle size={10} className="text-destructive font-bold" strokeWidth={3} />
      </div>
    )
  }
  // info
  return (
    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background z-10">
      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
    </div>
  )
}

function formatActivityTime(isoString: string): string {
  try {
    const date = parseISO(isoString)
    const hoursAgo = differenceInHours(new Date(), date)
    if (hoursAgo < 24) {
      return formatDistanceToNow(date, { addSuffix: true })
    }
    const timeStr = format(date, 'HH:mm')
    if (isToday(date)) return `Today, ${timeStr}`
    if (isYesterday(date)) return `Yesterday, ${timeStr}`
    return format(date, 'd MMM yyyy, HH:mm')
  } catch {
    return isoString
  }
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  return (
    <div className="bg-card p-6 rounded-xl border border-border">
      <h3 className="text-sm font-bold text-foreground mb-6 uppercase tracking-widest">Recent Activity</h3>
      <div className="overflow-y-auto max-h-[600px] space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border pr-2">
        {activities.map((activity) => (
          <div key={activity.id} className="relative pl-8">
            <ActivityDot type={activity.type} />
            <div>
              <p className="text-sm font-medium text-foreground">{activity.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatActivityTime(activity.time)}
                {activity.projectName && (
                  <span className="ml-1.5">• {activity.projectName}</span>
                )}
                <span className="ml-1.5">• By {activity.actor}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
