import { apiClient } from './client'
import { userFromApi } from './users'
import type { User } from '@/types'

export interface SSOExchangeResponse {
  user: User
  token: string
}

export async function exchangeCodeForSession(code: string): Promise<SSOExchangeResponse> {
  const raw = await apiClient.post<{ user: Record<string, unknown>; token: string }>('/api/v1/auth/sso/exchange', { code })
  return { user: userFromApi(raw.user), token: raw.token }
}
