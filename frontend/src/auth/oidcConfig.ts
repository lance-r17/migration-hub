import type { UserManagerSettings } from 'oidc-client-ts'
import { WebStorageStateStore } from 'oidc-client-ts'
import { getOidcIssuer, getOidcClientId, getOidcRedirectUri } from '@/runtimeConfig'

/** True when OIDC env vars are configured — enables the real OIDC auth flow. */
export const isOidcEnabled = Boolean(getOidcIssuer())

export const oidcSettings: UserManagerSettings = {
  authority: getOidcIssuer() ?? '',
  client_id: getOidcClientId() ?? 'migration-hub',
  redirect_uri: getOidcRedirectUri() ?? `${window.location.origin}/callback`,
  response_type: 'code',
  scope: 'openid email profile',
  post_logout_redirect_uri: `${window.location.origin}/login`,
  // Disable silent renew — dev tokens last 1h, no renew iframe needed
  automaticSilentRenew: false,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
}
