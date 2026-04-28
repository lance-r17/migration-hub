# SSO / Authentication Configuration

Migration Hub supports three authentication modes, controlled entirely by environment variables:

1. **Custom Enterprise OAuth** (recommended for new deployments)
2. **Standard OIDC** (legacy — dex, Azure AD, Okta, etc.)
3. **Mock Auth** (default for local development — no IdP)

---

## How the toggle works

| Priority | State | Behavior |
|---|---|---|
| 1 | `VITE_OAUTH_SERVICE_URL` is **set** | Custom OAuth — backend exchanges one-time codes with the OAuth service and issues session JWTs |
| 2 | `VITE_OIDC_ISSUER` is **set** (and OAuth is empty) | Standard OIDC — frontend exchanges codes via PKCE; backend validates IdP JWTs via JWKS |
| 3 | Both are **empty** (default) | Mock auth — any click on the login button signs in as the seeded dev user |

Both frontend and backend must have matching configuration.

---

## Authentication flow diagrams

### Custom Enterprise OAuth (recommended)

```
  User          Browser            React SPA         OAuth Service        FastAPI Backend
   │               │                   │                     │                      │
   │               │   1. Click "Login with Enterprise SSO"  │                      │
   │──────────────>│──────────────────>│                     │                      │
   │               │                   │  2. window.location = {oauth}/auth?...     │
   │               │─────────────────────────────────────────>│                      │
   │               │                   │                     │                      │
   │               │   3. Authenticate (enter credentials)    │                      │
   │──────────────>│─────────────────────────────────────────>│                      │
   │               │                   │                     │                      │
   │               │<─────────────────────────────────────────│  4. 302 /callback?code=OTC
   │               │                   │                     │                      │
   │               │   5. Load /callback?code=OTC&state=...   │                      │
   │               │──────────────────>│                     │                      │
   │               │                   │  6. Validate state   │                      │
   │               │                   │  7. POST /auth/sso/exchange {code}          │
   │               │                   │─────────────────────────────────────────────>│
   │               │                   │                     │  8. GET /userinfo     │
   │               │                   │                     │  {client_id,secret,   │
   │               │                   │                     │   code}               │
   │               │                   │                     │<─────────────────────│
   │               │                   │                     │  9. 200 {email,...}   │
   │               │                   │                     │─────────────────────>│
   │               │                   │                     │ 10. Lookup user by    │
   │               │                   │                     │     email in DB       │
   │               │                   │                     │ 11. Issue backend JWT │
   │               │                   │<─────────────────────────────────────────────│
   │               │                   │ 12. 200 {user,token} │                      │
   │               │                   │ 13. Store token      │                      │
   │               │                   │     in sessionStorage│                      │
   │               │<──────────────────│ 14. navigate('/')    │                      │
   │               │                   │                     │                      │
   │               │                   │  ╔═══════════════════════════════════════╗ │
   │               │                   │  ║  Every API call                       ║ │
   │               │                   │  ║  GET /api/v1/...                      ║ │
   │               │                   │  ║  Authorization: Bearer <backend_jwt>  ║ │
   │               │                   │  ║  ────────────────────────────────────>║ │
   │               │                   │  ║  Verify JWT & claims                  ║ │
   │               │                   │  ║  <────────────────────────────────────║ │
   │               │                   │  ╚═══════════════════════════════════════╝ │
   │               │                   │                     │                      │
   │   15. Logout  │──────────────────>│                     │                      │
   │               │                   │ 16. Remove token    │                      │
   │               │<──────────────────│ 17. Redirect /login │                      │
```

### Standard OIDC (legacy)

```
  User          Browser            React SPA         OIDC IdP (dex/Azure)   FastAPI Backend
   │               │                   │                     │                      │
   │               │   1. Click "Login with Enterprise SSO"  │                      │
   │──────────────>│──────────────────>│                     │                      │
   │               │                   │  2. signinRedirect()│                      │
   │               │                   │  3. Navigate /auth?code_challenge=...      │
   │               │─────────────────────────────────────────>│                      │
   │               │                   │                     │                      │
   │               │   4. Authenticate                      │                      │
   │──────────────>│─────────────────────────────────────────>│                      │
   │               │                   │                     │                      │
   │               │<─────────────────────────────────────────│  5. 302 /callback?code
   │               │                   │                     │                      │
   │               │   6. Load /callback                     │                      │
   │               │──────────────────>│                     │                      │
   │               │                   │  7. POST /token     │                      │
   │               │                   │  {code,code_verifier}│                     │
   │               │                   │─────────────────────>│                      │
   │               │                   │<─────────────────────│  8. 200 {access_token}
   │               │                   │  9. Store tokens     │                      │
   │               │                   │     in sessionStorage│                      │
   │               │                   │ 10. GET /users/me   │                      │
   │               │                   │     Authorization: Bearer <access_token>    │
   │               │                   │─────────────────────────────────────────────>│
   │               │                   │                     │ 11. Fetch JWKS /keys  │
   │               │                   │                     │ 12. Verify RS256 sig  │
   │               │                   │<─────────────────────────────────────────────│
   │               │                   │ 13. 200 User        │                      │
   │               │                   │ 14. Set auth flag   │                      │
   │               │<──────────────────│ 15. navigate('/')   │                      │
```

### Mock Auth (development)

```
  User          Browser            React SPA         FastAPI Backend
   │               │                   │                      │
   │   1. Click    │──────────────────>│                      │
   │      Login    │                   │  2. POST /auth/login │
   │               │                   │  {email, password}   │
   │               │                   │─────────────────────>│
   │               │                   │                      │
   │               │                   │                      │  3. Ignore credentials
   │               │                   │                      │     Return CURRENT_USER_ID
   │               │                   │<─────────────────────│
   │               │                   │  4. 200 User         │
   │               │                   │  5. Set auth flag    │
   │               │<──────────────────│  6. navigate('/')    │
   │               │                   │                      │
   │               │                   │  ╔═══════════════════╗│
   │               │                   │  ║  Every API call   ║│
   │               │                   │  ║  GET /api/v1/...  ║│
   │               │                   │  ║  (no auth header) ║│
   │               │                   │  ║  ────────────────>║│
   │               │                   │  ║  Return mock user ║│
   │               │                   │  ║  <────────────────║│
   │               │                   │  ╚═══════════════════╝│
```

---

## Custom Enterprise OAuth (Recommended)

This flow matches a real enterprise OAuth service that does **not** expose standard OIDC discovery.

### Flow

1. Frontend redirects user to `{OAUTH_SERVICE_URL}/api/v1/oauth/sso/authentication`
2. User authenticates on the OAuth service
3. OAuth service redirects to frontend `/callback` with a **one-time code**
4. Frontend POSTs the code to `POST /api/v1/auth/sso/exchange`
5. **Backend** calls the OAuth service `/userinfo` endpoint with `client_id`, `client_secret`, and `code`
6. OAuth service returns user details
7. Backend looks up the user by email, issues a **backend-signed JWT**, and returns it to the frontend
8. Frontend stores the token and redirects to the app

### Environment variable reference

#### Frontend (`frontend/.env.local`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_OAUTH_SERVICE_URL` | Yes | Base URL of the OAuth service | `http://localhost:5557` |
| `VITE_OAUTH_CLIENT_ID` | Yes | Registered client ID | `migration-hub` |
| `VITE_OAUTH_REDIRECT_URI` | Yes | Post-login callback URL | `http://localhost:5173/callback` |

#### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `OAUTH_SERVICE_URL` | _(empty)_ | Must match `VITE_OAUTH_SERVICE_URL` |
| `OAUTH_CLIENT_ID` | `migration-hub` | Client ID registered with the OAuth service |
| `OAUTH_CLIENT_SECRET` | _(empty)_ | Client secret for backend-to-service exchange |
| `SESSION_SECRET_KEY` | _(empty)_ | Secret key for signing backend JWTs (HS256) |
| `SESSION_MAX_AGE_MINUTES` | `480` | Session lifetime in minutes (default: 8 hours) |

> **Security:** `SESSION_SECRET_KEY` must be a cryptographically random string of at least 32 bytes in production.

### AD group synchronization

On every Custom Enterprise OAuth login, the backend receives the user's AD group membership (`member_of`) from the OAuth service and performs two synchronizations:

| Sync | What happens | Rows affected |
|---|---|---|
| **Global roles** | AD groups are matched against `OAUTH_ROLE_MAPPINGS`; the user's `users.role` is overwritten | `users` table |
| **Project memberships** | AD groups are matched against `OAUTH_AD_GROUP_REGEX`; matching projects grant `role='member'` | `project_users` table |

#### Environment variables

| Variable | Default | Description |
|---|---|---|
| `OAUTH_AD_GROUP_REGEX` | `CN=([^,]+)-ResourceSetReadOnly` | Regex to extract a project ID from an AD group DN. The first capture group becomes the project ID. |
| `OAUTH_AD_GROUP_OU_FILTER` | `OU=Ali` | If set, only AD groups containing this substring are considered. |
| `OAUTH_ROLE_MAPPINGS` | _(empty)_ | JSON array of `{"regex": "...", "role": "..."}`. The first matching regex sets the global role. Role may be comma-separated for multiple roles. |

#### Governance roles are protected

**`sync_user_projects` only touches rows where `project_users.role = 'member'`**. Governance roles assigned through the project's **Application Overview** — `technical_lead`, `business_owner`, and `dba_data_owner` — are **never** revoked by SSO login, even if the user no longer belongs to the project's AD group.

**Example:**
- Alice is assigned as **Technical Lead** on project `PRJ-A123` via the Application Overview screen.
- Alice also belongs to the AD group `CN=PRJ-A123-ResourceSetReadOnly`, so she gets `member` access on login.
- Alice is removed from the AD group.
- On her next SSO login, her `member` row for `PRJ-A123` is deleted, but her `technical_lead` row remains untouched.

> **Operational note:** To remove a governance role, an admin or project editor must explicitly clear the corresponding field (e.g. `technicalLeadId`) in the project's Application Overview. The backend function `_sync_project_user_roles` runs only when that section is saved.

---

## Standard OIDC (Legacy)

For dex, Azure AD, Okta, Auth0, Keycloak, or any standard OIDC-compliant IdP.

### Environment variable reference

#### Frontend (`frontend/.env.local`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_OIDC_ISSUER` | Yes | OIDC issuer base URL | `https://login.microsoftonline.com/{tenant}/v2.0` |
| `VITE_OIDC_CLIENT_ID` | Yes | App registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `VITE_OIDC_REDIRECT_URI` | Yes | Post-login callback URL | `https://yourdomain.com/callback` |

#### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `OIDC_ISSUER` | _(empty)_ | Must match `VITE_OIDC_ISSUER` exactly |
| `OIDC_AUDIENCE` | `migration-hub` | Expected `aud` claim in the JWT |

> `OIDC_ISSUER` and `VITE_OIDC_ISSUER` must be **identical strings**. A mismatch causes JWT validation to fail with 401.

---

## Azure AD / Microsoft Entra ID

### 1. Register the app

1. Open **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Fill in:
   - **Name:** `Migration Hub`
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI:** Platform = `Single-page application (SPA)` → URI = `https://yourdomain.com/callback`
3. Click **Register**

### 2. Note the required values

From the app's **Overview** page:

- **Application (client) ID** → used for `VITE_OIDC_CLIENT_ID` and `OIDC_AUDIENCE`
- **Directory (tenant) ID** → used to construct the issuer URL

### 3. Verify API permissions

Under **API permissions**, confirm these delegated Microsoft Graph permissions are present (added by default):
- `openid`, `email`, `profile`

No admin consent is required for these standard OIDC scopes.

### 4. Set environment variables

**Frontend** (`frontend/.env.local`):
```
VITE_OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
VITE_OIDC_CLIENT_ID={application-client-id}
VITE_OIDC_REDIRECT_URI=https://yourdomain.com/callback
```

**Backend** (`backend/.env`):
```
OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
OIDC_AUDIENCE={application-client-id}
```

> **Important:** Azure AD sets the `aud` claim in JWTs to the **Application (client) ID** (a UUID). `OIDC_AUDIENCE` must be set to this UUID. The default value `migration-hub` will cause 401 on every login.

---

## Generic OIDC provider

For Okta, Google Workspace, Auth0, Keycloak, or any standard OIDC-compliant IdP:

### 1. Create an application in your IdP

- **Type:** Single Page Application (SPA) or Public client
- **Grant type:** Authorization Code + PKCE (no client secret required)
- **Redirect URI:** `https://yourdomain.com/callback`
- **Scopes:** `openid`, `email`, `profile`

### 2. Find the issuer URL

The issuer is the base URL for your IdP's OIDC discovery document. Verify it by fetching:
```
{issuer}/.well-known/openid-configuration
```

Common patterns:

| Provider | Issuer URL |
|---|---|
| Okta | `https://{your-domain}.okta.com/oauth2/default` |
| Google Workspace | `https://accounts.google.com` |
| Auth0 | `https://{your-domain}.auth0.com` |
| Keycloak | `https://{host}/realms/{realm}` |

### 3. Determine the audience value

`OIDC_AUDIENCE` must match the `aud` claim in the JWTs your provider issues. For most providers this equals the client ID. Decode a sample JWT at [jwt.io](https://jwt.io) to confirm.

### 4. Set environment variables

Same pattern as Azure AD — replace values with your provider's issuer and client ID.

---

## User provisioning

Resolution behavior depends on the auth mode:

| Mode | Provisioning |
|---|---|
| **Custom Enterprise OAuth** | **Auto-provisioning** — if the user is not found by email, a new row is created automatically from the OAuth userinfo (`staff_id`, `name`, `email`, `given_name`/`family_name` → initials). The global role and project memberships are derived from AD groups on the first login. |
| **Standard OIDC** | **No auto-provisioning** — the user must exist in the `users` table before their first login. Returns `401` if not found. |
| **Mock auth** | Returns the seeded `CURRENT_USER_ID` user. |

For OIDC and mock modes, seed users via `backend/seed_data/users.json` and run:

```bash
cd backend && python scripts/seed.py --force
```

The `email` scope must be requested and the IdP must include the `email` claim in the issued tokens.

---

## Production checklist

### If using Custom Enterprise OAuth
- [ ] `VITE_OAUTH_SERVICE_URL` and `OAUTH_SERVICE_URL` point to the real OAuth service
- [ ] `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` are production credentials
- [ ] `SESSION_SECRET_KEY` is a cryptographically random secret (≥32 bytes)
- [ ] `VITE_OAUTH_REDIRECT_URI` uses the production domain (not `localhost`)
- [ ] The OAuth service has the production callback URL registered
- [ ] `CORS_ORIGINS` in `backend/.env` includes the production frontend domain
- [ ] All users who will log in exist in the `users` table with matching email addresses
- [ ] `mock-oauth` and `dex` services removed from `backend/docker-compose.yml`
- [ ] `ENVIRONMENT=production` set in `backend/.env`
- [ ] Frontend bundle rebuilt after `.env` changes (Vite bakes env vars in at build time)

### If using Standard OIDC
- [ ] `VITE_OIDC_ISSUER` and `OIDC_ISSUER` are identical
- [ ] `VITE_OIDC_REDIRECT_URI` uses the production domain (not `localhost`)
- [ ] `OIDC_AUDIENCE` matches the `aud` claim in your provider's JWTs (verify with jwt.io)
- [ ] `CORS_ORIGINS` in `backend/.env` includes the production frontend domain
- [ ] All users who will log in exist in the `users` table with matching email addresses
- [ ] dex service removed from `backend/docker-compose.yml`
- [ ] `ENVIRONMENT=production` set in `backend/.env`
- [ ] Frontend bundle rebuilt after `.env` changes (Vite bakes env vars in at build time)

---

## Development: mock OAuth service (recommended)

For local development, a standalone mock OAuth service is included. It simulates the real enterprise OAuth flow exactly — including the backend-to-service `/userinfo` exchange.

```bash
# Start the mock OAuth service alongside the database
cd backend && docker compose up -d db mock-oauth

# Frontend env (frontend/.env.local)
VITE_API_BASE_URL=http://localhost:8000
VITE_OAUTH_SERVICE_URL=http://localhost:5557
VITE_OAUTH_CLIENT_ID=migration-hub
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback

# Backend env (backend/.env)
DATABASE_URL=postgresql+asyncpg://hub:<YOUR_DB_PASSWORD>@localhost/migration_hub
OAUTH_SERVICE_URL=http://localhost:5557
OAUTH_CLIENT_ID=migration-hub
OAUTH_CLIENT_SECRET=<YOUR_OAUTH_CLIENT_SECRET>
SESSION_SECRET_KEY=<YOUR_SESSION_SECRET_KEY>
SESSION_MAX_AGE_MINUTES=480
```

Mock users (select in the mock OAuth form):

| Email | Name | Role |
|---|---|---|
| henry.wilson@corp.com | Henry Wilson | Platform Migration Lead |
| alice.johnson@corp.com | Alice Johnson | Technical Lead |
| karen.lee@corp.com | Karen Lee | Business Owner |
| dan.brown@corp.com | Dan Brown | Viewer |

## Development: mock OIDC with dex (legacy)

The original dex-based mock is still available if you need to test standard OIDC behavior.

```bash
cd backend && docker compose up -d db dex
```

Set `VITE_OIDC_ISSUER=http://localhost:5556/dex` and `OIDC_ISSUER=http://localhost:5556/dex`.

### Customizing the mock password hash

The dex container now generates its config at startup via `mock-oidc/entrypoint.sh`. The bcrypt hash for all mock users defaults to a publicly known dev-only value. To use a different password, set `MOCK_DEX_PASSWORD_HASH` in `backend/.env` (or your shell environment) before starting the container:

```bash
# backend/.env
MOCK_DEX_PASSWORD_HASH='$2b$12$...your-hash...'
```

Generate a new hash with:

```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'<pw>', bcrypt.gensalt()).decode())"
```

If `MOCK_DEX_PASSWORD_HASH` is unset, the container falls back to the default dev hash.

> **Note:** The static file `mock-oidc/config.yaml` is no longer mounted by `docker-compose.yml`; it is kept in the repo only as a standalone reference for running dex directly without the entrypoint wrapper.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 after successful login (Custom OAuth) | `SESSION_SECRET_KEY` mismatch or expired token | Check backend logs; verify `SESSION_SECRET_KEY` is consistent across restarts |
| 401 after successful login (OIDC) | `OIDC_AUDIENCE` mismatch | Decode a JWT at jwt.io, check `aud` claim, update `OIDC_AUDIENCE` |
| "User not found" / 401 | Email not in `users` table | Insert a user row with the exact email the IdP/OAuth service sends |
| "Invalid authorization code" | Code already used or expired | Codes are one-time and expire in 5 minutes (mock) or per service policy |
| Redirect loop after `/callback` | Redirect URI not registered | Add the exact URI to your OAuth service's allowed redirect URIs |
| JWKS errors in backend logs | `OIDC_ISSUER` URL wrong | Fetch `{issuer}/.well-known/openid-configuration` in a browser to verify |
| Mock auth still active after setting env vars | Frontend `.env` not picked up | Restart Vite dev server; for production, rebuild the frontend bundle |
| `email` claim missing from JWT | IdP not including email | Ensure `email` scope is requested and included by the IdP |
