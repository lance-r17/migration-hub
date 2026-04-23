import { apiClient } from './client'
import type { User } from '@/types'

export interface SSOExchangeResponse {
  user: User
  token: string
}

export async function exchangeCodeForSession(code: string): Promise<SSOExchangeResponse> {
  return apiClient.post<SSOExchangeResponse>('/api/v1/auth/sso/exchange', { code })
}
