import { apiClient } from './client'

export async function scheduleEngagementZoom(projectId: string): Promise<{ zoomMeetingId: string; zoomMeetingUrl: string }> {
  return apiClient.post<{ zoomMeetingId: string; zoomMeetingUrl: string }>(`/api/v1/zoom/projects/${projectId}/engagement/schedule`, {})
}
