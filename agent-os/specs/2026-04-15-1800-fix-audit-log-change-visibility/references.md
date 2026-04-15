# References for Fix Audit Log Change Visibility

## Similar Implementations

### Frontend mock diff path

- **Location:** `frontend/src/hooks/use-projects.ts:412–421`
- **Relevance:** Shows the correct approach — call `diffObjects(before, after, labelMap)` to produce field-level `AuditChange[]` before appending an audit entry. Backend should mirror this.
- **Key patterns:** Only append an entry when `changes.length > 0`; use a label map for human-readable field names

### `diffObjects` utility

- **Location:** `frontend/src/utils/diff.ts`
- **Relevance:** Full field-level diff implementation with camelCase→Title Case fallback; confirms the expected shape of each change object

### `fromApi` mapper

- **Location:** `frontend/src/services/auditLog.ts:9–15`
- **Relevance:** Reads `c.old_value` / `c.new_value` (snake_case) from API — backend must use these exact keys

### Audit schema

- **Location:** `backend/app/schemas/audit_log.py:12–16`
- **Relevance:** `AuditChange` Pydantic model uses `old_value` / `new_value` — confirms snake_case is the intended convention
