/**
 * Custom enterprise OAuth service configuration.
 *
 * This replaces the standard OIDC flow when VITE_OAUTH_SERVICE_URL is set.
 * The OAuth service uses a non-standard flow where:
 *   1. Frontend redirects to {oauth_service_url}/api/v1/oauth/sso/authentication
 *   2. OAuth service authenticates and redirects back with a one-time code
 *   3. Frontend sends the code to the backend /api/v1/auth/sso/exchange
 *   4. Backend exchanges the code (using client_secret) for userinfo
 *   5. Backend issues a session JWT and returns it to the frontend
 */

/** True when the custom OAuth service is configured. */
export const isOAuthEnabled = Boolean(import.meta.env.VITE_OAUTH_SERVICE_URL)

/** Build the OAuth service authentication URL with CSRF state. */
export function buildOAuthLoginUrl(state: string): string {
  const base = import.meta.env.VITE_OAUTH_SERVICE_URL as string
  const clientId = (import.meta.env.VITE_OAUTH_CLIENT_ID as string) ?? 'migration-hub'
  const redirectUri =
    (import.meta.env.VITE_OAUTH_REDIRECT_URI as string) ??
    `${window.location.origin}/callback`
  return (
    `${base}/api/v1/oauth/sso/authentication` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`
  )
}
