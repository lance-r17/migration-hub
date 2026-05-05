// ─── Runtime Configuration ───────────────────────────────────────────────────
//
// Fetches /config.json on startup and merges it with build-time VITE_* env vars.
// Priority: runtime config.json > Vite build-time env > undefined.
//
// This allows a single Docker image to be deployed to any environment without
// rebuilding. Set environment variables on the container; the entrypoint script
// writes them to /usr/share/nginx/html/config.json before nginx starts.

let runtimeConfig: Record<string, string> | null = null

/** Fetch config.json from the server. Call once before rendering. */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    // Cache-bust to ensure we get the latest config.json
    const res = await fetch(`/config.json?${Date.now()}`)
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') {
        runtimeConfig = data as Record<string, string>
      }
    }
  } catch {
    // config.json not available — fall back to build-time env vars only
  }
}

/** Get a config value. Runtime config takes priority over build-time Vite env.
 *  null and empty strings are treated as "not set" so build-time values win.
 */
function env(key: string): string | undefined {
  const runtime = runtimeConfig?.[key]
  if (runtime !== undefined && runtime !== null && runtime !== '') {
    return runtime
  }
  return import.meta.env[key] as string | undefined
}

// ─── Typed accessors ─────────────────────────────────────────────────────────

export const getApiBaseUrl = () => env('VITE_API_BASE_URL') ?? ''
export const getEmailServerUrl = () => env('VITE_EMAIL_SERVER_URL')
export const getOAuthServiceUrl = () => env('VITE_OAUTH_SERVICE_URL')
export const getOAuthClientId = () => env('VITE_OAUTH_CLIENT_ID') ?? 'migration-hub'
export const getOAuthRedirectUri = () => env('VITE_OAUTH_REDIRECT_URI')
export const getOidcIssuer = () => env('VITE_OIDC_ISSUER')
export const getOidcClientId = () => env('VITE_OIDC_CLIENT_ID') ?? 'migration-hub'
export const getOidcRedirectUri = () => env('VITE_OIDC_REDIRECT_URI')
