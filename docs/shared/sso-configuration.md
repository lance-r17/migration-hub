# SSO / OIDC Configuration

Migration Hub supports enterprise Single Sign-On via OpenID Connect (OIDC). Authentication is controlled entirely by environment variables — no code changes are needed to switch between the mock development provider and a real enterprise IdP.

---

## How the toggle works

| State | Behavior |
|---|---|
| `VITE_OIDC_ISSUER` is **empty** (default) | Mock auth — any click on the login button signs in as the seeded dev user; no real IdP involved |
| `VITE_OIDC_ISSUER` is **set** | Real OIDC — "Login with Enterprise SSO" redirects to your IdP; the backend validates the returned JWT |

Both frontend and backend must have matching issuer configuration.

---

## Environment variable reference

### Frontend (`frontend/.env.local`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_OIDC_ISSUER` | Yes | OIDC issuer base URL — triggers real auth mode | `https://login.microsoftonline.com/{tenant}/v2.0` |
| `VITE_OIDC_CLIENT_ID` | Yes | App registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `VITE_OIDC_REDIRECT_URI` | Yes | Post-login callback URL (must match what is registered in your IdP) | `https://yourdomain.com/callback` |

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `OIDC_ISSUER` | _(empty)_ | Must match `VITE_OIDC_ISSUER` exactly |
| `OIDC_AUDIENCE` | `migration-hub` | Expected `aud` claim in the JWT — see provider notes below |

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

The backend looks up users by the `email` claim in the JWT. There is no auto-provisioning — every user who will log in must have a matching row in the `users` table before their first login attempt.

Add users to `backend/seed_data/users.json` and re-run the seed script:

```bash
cd backend && python scripts/seed.py --force
```

Or insert directly into the database.

The `email` scope must be requested and the IdP must include the `email` claim in the issued tokens.

---

## Production checklist

- [ ] `VITE_OIDC_ISSUER` and `OIDC_ISSUER` are identical
- [ ] `VITE_OIDC_REDIRECT_URI` uses the production domain (not `localhost`)
- [ ] `OIDC_AUDIENCE` matches the `aud` claim in your provider's JWTs (verify with jwt.io)
- [ ] `CORS_ORIGINS` in `backend/.env` includes the production frontend domain
- [ ] All users who will log in exist in the `users` table with matching email addresses
- [ ] dex service removed from `backend/docker-compose.yml`
- [ ] `ENVIRONMENT=production` set in `backend/.env`
- [ ] Frontend bundle rebuilt after `.env` changes (Vite bakes env vars in at build time)

---

## Development: mock OIDC with dex

For local development, a mock OIDC provider ([dex](https://dexidp.io)) is included. It simulates a real Azure AD flow so the auth code path is production-identical.

```bash
# Start dex alongside the database
cd backend && docker compose up -d db dex

# Frontend env (frontend/.env.local)
VITE_OIDC_ISSUER=http://localhost:5556/dex
VITE_OIDC_CLIENT_ID=migration-hub
VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback

# Backend env (backend/.env)
OIDC_ISSUER=http://localhost:5556/dex
```

Mock users (password for all: `Dev1234!`):

| Email | Name | Role |
|---|---|---|
| henry.wilson@corp.com | Henry Wilson | Platform Migration Lead |
| alice.johnson@corp.com | Alice Johnson | Technical Lead |
| karen.lee@corp.com | Karen Lee | Business Owner |
| dan.brown@corp.com | Dan Brown | Viewer |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 after successful IdP login | `OIDC_AUDIENCE` mismatch | Decode a JWT at jwt.io, check `aud` claim, update `OIDC_AUDIENCE` |
| "User not found" / 401 with no OIDC error | Email not in `users` table | Insert a user row with the exact email the IdP sends in the `email` claim |
| Redirect loop after `/callback` | Redirect URI not registered in IdP | Add the exact URI to your IdP's allowed redirect URIs |
| JWKS errors in backend logs | `OIDC_ISSUER` URL wrong | Fetch `{issuer}/.well-known/openid-configuration` in a browser to verify |
| Mock auth still active after setting env vars | Frontend `.env` not picked up | Restart Vite dev server; for production, rebuild the frontend bundle |
| `email` claim missing from JWT | IdP not including email in token | Ensure `email` scope is requested and included by the IdP |
