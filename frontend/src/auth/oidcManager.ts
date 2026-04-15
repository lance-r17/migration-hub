import { UserManager } from 'oidc-client-ts'
import { isOidcEnabled, oidcSettings } from './oidcConfig'

/**
 * Singleton UserManager for OIDC operations.
 * Null when OIDC is disabled (mock auth mode).
 *
 * Usage:
 *   import { oidcManager } from '@/auth/oidcManager'
 *   await oidcManager?.signinRedirect()
 *   const user = await oidcManager?.getUser()
 */
export const oidcManager: UserManager | null = isOidcEnabled
  ? new UserManager(oidcSettings)
  : null
