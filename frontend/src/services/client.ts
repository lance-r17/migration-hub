// ─── API Client ────────────────────────────────────────────────────────────────
//
// USE_MOCK is the single toggle that controls all services.
// Set VITE_API_BASE_URL in .env.local to switch to real HTTP calls — no code changes needed.

import { oidcManager } from '@/auth/oidcManager'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
export const USE_MOCK = !BASE_URL

const MOCK_DELAY_MS = 200

export const delay = (ms = MOCK_DELAY_MS): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Returns Authorization header when an OIDC access token is available. */
async function authHeader(): Promise<HeadersInit> {
  if (!oidcManager) return {}
  const user = await oidcManager.getUser()
  return user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    })
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
    return res.json() as Promise<T>
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`)
    return res.json() as Promise<T>
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`)
    return res.json() as Promise<T>
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
    return res.json() as Promise<T>
  },
}
