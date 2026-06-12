# Batch Integration Guide

Practical Python recipes for automating project onboarding, governance assignment, and resource management via the Migration Hub REST API. All examples use `httpx` and target `http://localhost:8000/api/v1` - replace with your deployed backend URL.

For the full endpoint reference see [api.md](api.md). For cURL-based resource recipes see [samples.md](samples.md).

---

## Prerequisites

1. **Service account with API key**
   Create one via `POST /admin/service-accounts` (admin role required). Save the returned `api_key` - it is shown **once only**.

2. **Python dependencies**
   ```bash
   pip install httpx
   ```

3. **Environment**
   ```python
   import httpx

   BASE_URL = "http://localhost:8000/api/v1"
   API_KEY = "mhub_your_service_account_key_here"

   HEADERS = {
       "X-API-Key": API_KEY,
       "Content-Type": "application/json",
   }
   ```

> **Auth notes for automation**
> - `PUT /projects/{id}/project-user-roles` is **service-account only**.
> - `PUT /projects/{id}/governance-roles` requires the caller to have `platform_migration_lead` in their `role` string.
> - If your service account does not have the lead role, split scenario 2 into two passes: one with a lead's JWT for governance roles, and one with the service account key for project-user roles.

---

## Reusable client helper

```python
import httpx
from typing import Any

class MigrationHubClient:
    def __init__(self, base_url: str, api_key: str):
        self.client = httpx.Client(base_url=base_url, headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        })

    def get(self, path: str) -> dict:
        r = self.client.get(path)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, json: Any) -> dict:
        r = self.client.post(path, json=json)
        r.raise_for_status()
        return r.json()

    def patch(self, path: str, json: Any) -> dict:
        r = self.client.patch(path, json=json)
        r.raise_for_status()
        return r.json()

    def put(self, path: str, json: Any) -> dict:
        r = self.client.put(path, json=json)
        r.raise_for_status()
        return r.json()

    def close(self):
        self.client.close()


client = MigrationHubClient(BASE_URL, API_KEY)
```

---

## Scenario 1 - Batch create projects (one-off)

Create many projects up-front, using your own series ID as the project primary key. The ID follows the resource-set naming convention `{org}-{ba_id}-{app_name}-{env}` (e.g. `acme-123456-appone-prod`). The `name` field holds the human-readable application title.

Only `id` and `name` are required. `description` and `wave_id` are intentionally omitted here - they are filled in later (see Scenario 2 for description, and wave allocation is a manual decision by the Platform Migration Lead).

```python
import csv

PROJECT_CSV = """
project_id,name
acme-123456-appone-prod,App One Production
acme-123456-appone-dev,App One Development
acme-123457-apptwo-prod,App Two Production
""".strip()


def ensure_project(client: MigrationHubClient, project_id: str, name: str):
    """Create a project if it does not already exist."""
    try:
        existing = client.get(f"/projects/{project_id}")
        print(f"  SKIP {project_id} - already exists")
        return existing
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            payload = {
                "id": project_id,
                "name": name,
                "status": "planning",
            }
            created = client.post("/projects", json=payload)
            print(f"  CREATED {project_id}")
            return created
        raise


def batch_create_projects(csv_text: str):
    reader = csv.DictReader(csv_text.splitlines())
    for row in reader:
        ensure_project(client, project_id=row["project_id"], name=row["name"])


batch_create_projects(PROJECT_CSV)
```

**Key points**
- `POST /projects` accepts an optional `id`. When omitted the backend auto-generates one (`PRJ-{uuid}`).
- The helper first `GET`s the project so the script is safely re-runnable (idempotent one-off).
- Wave assignment (`wave_id`) is typically done manually by the Platform Migration Lead via the UI or a separate administrative process after project creation.

---

## Scenario 1b - Batch ensure users exist (one-off or regular refresh)

Before governance roles can be assigned, the target users must exist in the Migration Hub directory. `POST /admin/users/batch` creates any missing users and returns the full user record for every entry - including those that were skipped because they already exist.

> **Authorization:** This endpoint requires an **admin** role. If your service account is not an admin, perform this step with an admin user's JWT or create an admin-scoped service account first.

```python
import csv

USER_CSV = """
name,email,department,team
Alice Lead,alice.lead@example.com,Engineering,Platform
Bob Owner,bob.owner@example.com,Product,Strategy
Charlie ITSO,charlie.itso@example.com,Security,Compliance
""".strip()


def batch_ensure_users(csv_text: str) -> dict[str, dict]:
    """Upsert users from CSV and return a mapping email -> user dict."""
    rows = list(csv.DictReader(csv_text.splitlines()))
    payload = {
        "users": [
            {
                "name": r["name"],
                "email": r["email"],
                "department": r["department"],
                "team": r.get("team") or None,
            }
            for r in rows
        ]
    }
    result = client.post("/admin/users/batch", json=payload)
    print(f"  USERS created={result['created']} skipped={result['skipped']}")
    return {u["email"].lower(): u for u in result["users"]}


user_map = batch_ensure_users(USER_CSV)
```

**Key points**
- `id` is optional in the request; when omitted the backend generates one (`usr-{uuid}`).
- `initials` are auto-derived from `name` if not supplied.
- The `role` field on `User` is for **global roles** only (e.g. `admin`, `platform_migration_lead`). Governance roles such as `technical_lead`, `business_owner`, and `itso` are assigned per-project in Scenario 2 - do not set them here.
- Duplicate emails within the same batch are deduplicated automatically.
- The response `users` array preserves the same order as the request (minus duplicates), so you can reliably collect IDs for downstream governance assignment.

---

## Scenario 2 - Batch update application overview and assign governance roles (regular refresh)

Run this periodically to keep project metadata and team assignments in sync with your CMDB or identity store.

This scenario performs three operations per project:
1. Patch the `applicationOverview` JSONB section.
2. Assign governance roles (`technical_lead`, `business_owner`, `dba_data_owner`).
3. Assign project-level roles (`itso`, plus any additional roles) via `project-user-roles`.

```python
# Resolve users from the batch-ensure step (Scenario 1b)
# If you skipped Scenario 1b because the users already exist, you can look them up
# with GET /users and match by email instead.
lead_user = user_map.get("alice.lead@example.com")
owner_user = user_map.get("bob.owner@example.com")
itso_user = user_map.get("charlie.itso@example.com")

def refresh_project_metadata(project_id: str):
    print(f"Refreshing {project_id} ...")

    # Optional: supplement top-level fields (e.g. description) that were
    # omitted during bulk creation in Scenario 1.
    # client.patch(f"/projects/{project_id}", json={"description": "..."})

    # 1. Application overview -------------------------------------------------
    overview = {
        "applicationName": "App One",
        "shortName": "APP1",
        "businessFunction": "Core customer transaction processing",
        "userBase": {"type": "Internal", "count": "~1,200"},
        "applicationTier": "T1",
        "baId": "123456",
        "systemImportanceClassification": ["IBS"],
        "iitaApplicability": True,
        "softwareOrigin": "in-house",
        "migrationStrategy": "Lift & Shift",
        "serviceLine": "Engineering",
    }
    client.patch(f"/projects/{project_id}/sections/applicationOverview", json={"value": overview})

    # 2. Governance roles (requires platform_migration_lead role) ------------
    if lead_user and owner_user:
        client.put(
            f"/projects/{project_id}/governance-roles",
            json={
                "technicalLeadId": lead_user["id"],
                "businessOwnerId": owner_user["id"],
                # "dbaDataOwnerId": dba_user["id"]   # optional
            },
        )

    # 3. Project-user roles (service-account only) ---------------------------
    #    Each assignment replaces the roles for that user; unlisted users are untouched.
    assignments = []
    if itso_user:
        assignments.append({"user_id": itso_user["id"], "roles": ["itso"]})
    if lead_user:
        # It is common for the technical lead to also carry the ITSO hat
        assignments.append({"user_id": lead_user["id"], "roles": ["technical_lead", "itso"]})
    if owner_user:
        assignments.append({"user_id": owner_user["id"], "roles": ["business_owner"]})

    if assignments:
        client.put(f"/projects/{project_id}/project-user-roles", json=assignments)

    print(f"  DONE {project_id}")


# Run for every project created in scenario 1
for pid in ["acme-123456-appone-prod", "acme-123456-appone-dev", "acme-123457-apptwo-prod"]:
    refresh_project_metadata(pid)
```

**Key points**
- `PATCH /projects/{id}/sections/applicationOverview` replaces the entire JSONB blob. Always send the complete desired overview.
- Top-level fields such as `description` can also be patched here via `PATCH /projects/{id}` if they were left empty during bulk creation.
- `PUT /projects/{id}/governance-roles` updates the `project_users` table while preserving non-governance roles (e.g. `member`). Passing `null` for a role clears it.
- `PUT /projects/{id}/project-user-roles` is strictly for service accounts. An empty `roles` list (`[]`) removes that user from the project entirely.
- If a referenced user does not exist in the `users` table, the backend silently skips them (no error is raised for missing user IDs in the governance-role upsert).

---

## Scenario 2b - Batch assign BGI tiers to projects (one-off or regular refresh)

Projects can be linked to a **BGI (Global Business Identifier)** node in the organizational hierarchy. This assignment is used by the `bgi_cloud_lead` role to scope project visibility.

**Authorization:** `platform_migration_lead` or `admin` role required.

```python
import csv

BGI_ASSIGN_CSV = """
project_id,bgi_id
acme-123456-appone-prod,CTO-INFRA
acme-123456-appone-dev,CTO-INFRA
acme-123457-apptwo-prod,CTO-APPS
""".strip()


def batch_assign_bgi(csv_text: str):
    reader = csv.DictReader(csv_text.splitlines())
    for row in reader:
        project_id = row["project_id"]
        bgi_id = row["bgi_id"]
        try:
            client.post(
                "/bgi/assign-projects",
                json={"bgi_id": bgi_id, "project_ids": [project_id]},
            )
            print(f"  ASSIGNED {project_id} -> {bgi_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                print(f"  SKIP {project_id} — project or BGI node not found")
            else:
                raise


batch_assign_bgi(BGI_ASSIGN_CSV)
```

**Key points**
- `POST /bgi/assign-projects` accepts a `bgi_id` and a list of `project_ids`. Every project in the list is set to that `bgi_id`.
- `POST /bgi/unassign-projects` clears the `bgi_id` for the given projects (sets it to `null`).
- A project can belong to exactly one BGI node at a time; re-assigning overwrites the previous value.
- The BGI hierarchy itself is managed via `PUT /bgi` (see [api.md](api.md)) and is typically set up once via the Settings UI or a JSON import.

**Read-back:** After assignment, each project list item includes `bgi_id`:
```python
projects = client.get("/projects")
for p in projects:
    print(f"{p['id']}: bgi_id={p.get('bgi_id')}")
```

---

## Scenario 3 - Batch add resources to projects (on-demand)

Import a discovered inventory into existing projects without touching resources that are already tracked. `PATCH /projects/{id}/resources` is an **upsert**: existing `resource_id`s are updated, missing ones are created, and anything not in the payload is left alone.

```python
import csv

RESOURCE_CSV = """
project_id,resource_id,name,product,resource_set
acme-123456-appone-prod,rm-bp1abc123456,prod-mysql-primary,rds,acme-123456-appone-prod
acme-123456-appone-prod,rm-bp1def789012,prod-mysql-replica,rds,acme-123456-appone-prod
acme-123456-appone-prod,oss-bucket-prod-assets,prod-oss-assets,oss,acme-123456-appone-prod
acme-123457-apptwo-prod,rm-cn-hz-redis-001,prod-redis-session,r-kvstore,acme-123457-apptwo-prod
""".strip()


def batch_upsert_resources(csv_text: str):
    # Group rows by project
    buckets: dict[str, list[dict]] = {}
    for row in csv.DictReader(csv_text.splitlines()):
        pid = row["project_id"]
        buckets.setdefault(pid, []).append(row)

    for pid, rows in buckets.items():
        resources = []
        for r in rows:
            resources.append({
                "resource_id": r["resource_id"],
                "name": r["name"],
                "product": r.get("product"),
                "resource_set": r.get("resource_set"),
                "sync_status": "out-of-sync",
                "need_migration": True,
            })

        result = client.patch(
            f"/projects/{pid}/resources",
            json={"resources": resources},
        )
        print(f"  {pid}: {len(result['cloudResources'])} total resource(s)")


batch_upsert_resources(RESOURCE_CSV)
```

**Key points**
- The endpoint uses **snake_case** fields (`resource_id`, `resource_set`, `sync_status`, `need_migration`).
- Because untouched resources are preserved, this call is safe to run repeatedly with newly discovered assets.
- `sync_status` defaults to `"out-of-sync"` if omitted.

---

## Scenario 4 - Partially update resources (target resource ID, sync status)

After migration work completes, push back the target resource identifier and sync state without resending the full resource list.

### 4a. Targeted field update

```python
def patch_resource_fields(project_id: str, resource_id: str, target_id: str, sync_status: str):
    client.patch(
        f"/projects/{project_id}/resources",
        json={
            "resources": [
                {
                    "resource_id": resource_id,
                    "target_resource_id": target_id,
                    "sync_status": sync_status,
                }
            ]
        },
    )
    print(f"  Updated {resource_id} -> target={target_id}, sync={sync_status}")


patch_resource_fields(
    "acme-123456-appone-prod",
    "rm-bp1abc123456",
    target_id="rm-cn-hz-mysql-target-001",
    sync_status="synced",
)
```

### 4b. Mark sync complete (with Jira subtask closure)

If the resource has a `jiraSubtaskKey`, calling the dedicated endpoint queues a background job to close the subtask and sets `migrationCompleted = true`.

```python
def mark_sync_complete(project_id: str, resource_id: str):
    result = client.post(
        f"/projects/{project_id}/resources/{resource_id}/sync-complete",
        json=None,
    )
    print(f"  Sync complete for {resource_id}; project status is now {result['status']}")


mark_sync_complete("acme-123456-appone-prod", "rm-bp1abc123456")
```

### 4c. Update resource specs only

When your scan tool produces new sizing or survey data, merge it into existing resources without touching the resource list itself.

```python
def patch_resource_specs(project_id: str, updates: list[dict]):
    """updates: [{"resource_id": "...", "specs": {...}}]"""
    r = client.client.post(
        f"/projects/{project_id}/resources/specs",
        headers=HEADERS,
        json={"updates": updates},
    )
    r.raise_for_status()
    print(f"  Merged specs for {len(updates)} resource(s) -> 204")


patch_resource_specs("acme-123456-appone-prod", [
    {
        "resource_id": "rm-bp1abc123456",
        "specs": {
            "currentCpu": 8,
            "currentRam": "32GB",
            "currentStorage": "500GB",
            "engineVersion": "8.0.28",
        },
    },
    {
        "resource_id": "rm-bp1def789012",
        "specs": {
            "currentCpu": 4,
            "currentRam": "16GB",
            "currentStorage": "500GB",
        },
    },
])
```

**Key points**
- Only the fields you include in the payload are changed; everything else on that resource stays as-is.
- `sync-complete` is the preferred endpoint when a resource finishes migration. It also derives the parent project's status from the latest stage progress.
- `POST /projects/{id}/resources/specs` merges the `specs` dict deeply (existing keys are overwritten, missing keys are preserved).

---

## Scenario 5 — Reset a project (administrative)

When a project needs to restart from scratch — for example, after a failed migration pilot or a major scope change — you can reset it without losing its identity, team assignments, cloud resources, or attachments.

**Authorization:** Requires `platform_migration_lead` role.

```python
def reset_project(project_id: str):
    result = client.post(f"/projects/{project_id}/reset", json=None)
    print(f"  RESET {project_id} -> status={result['status']}")
    return result


reset_project("acme-123456-appone-prod")
```

**What is preserved**
- `name`, `description`
- `applicationOverview` (the project's identity and BA metadata)
- `project_users` (governance roles and ITSO assignments)
- `cloud_resources` (current infrastructure inventory)
- `attachments`
- `wave_id` / `migration_wave`

**What is cleared**
- `status` → `"planning"`
- `blocked_reason`, `survey_submitted_at`, `planning`
- All other JSONB sections: `availability`, `data_persistence`, `dependencies`, `nfrs`, `migration_constraints`, `target_architecture`, `migration_effort_estimation`, `jira_subtask_config`
- `jira_story_key`, `jira_job_status`
- All `risks` and `approvals`
- The **entire audit history** for the project (a single `project_reset` event remains)

**Key points**
- This is a destructive administrative action. The confirmation dialog in the UI warns users that the change history will also be removed.
- After a reset, the project behaves like a freshly created project: stage progress reverts to `setup` only, and sign-off must be re-collected from the beginning.
- Because `cloud_resources` are preserved, any already-discovered inventory does not need to be re-imported.

---

## End-to-end script template

Combine all scenarios into a single runnable script:

```python
#!/usr/bin/env python3
"""Migration Hub batch onboarding pipeline.

Scenario order:
  1. Create projects (one-off)
  1b. Ensure users exist (one-off or regular)
  2. Refresh metadata + governance (regular)
  2b. Assign BGI tiers (one-off or regular)
  3. Add discovered resources (on-demand)
  4. Update resource state post-migration (on-demand)
  5. Reset project (administrative — optional)
"""
import csv
import httpx

BASE_URL = "http://localhost:8000/api/v1"
API_KEY = "mhub_your_service_account_key_here"

HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}


class MigrationHubClient:
    def __init__(self, base_url: str, api_key: str):
        self.client = httpx.Client(base_url=base_url, headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        })

    def get(self, path: str) -> dict:
        r = self.client.get(path)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, json=None) -> dict:
        r = self.client.post(path, json=json)
        r.raise_for_status()
        return r.json()

    def patch(self, path: str, json=None) -> dict:
        r = self.client.patch(path, json=json)
        r.raise_for_status()
        return r.json()

    def put(self, path: str, json=None) -> dict:
        r = self.client.put(path, json=json)
        r.raise_for_status()
        return r.json()

    def close(self):
        self.client.close()


def main():
    client = MigrationHubClient(BASE_URL, API_KEY)
    try:
        # 1. Create projects
        for pid, name in [
            ("acme-123456-appone-prod", "App One Production"),
            ("acme-123456-appone-dev", "App One Development"),
        ]:
            try:
                client.get(f"/projects/{pid}")
                print(f"EXISTS {pid}")
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    client.post("/projects", json={"id": pid, "name": name, "status": "planning"})
                    print(f"CREATED {pid}")
                else:
                    raise

        # 1b. Ensure governance users exist (admin role required)
        user_result = client.post("/admin/users/batch", json={
            "users": [
                {"name": "Alice Lead", "email": "alice.lead@example.com", "department": "Engineering"},
                {"name": "Bob Owner", "email": "bob.owner@example.com", "department": "Product"},
                {"name": "Charlie ITSO", "email": "charlie.itso@example.com", "department": "Security"},
            ]
        })
        user_map = {u["email"].lower(): u for u in user_result["users"]}
        print(f"USERS ensured: created={user_result['created']} skipped={user_result['skipped']}")

        # 2. Refresh metadata + governance
        for pid in ["acme-123456-appone-prod", "acme-123456-appone-dev"]:
            client.patch(
                f"/projects/{pid}/sections/applicationOverview",
                json={"value": {"applicationName": "App One", "baId": "123456"}},
            )
            print(f"OVERVIEW {pid}")

            # Governance roles (requires platform_migration_lead role)
            lead = user_map.get("alice.lead@example.com")
            owner = user_map.get("bob.owner@example.com")
            itso = user_map.get("charlie.itso@example.com")
            if lead and owner:
                client.put(
                    f"/projects/{pid}/governance-roles",
                    json={"technicalLeadId": lead["id"], "businessOwnerId": owner["id"]},
                )
            # Project-user roles (service-account only)
            assignments = []
            if itso:
                assignments.append({"user_id": itso["id"], "roles": ["itso"]})
            if lead:
                assignments.append({"user_id": lead["id"], "roles": ["technical_lead", "itso"]})
            if owner:
                assignments.append({"user_id": owner["id"], "roles": ["business_owner"]})
            if assignments:
                client.put(f"/projects/{pid}/project-user-roles", json=assignments)
            print(f"GOVERNANCE {pid}")

        # 2b. Assign BGI tiers (requires platform_migration_lead role)
        # client.post("/bgi/assign-projects", json={
        #     "bgi_id": "CTO-INFRA",
        #     "project_ids": ["acme-123456-appone-prod", "acme-123456-appone-dev"],
        # })
        # print("BGI assigned")

        # 3. Add resources
        client.patch(
            "/projects/acme-123456-appone-prod/resources",
            json={
                "resources": [
                    {
                        "resource_id": "rm-bp1abc123456",
                        "name": "prod-mysql-primary",
                        "product": "rds",
                        "resource_set": "acme-123456-appone-prod",
                        "sync_status": "out-of-sync",
                        "need_migration": True,
                    }
                ]
            },
        )
        print("RESOURCES added")

        # 4. Partial resource update
        client.patch(
            "/projects/acme-123456-appone-prod/resources",
            json={
                "resources": [
                    {
                        "resource_id": "rm-bp1abc123456",
                        "target_resource_id": "rm-cn-hz-target-001",
                        "sync_status": "synced",
                    }
                ]
            },
        )
        print("RESOURCE patched")

        # 5. Reset project (administrative — optional)
        # Uncomment to restart a project from scratch while preserving
        # application overview, team, resources, and attachments.
        # client.post("/projects/acme-123456-appone-prod/reset", json=None)
        # print("PROJECT reset")
    finally:
        client.close()


if __name__ == "__main__":
    main()
```

---

## Error handling quick reference

| Status | Typical cause |
|---|---|
| `400` | Validation error (e.g. invalid section key, approval sequence violation) |
| `401` | Missing or invalid API key / Bearer token |
| `403` | Insufficient role (e.g. non-service account calling `project-user-roles`) |
| `404` | Project, user, or resource not found |
| `422` | Pydantic validation failure (check request body shape and types) |

Wrap mutating calls in `try/except httpx.HTTPStatusError` and inspect `e.response.json()["detail"]` for the server message.
