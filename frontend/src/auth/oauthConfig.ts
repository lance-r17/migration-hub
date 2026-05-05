/**
 * Custom enterprise OAuth service configuration.
 *
 * This replaces the standard OIDC flow when the OAuth service URL is configured.
 * The OAuth service uses a non-standard flow where:
 *   1. Frontend redirects to {oauth_service_url}/api/v1/oauth/sso/authentication
 *   2. OAuth service authenticates and redirects back with a one-time code
 *   3. Frontend sends the code to the backend /api/v1/auth/sso/exchange
 *   4. Backend exchanges the code (using client_secret) for userinfo
 *   5. Backend issues a session JWT and returns it to the frontend
 */

import {
  getOAuthServiceUrl,
  getOAuthClientId,
  getOAuthRedirectUri,
} from '@/runtimeConfig'

/** True when the custom OAuth service is configured. */
export const isOAuthEnabled = Boolean(getOAuthServiceUrl())

/** Build the OAuth service authentication URL with CSRF state. */
export function buildOAuthLoginUrl(state: string): string {
  const base = getOAuthServiceUrl()
  if (!base) {
    throw new Error(
      'OAuth service URL is not configured. ' +
      'Set OAUTH_SERVICE_URL (runtime) or VITE_OAUTH_SERVICE_URL (build-time) .env.local)'
    )
  }
  const clientId = getOAuthClientId()
  const redirectUri =
    getOAuthRedirectUri() ?? `${window.location.origin}/callback`
  return (
    `${base}/api/v1/oauth/sso/authentication` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`
  )
}
