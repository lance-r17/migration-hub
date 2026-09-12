import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  notifyNotificationsChanged,
} from '@/services/notifications'
import type { AppNotification } from '@/services/notifications'

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setNotifications(await getNotifications())
    } catch {
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const handleOpen = async (notification: AppNotification) => {
    if (!notification.read_at) {
      try {
        const updated = await markNotificationRead(notification.id)
        setNotifications((list) =>
          list.map((n) => (n.id === updated.id ? updated : n)),
        )
        notifyNotificationsChanged()
      } catch {
        // ignore; still navigate
      }
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((list) =>
        list.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
      notifyNotificationsChanged()
    } catch {
      toast.error('Failed to mark all as read')
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await deleteNotification(id)
      setNotifications((list) => list.filter((n) => n.id !== id))
      notifyNotificationsChanged()
    } catch {
      toast.error('Failed to delete notification')
    }
  }

  return (
    <AppShell title="Notifications">
      <div className="max-w-screen-lg mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="size-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Updates about your account and access.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
              <CheckCheck className="size-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No notifications.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const unread = !n.read_at
              return (
                <div
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border px-4 py-3 transition-colors',
                    n.link && 'cursor-pointer hover:bg-muted/50',
                    unread && 'bg-muted/30',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      unread ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className={cn('text-sm', unread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                      {n.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground/70">{formatTimestamp(n.created_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(e, n.id)}
                    title="Dismiss"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
