// ─── Runtime Configuration ───────────────────────────────────────────────────
//
// Reads window.__ENV__ injected by the Go entrypoint binary at container startup.
// Priority: runtime window.__ENV__ > Vite build-time env > undefined.
//
// The Go entrypoint reads environment variables and injects them into index.html
// as a synchronous <script>window.__ENV__={...}</script> before nginx starts.
// This allows a single Docker image to be deployed to any environment without
// rebuilding, and works in distroless images that have no shell.

declare global {
  interface Window {
    __ENV__?: Record<string, string>
  }
}

function env(key: string): string | undefined {
  const runtime = window.__ENV__?.[key]
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
