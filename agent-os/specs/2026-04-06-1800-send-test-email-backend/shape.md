# Send Test Email — Shaping Notes

## Scope

Make the "Send Test" button in `EmailPreviewPage.tsx` send a real HTML email to the entered address, using a local Node.js/Express server as the email relay.

## Decisions

- Used a dedicated `VITE_EMAIL_SERVER_URL` env var instead of `VITE_API_BASE_URL` so email sending can work independently without disabling all other mock data
- The email server only implements the one endpoint needed — no CRUD, no auth, no template storage
- Pre-rendered HTML is computed on the frontend (already available via `useMemo`) and passed to the server — server does not need to know about template structure
- Resolved subject line is computed in `handleSend` using the same regex already used in the sidebar preview

## Context

- **Visuals:** None
- **References:** `frontend/src/services/emailService.ts`, `frontend/src/pages/EmailPreviewPage.tsx`
- **Product alignment:** Dev/demo tooling; not a user-facing production flow
