# Login Page with Mock SSO — Shaping Notes

## Scope

Build a login page that simulates SSO before the real backend auth service is ready. Any credentials (or GitHub button) sign the user in as the mock current user (Henry Wilson). All existing routes are protected and redirect to `/login` when unauthenticated.

## Decisions

- Use `sessionStorage` for auth persistence — survives page refresh within the tab, resets on tab close
- Any credentials accepted in mock mode (simulates SSO — no credential validation needed)
- GitHub button treated identically to email/password form (both call mock login)
- No "Sign up" link — internal corporate tool
- Login page uses `<Logo>` + "Migration Hub" branding, consistent with sidebar
- Right panel is plain `bg-muted` — no placeholder image asset exists

## Context

- **Visuals:** None provided
- **References:** Provided login form and login page code by user
- **Product alignment:** Internal SPA for enterprise migration tracking; SSO is the eventual auth mechanism

## Standards Applied

None defined in agent-os/standards/
