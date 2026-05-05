#!/bin/sh
set -e

# Generate config.json from environment variables at container startup.
# This allows a single Docker image to be deployed to any environment
# without rebuilding — just pass env vars to `docker run`.
#
# Usage: docker run -e API_BASE_URL=https://api.company.com -p 8080:8080 <image>

CONFIG_PATH="/usr/share/nginx/html/config.json"

cat > "$CONFIG_PATH" <<EOF
{
  "VITE_API_BASE_URL": "${API_BASE_URL:-}",
  "VITE_EMAIL_SERVER_URL": "${EMAIL_SERVER_URL:-}",
  "VITE_OAUTH_SERVICE_URL": "${OAUTH_SERVICE_URL:-}",
  "VITE_OAUTH_CLIENT_ID": "${OAUTH_CLIENT_ID:-}",
  "VITE_OAUTH_REDIRECT_URI": "${OAUTH_REDIRECT_URI:-}",
  "VITE_OIDC_ISSUER": "${OIDC_ISSUER:-}",
  "VITE_OIDC_CLIENT_ID": "${OIDC_CLIENT_ID:-}",
  "VITE_OIDC_REDIRECT_URI": "${OIDC_REDIRECT_URI:-}"
}
EOF

# For distroless / non-shell runtimes, users can mount config.json directly:
#   docker run -v /path/to/config.json:/usr/share/nginx/html/config.json:ro ...
# In that case this script is skipped and the mounted file is used as-is.

exec "$@"
