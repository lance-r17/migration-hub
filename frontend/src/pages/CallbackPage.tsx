import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { oidcManager } from '@/auth/oidcManager'
import { isOAuthEnabled } from '@/auth/oauthConfig'
import { exchangeCodeForSession } from '@/services/oauth'
import { getCurrentUser } from '@/services/users'
import { useCurrentUser } from '@/context/UserContext'

/**
 * Handles the OIDC / OAuth redirect callback at /callback.
 *
 * Supports three auth modes:
 *   1. Custom OAuth (isOAuthEnabled) → exchanges code via backend, stores backend JWT
 *   2. Standard OIDC (oidcManager)   → uses oidc-client-ts token exchange
 *   3. Mock auth (neither)           → no-op, redirects home
 */
export function CallbackPage() {
  const { login } = useCurrentUser()
  const navigate = useNavigate()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    // ── 1. Custom Enterprise OAuth flow ────────────────────────────────────
    if (isOAuthEnabled) {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const savedState = sessionStorage.getItem('oauth_state')
      const redirectPath = sessionStorage.getItem('oauth_redirect') || '/'

      if (!code || state !== savedState) {
        console.error('OAuth callback missing code or invalid state')
        navigate('/login', { replace: true })
        return
      }

      sessionStorage.removeItem('oauth_state')
      sessionStorage.removeItem('oauth_redirect')

      exchangeCodeForSession(code)
        .then(({ user, token }) => {
          sessionStorage.setItem('backend_token', token)
          login(user)
          navigate(redirectPath, { replace: true })
        })
        .catch((err) => {
          console.error('OAuth exchange failed:', err)
          navigate('/login', { replace: true })
        })
      return
    }

    // ── 2. Standard OIDC flow ──────────────────────────────────────────────
    if (!oidcManager) {
      navigate('/', { replace: true })
      return
    }

    oidcManager
      .signinRedirectCallback()
      .then(() => getCurrentUser())
      .then((user) => {
        login(user)
        navigate('/', { replace: true })
      })
      .catch((err) => {
        console.error('OIDC callback failed:', err)
        navigate('/login', { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Completing sign-in…</p>
    </div>
  )
}
