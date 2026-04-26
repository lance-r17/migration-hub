# Audit Hardening & Service Account API — Shaping Notes

## Scope

Six audit/auth gaps identified by full endpoint analysis, plus Swagger improvements:

1. Two mutating endpoints (`POST /projects`, `PATCH .../planning`) had no `get_current_user` — callers unidentifiable
2. Four missing audit entries: project creation, survey submission, risk replacement, resource add/remove
3. No machine-to-machine API mechanism — external systems must share human credentials
4. Swagger UI exposed with no env-gating and no API-key security scheme

## Decisions

- **Service account storage**: Add two columns to existing `users` table (`is_service_account bool`, `api_key_hash varchar`) — simpler than a separate `api_keys` table; one static key per account is sufficient for v1
- **API key format**: `mhub_<64-hex>` prefix makes keys identifiable in logs/secrets scanners
- **Key storage**: SHA-256 of plaintext key; shown once on creation, never again
- **API-key auth priority**: Checked first (priority 0), before Bearer/OIDC/mock — simpler than merging with bearer logic
- **`APIKeyHeader` over raw `Header`**: FastAPI generates OpenAPI security scheme automatically, Swagger shows "Authorize" button
- **Actor `type` field**: Add `"type": "service_account"` to actor JSONB only for service accounts — backward compatible; human actors unchanged
- **Risk audit**: Single event (`risks_updated`) matching the `_replace_approvals` pattern — no per-risk diff for v1
- **Resource add/remove**: Add 5th element to `_classify_resource_changes` return tuple (`"added"/"removed"/"updated"`) — minimal surgical change to existing function
- **Swagger env-gating**: Disabled when `ENVIRONMENT=production`; enabled in all other environments

## Context

- **Visuals:** None
- **References:** `_replace_approvals()` in `project_service.py` — pattern for `risks_updated` event; `_classify_resource_changes()` — extended to return action string
- **Product alignment:** Supports governance/compliance requirements implicit in the sign-off workflow; auditable automated integrations align with Phase 2 roadmap (API integrations)

## Standards Applied

- N/A (no agent-os/standards/ directory exists in this project)
