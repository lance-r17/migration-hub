import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { TeamMember } from '@/types'

const colors = [
  'bg-primary/10 text-primary',
  'bg-secondary text-secondary-foreground',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-muted text-muted-foreground',
]

interface TeamAvatarsProps {
  members: TeamMember[]
  max?: number
  size?: string
}

export function TeamAvatars({ members, max = 3, size = 'h-7 w-7' }: TeamAvatarsProps) {
  const visible = members.slice(0, max)
  const overflow = members.length - max

  return (
    <div className="flex -space-x-2">
      {visible.map((member, i) => (
        <Avatar
          key={member.id}
          title={member.name}
          className={cn(size, 'rounded-full border-2 border-background flex-shrink-0 text-[10px] font-bold', colors[i % colors.length])}
        >
          <AvatarImage src={member.avatarUrl} alt={member.name} />
          <AvatarFallback className={cn('rounded-full text-[10px] font-bold', colors[i % colors.length])}>
            {member.initials ?? member.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <Avatar className={cn(size, 'rounded-full border-2 border-background flex-shrink-0')}>
          <AvatarFallback className="rounded-full bg-muted text-muted-foreground text-[10px] font-bold">
            +{overflow}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
