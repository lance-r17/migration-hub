# Plan: OAuth Userinfo Wrapped Format + AD Group Project Sync

## Problem / Feature
The OAuth service now returns userinfo in a wrapped paginated format:
```json
{
  "data": {
    "page_number": 1,
    "page_size": 10,
    "total": 1,
    "contents": [ { ...user... } ]
  },
  "messages": ""
}
```

The backend must:
1. Extract the real user from `data.contents[0]`
2. Map fields: `staff_id` → `id`, `name` → `name`, `email` → `email`, `given_name` + `family_name` → `initials`
3. Parse `member_of` AD group strings, filter by configurable regex + `OU=Ali` check, extract `{project_id}`
4. Re-sync the user's `project_users` associations on every login (role = `"member"`)

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-23-0644-oauth-userinfo-ad-sync/` with:
- **plan.md** — This full plan
- **shape.md** — Scope, decisions, context
- **standards.md** — Relevant standards (none in agent-os/standards/)
- **references.md** — Pointers to existing OAuth router, user service, project_user model

## Task 2: Update OAuth Userinfo Parsing & User Mapping

**File:** `backend/app/routers/oauth.py`

1. Parse wrapped response:
   ```python
   payload = resp.json()
   contents = payload.get("data", {}).get("contents", []) if isinstance(payload, dict) else []
   if not contents:
       raise HTTPException(...)
   raw_user = contents[0]
   ```

2. Extract fields:
   - `user_id = raw_user.get("staff_id")`
   - `email = raw_user.get("email")`
   - `name = raw_user.get("name")`
   - `given_name = raw_user.get("given_name", "")`
   - `family_name = raw_user.get("family_name", "")`
   - `initials = _derive_initials_from_names(given_name, family_name)`  # e.g. "Andy" + "ZHANG" → "AZ"

3. Update `_derive_initials` or add `_derive_initials_from_names(given, family)` helper.

4. User lookup/onboarding logic:
   - Look up by `email` (existing behavior)
   - If found: **update** `name`, `initials` from OAuth data (keep existing DB `id` — do NOT mutate PK)
   - If not found: **create** new `User(id=user_id, name=name, email=email, department="Unassigned", initials=initials, team=None, role=None)`

## Task 3: Add AD Group → Project Sync Logic

**Files:** `backend/app/config.py`, `backend/app/services/user_service.py`, `backend/app/routers/oauth.py`

1. **Config** (`backend/app/config.py`):
   - `oauth_ad_group_regex: str = r"CN=([^,]+)-ResourceSetReadOnly"`
   - `oauth_ad_group_ou_filter: str = "OU=Ali"`

2. **Service helper** (`backend/app/services/user_service.py`):
   Add `async def sync_user_projects(session, user_id, project_ids)`:
   - Delete all existing `ProjectUser` rows for `user_id`
   - For each `project_id` in `project_ids`:
     - Verify project exists (query `Project` by id)
     - If exists: create `ProjectUser(project_id=project_id, user_id=user_id, role="member")`
     - If missing: log warning and skip
   - Commit once

3. **Router integration** (`backend/app/routers/oauth.py`):
   After user lookup/creation:
   ```python
   member_of = raw_user.get("member_of", [])
   matched_project_ids = []
   regex = re.compile(settings.oauth_ad_group_regex)
   for group in member_of:
       if settings.oauth_ad_group_ou_filter and settings.oauth_ad_group_ou_filter not in group:
           continue
       m = regex.search(group)
       if m:
           matched_project_ids.append(m.group(1))
   
   await user_service.sync_user_projects(db, user.id, matched_project_ids)
   ```

## Task 4: Update Mock OAuth Service

**File:** `mock-oauth/main.py`

1. Change `MOCK_USERS` entries to include new fields:
   ```python
   {
       "staff_id": "u-current",
       "name": "Henry Wilson",
       "given_name": "Henry",
       "family_name": "Wilson",
       "email": "henry.wilson@corp.com",
       "member_of": [
           "CN=prj-1234-aaaa,OU=abcd,OU=Ali,OU=Application,OU=Groups,DC=InfoDir,DC=Prod,DC=xxxx",
       ],
   }
   ```

2. Change the `/userinfo` endpoint response from `return entry["user"]` to:
   ```python
   return {
       "data": {
           "page_number": 1,
           "page_size": 10,
           "total": 1,
           "contents": [entry["user"]],
       },
       "messages": "",
   }
   ```

## Task 5: Update Environment Configuration

**File:** `backend/.env.example`

Add:
```
# AD group filtering for project auto-assignment
# Regex must contain a capture group for the project_id
OAUTH_AD_GROUP_REGEX=CN=([^,]+)-ResourceSetReadOnly
# Substring that must be present in the member_of DN
OAUTH_AD_GROUP_OU_FILTER=OU=Ali
```

## Decisions

- **Re-sync every login**: On each SSO exchange, all existing `ProjectUser` rows for the user are deleted and re-created from the current `member_of` list. This ensures AD is the source of truth.
- **Role = "member"**: All AD-derived project associations get the static role `"member"`.
- **Preserve existing user PK**: If a user already exists in the DB (looked up by email), their `id` is NOT updated to `staff_id`. Only `name` and `initials` are refreshed. This avoids cascading FK issues.
- **Skip missing projects**: If the regex extracts a `project_id` that doesn't exist in the DB, log a warning and skip. Do not fail the login.
