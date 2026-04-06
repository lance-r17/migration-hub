# Docs Update — Email Builder + Email Server

## Problem

All staged email builder work (EmailTemplatesPage, EmailBuilderPage, EmailPreviewPage, email-server/, emailService.ts, email types) was undocumented. README, getting-started, architecture, frontend overview, service layer reference, and backend API reference all predated the feature.

## Files Updated

| File | Changes |
|---|---|
| `README.md` | Email builder in key features; Node.js email server in tech stack; email-server/ in repo structure; 3 new routes; VITE_EMAIL_SERVER_URL env var |
| `docs/getting-started.md` | New "Email server (optional)" setup section; VITE_EMAIL_SERVER_URL in env vars table |
| `docs/architecture.md` | 3 new routes in routing table; email server API bypass explanation |
| `docs/frontend/overview.md` | Directory tree with email pages/components/types; routing section updated |
| `docs/frontend/services.md` | New emailService.ts section with function table and sendTestEmail 3-path dispatch |
| `docs/backend/api.md` | New Email Templates API section with 5 endpoints + send-test contract |
