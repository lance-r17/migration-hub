# Standards for OIDC Provider Configuration

No formal standards are defined in `agent-os/standards/` for this repository.

The implementation follows these external standards:
- **OAuth 2.1** — Authorization Code + PKCE for public SPA clients (no client secret)
- **OpenID Connect Core 1.0** — Standard claims (`email`, `iss`, `aud`, `exp`); JWKS endpoint for RS256 key distribution
- **RFC 8252** — OAuth 2.0 for Native Apps (redirect URI handling)
