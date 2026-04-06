# Docs Update — Shaping Notes

## Scope

Update README.md and all docs/ files to reflect the staged email builder feature and email-server/ service.

## Decisions

- Did not create a new `docs/frontend/email-builder.md` — existing docs follow a flat structure covering all features inline; keeping that pattern
- `sendTestEmail` three-path dispatch is documented in services.md (the natural home for service behavior) rather than architecture.md
- Email server env vars are documented in both README and getting-started for discoverability
- Backend API section added for the email endpoints even though FastAPI backend doesn't exist yet — consistent with how all other endpoints are documented

## Context

- **Visuals:** None
- **References:** All 6 affected doc files read before editing
- **Product alignment:** Documentation-only change, no code impact
