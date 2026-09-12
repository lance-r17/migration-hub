import { apiClient } from './client'

const ENDPOINT = '/api/v1/notifications'
const CONFIG_ENDPOINT = '/api/v1/admin/notification-config'

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationConfig {
  retention_limit: number
}

/** Dispatched on window after notification mutations so badges can refresh. */
export const NOTIFICATIONS_CHANGED_EVENT = 'notifications-changed'

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}

export async function getNotifications(): Promise<AppNotification[]> {
  return apiClient.get<AppNotification[]>(ENDPOINT)
}

export async function getUnreadCount(): Promise<number> {
  const res = await apiClient.get<{ count: number }>(`${ENDPOINT}/unread-count`)
  return res.count
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  return apiClient.post<AppNotification>(`${ENDPOINT}/${id}/read`, {})
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiClient.post<void>(`${ENDPOINT}/read-all`, {})
}

export async function deleteNotification(id: string): Promise<void> {
  return apiClient.delete<void>(`${ENDPOINT}/${id}`)
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
  return apiClient.get<NotificationConfig>(CONFIG_ENDPOINT)
}

export async function updateNotificationConfig(
  data: NotificationConfig,
): Promise<NotificationConfig> {
  return apiClient.put<NotificationConfig>(CONFIG_ENDPOINT, data)
}
