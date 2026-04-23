# OIDC Provider Configuration Guide

This guide is for operators deploying Migration Hub with a real enterprise SSO provider. No code changes are required — authentication is controlled entirely by environment variables.

---

## How the Toggle Works

| State | Behavior |
|---|---|
| `VITE_OIDC_ISSUER` is **empty** (default) | Mock auth mode — login bypasses OIDC; any user click logs in as the seeded dev user |
| `VITE_OIDC_ISSUER` is **set** | Real OIDC mode — "Login with Enterprise SSO" redirects to your IdP; backend validates the JWT |

Both frontend and backend must have matching issuer configuration.

---

## Environment Variables Reference

### Frontend (`frontend/.env`)

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `VITE_OIDC_ISSUER` | Yes | OIDC issuer base URL (triggers real auth mode) | `https://login.microsoftonline.com/{tenant}/v2.0` |
| `VITE_OIDC_CLIENT_ID` | Yes | App registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `VITE_OIDC_REDIRECT_URI` | Yes | Post-login callback URL (must be registered with your IdP) | `https://yourdomain.com/callback` |

### Backend (`backend/.env`)

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `OIDC_ISSUER` | Yes | Must match `VITE_OIDC_ISSUER` exactly | `https://login.microsoftonline.com/{tenant}/v2.0` |
| `OIDC_AUDIENCE` | Yes | Expected `aud` claim in the JWT | See provider-specific notes below |

> `OIDC_AUDIENCE` defaults to `migration-hub`. For most real providers this must be changed to your application's client ID.

---

## Azure AD / Microsoft Entra ID

### Step 1 — Register the app in Azure Portal

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Fill in:
   - **Name:** `Migration Hub` (or your preferred name)
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI:** Platform = `Single-page application (SPA)` → URI = `https://yourdomain.com/callback`
3. Click **Register**

### Step 2 — Note the required values

From the **Overview** page of your new app registration, copy:
- **Application (client) ID** — use for `VITE_OIDC_CLIENT_ID` and `OIDC_AUDIENCE`
- **Directory (tenant) ID** — used to construct the issuer URL

### Step 3 — Verify API permissions

Under **API permissions**, confirm these delegated permissions are present (they are added by default):
- `Microsoft Graph` → `openid`
- `Microsoft Graph` → `email`
- `Microsoft Graph` → `profile`

No admin consent is required for these standard OpenID Connect scopes.

### Step 4 — Set environment variables

**Frontend** (`frontend/.env`):
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

> **Important:** Azure AD sets the `aud` claim in JWTs to the **Application (client) ID** (a UUID), not the app name. `OIDC_AUDIENCE` must match this UUID exactly.

### Step 5 — Provision users

The backend looks up users by the `email` claim in the JWT. Every user who will log in must have a matching row in the `users` table.

Insert users directly or add them to `backend/seed_data/users.json` and re-run:
```bash
cd backend && python seed.py --force
```

### Step 6 — Remove dex in production

In `backend/docker-compose.yml`, remove or comment out the `dex` service. It is only needed for the mock development setup.

---

## Generic OIDC Provider

This covers any OIDC-compliant identity provider: Okta, Google Workspace, Auth0, Keycloak, Ping Identity, etc.

### Step 1 — Create an application in your IdP

Configure the application with:
- **Application type:** Single Page Application (SPA) or Public client
- **Grant type:** Authorization Code with PKCE (no client secret needed)
- **Redirect URI:** `https://yourdomain.com/callback`
- **Scopes:** `openid`, `email`, `profile`

### Step 2 — Find the issuer URL

The issuer is the base URL used to discover the OIDC configuration. Confirm it by fetching:
```
{issuer}/.well-known/openid-configuration
```

Common issuer URL patterns:

| Provider | Issuer URL pattern |
|---|---|
| Okta | `https://{your-domain}.okta.com/oauth2/default` |
| Google Workspace | `https://accounts.google.com` |
| Auth0 | `https://{your-domain}.auth0.com` |
| Keycloak | `https://{host}/realms/{realm}` |
| PingFederate | `https://{host}` |

### Step 3 — Determine the audience value

The `OIDC_AUDIENCE` backend setting must match the `aud` claim in the JWTs your provider issues. For most providers this equals the client ID, but check your provider's documentation to confirm.

You can decode a sample JWT at [jwt.io](https://jwt.io) to inspect the `aud` claim directly.

### Step 4 — Set environment variables

**Frontend** (`frontend/.env`):
```
VITE_OIDC_ISSUER={issuer-url}
VITE_OIDC_CLIENT_ID={your-client-id}
VITE_OIDC_REDIRECT_URI=https://yourdomain.com/callback
```

**Backend** (`backend/.env`):
```
OIDC_ISSUER={issuer-url}
OIDC_AUDIENCE={aud-claim-value}
```

### Step 5 — Confirm email claim is included

The backend extracts the `email` claim from the JWT to look up the user. Ensure your IdP includes `email` in the access token when the `email` scope is requested. If the claim is missing, login will fail with a 401 even though the IdP authentication succeeded.

### Step 6 — Provision users

Same as Azure AD — every user who will log in must have a row in the `users` table with a matching `email` value.

---

## Production Checklist

- [ ] `VITE_OIDC_ISSUER` and `OIDC_ISSUER` are identical
- [ ] `VITE_OIDC_REDIRECT_URI` uses the production domain (not `localhost`)
- [ ] `OIDC_AUDIENCE` matches the `aud` claim in your provider's JWTs
- [ ] `CORS_ORIGINS` in backend `.env` includes the production frontend domain
- [ ] All users who will log in exist in the `users` table with matching email addresses
- [ ] dex service removed from `backend/docker-compose.yml`
- [ ] `ENVIRONMENT=production` set in backend `.env`
- [ ] Frontend bundle rebuilt after `.env` changes (env vars are baked in at build time by Vite)

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| 401 after successful IdP login | `OIDC_AUDIENCE` mismatch | Decode a JWT at jwt.io, check the `aud` claim, update `OIDC_AUDIENCE` to match |
| "User not found" / 401 with no OIDC error | Email not in `users` table | Insert a user row with the exact email address the IdP sends in the `email` claim |
| Redirect loop after `/callback` | `VITE_OIDC_REDIRECT_URI` not registered in IdP | Add the exact URI to your IdP's allowed redirect URIs |
| JWKS fetch errors in backend logs | `OIDC_ISSUER` URL wrong | Fetch `{issuer}/.well-known/openid-configuration` in a browser to verify the URL |
| Mock auth still active after setting env vars | Frontend `.env` not picked up | Restart the Vite dev server; for production, rebuild the frontend bundle |
| `email` claim missing from JWT | IdP not including email scope | Ensure `email` scope is requested and that the IdP is configured to include it in tokens |
