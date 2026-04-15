import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { oidcManager } from '@/auth/oidcManager'
import { getCurrentUser } from '@/services/users'
import { useCurrentUser } from '@/context/UserContext'

/**
 * Handles the OIDC redirect callback at /callback.
 * Exchanges the auth code for tokens, fetches the user profile,
 * then redirects to the home page.
 */
export function CallbackPage() {
  const { login } = useCurrentUser()
  const navigate = useNavigate()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

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
