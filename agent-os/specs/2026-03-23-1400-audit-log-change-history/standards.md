# Standards for Audit Log — Change History

No `agent-os/standards/` directory exists. The following project-level conventions apply:

---

## Mock / Real API Dual Path

All service functions check `USE_MOCK` from `services/client.ts`:

```typescript
if (USE_MOCK) { await delay(); return store.X() }
return apiClient.method<T>(ENDPOINT)
```

The audit log service must follow this pattern exactly.

---

## Hook Pattern

Hooks use `useState` + `useEffect` + `useCallback`. Return `{ data, loading, error }`.
Loading starts `true`, set to `false` after first fetch (success or failure).
Use `cancelled` flag in `useEffect` cleanup to prevent stale updates.

---

## Component Conventions

- Tailwind CSS only — no inline styles
- Lucide icons via `lucide-react`
- shadcn/ui primitives (Sheet, Button, Skeleton, etc.)
- Design system tokens: `text-primary` (#0053db), `text-tertiary` (#006d4a), `bg-surface-*`
- No 1px borders — use `bg-border` dividers or shadow

---

## Type Conventions

- Types in `frontend/src/types/` — keep domain types separate
- No `any` — use `unknown` where type is uncertain
- IDs as `string` (UUID or slug)
- Timestamps as ISO 8601 strings

---

## REST API Contract (Backend)

```
GET /api/v1/projects/{id}/audit-log
  Query: page, limit (default 50), eventType[], startDate, endDate
  Response: { entries: AuditLogEntry[], total: number, page: number, limit: number }
```

PostgreSQL: `audit_log` table with `project_id` FK, `changes JSONB`, indexed on `(project_id, created_at DESC)`.
