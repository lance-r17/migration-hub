#!/bin/sh
# Generate dex config from environment variables at container startup.
# This keeps the bcrypt hash out of committed files.

set -e

# Use a default dev-only hash if none provided.
# Generate a new one with:
#   python -c "import bcrypt; print(bcrypt.hashpw(b'<pw>', bcrypt.gensalt()).decode())"
HASH="${MOCK_DEX_PASSWORD_HASH:-\$2b\$12\$/EOXXI26oUp1O1KRC.xiIu6FCOoUxBTSiWWBdi7piHVrkIczUbt46}"

CONFIG_PATH="/tmp/dex-config.yaml"

cat > "$CONFIG_PATH" <<EOF
issuer: http://localhost:5556/dex

storage:
  type: sqlite3
  config:
    file: /var/dex/dex.db

web:
  http: 0.0.0.0:5556
  allowedOrigins:
    - http://localhost:5173

oauth2:
  skipApprovalScreen: true
  responseTypes:
    - code

staticClients:
  - id: migration-hub
    public: true
    name: Migration Hub
    redirectURIs:
      - http://localhost:5173/callback

enablePasswordDB: true

staticPasswords:
  - email: henry.wilson@corp.com
    hash: "$HASH"
    username: "Henry Wilson"
    userID: "u-current"

  - email: alice.johnson@corp.com
    hash: "$HASH"
    username: "Alice Johnson"
    userID: "u3"

  - email: karen.lee@corp.com
    hash: "$HASH"
    username: "Karen Lee"
    userID: "u12"

  - email: dan.brown@corp.com
    hash: "$HASH"
    username: "Dan Brown"
    userID: "u2"
EOF

exec dex serve "$CONFIG_PATH"
