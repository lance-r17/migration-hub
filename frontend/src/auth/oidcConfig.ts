import type { UserManagerSettings } from 'oidc-client-ts'

/** True when OIDC env vars are configured — enables the real OIDC auth flow. */
export const isOidcEnabled = Boolean(import.meta.env.VITE_OIDC_ISSUER)

export const oidcSettings: UserManagerSettings = {
  authority: import.meta.env.VITE_OIDC_ISSUER ?? '',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'migration-hub',
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/callback`,
  response_type: 'code',
  scope: 'openid email profile',
  post_logout_redirect_uri: `${window.location.origin}/login`,
  // Disable silent renew — dev tokens last 1h, no renew iframe needed
  automaticSilentRenew: false,
}
