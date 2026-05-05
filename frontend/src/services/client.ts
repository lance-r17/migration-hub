// ─── API Client ────────────────────────────────────────────────────────────────
//
// USE_MOCK is the single toggle that controls all services.
// Set VITE_API_BASE_URL in .env.local to switch to real HTTP calls — no code changes needed.

import { oidcManager } from '@/auth/oidcManager'

import { getApiBaseUrl } from '@/runtimeConfig'

export const BASE_URL = getApiBaseUrl()
export const USE_MOCK = !BASE_URL

const MOCK_DELAY_MS = 200

export const delay = (ms = MOCK_DELAY_MS): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Returns Authorization header for the active auth mode. */
async function authHeader(): Promise<HeadersInit> {
  // 1. Custom OAuth mode: backend-issued JWT
  const backendToken = sessionStorage.getItem('backend_token')
  if (backendToken) {
    return { Authorization: `Bearer ${backendToken}` }
  }

  // 2. Standard OIDC mode
  if (!oidcManager) return {}
  const user = await oidcManager.getUser()
  return user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}
}

let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb
}

async function handleResponse<T>(res: Response, method: string, path: string): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.()
    }
    let msg = `${method} ${path} failed: ${res.status}`
    try {
      const errData = await res.json()
      if (errData?.detail) {
        msg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail)
      } else if (errData?.message) {
        msg = errData.message
      }
    } catch (_) {}
    throw new Error(msg)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T
  return res.json() as Promise<T>
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    })
    return handleResponse<T>(res, 'GET', path)
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(res, 'PUT', path)
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(res, 'PATCH', path)
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
    return handleResponse<T>(res, 'POST', path)
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: { ...(await authHeader()) },
    })
    return handleResponse<T>(res, 'DELETE', path)
  },

  async postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...(await authHeader()) },
      body: form,
    })
    return handleResponse<T>(res, 'POST', path)
  },
}
