# API Usage Samples

Practical examples for common integration tasks. All examples target `http://localhost:8000` — replace with your actual host.

For full endpoint reference see [api.md](api.md).

---

## Service Account Setup

Before automating API calls, create a service account (requires admin role):

```bash
# 1. Create the service account — returns the plaintext key once only
curl -s -X POST http://localhost:8000/api/v1/admin/service-accounts \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Inventory Sync Bot",
    "email": "svc-inventory@example.com",
    "department": "Platform"
  }' | jq .
```

```json
{
  "id": "svc-a1b2c3d4",
  "name": "Inventory Sync Bot",
  "email": "svc-inventory@example.com",
  "department": "Platform",
  "initials": "IS",
  "api_key": "mhub_9f3a1c...e72b"
}
```

Save `api_key` securely — it is never retrievable again. Use it as the `X-API-Key` header on all subsequent requests.

```bash
export API_KEY="mhub_9f3a1c...e72b"
export BASE="http://localhost:8000/api/v1"
export PROJECT_ID="PRJ-ABCD1234"
```

---

## Resource Management

`PATCH /projects/:id/sections/currentInfrastructure` is a **full replace** operation.
The backend diffs the submitted array against the current DB state:

- Resource in payload **without** an existing `id` → **created**
- Resource in payload **with** an existing `id` → **updated** (only changed fields are audited)
- Resource previously in DB **absent** from the payload → **deleted**

Send the complete desired final state in every call.

---

### Create resources (first sync)

```bash
curl -s -X PATCH "$BASE/projects/$PROJECT_ID/sections/currentInfrastructure" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "value": {
      "resources": [
        {
          "resourceId": "rm-bp1abc123456",
          "name": "prod-mysql-primary",
          "product": "rds",
          "resourceSet": "set-database",
          "needMigration": true,
          "syncStatus": "out-of-sync"
        },
        {
          "resourceId": "rm-bp1def789012",
          "name": "prod-mysql-replica",
          "product": "rds",
          "resourceSet": "set-database",
          "needMigration": true,
          "syncStatus": "out-of-sync"
        },
        {
          "resourceId": "oss-bucket-prod-assets",
          "name": "prod-oss-assets",
          "product": "oss",
          "resourceSet": "set-storage",
          "needMigration": false
        }
      ]
    }
  }' | jq '{id: .id, resources: [.cloudResources[] | {id, name, syncStatus}]}'
```

Each resource without an `id` field gets a UUID assigned by the server. The response is the full `Project` object. Note the assigned resourceIds for subsequent updates.

---

### Update specific resources

Use `PATCH /projects/:id/resources` to change only the fields you need on specific resources. Other fields on those resources, and all other resources in the project, are left untouched.

> All fields use **snake_case** (e.g. `sync_status`, `need_migration`).

```bash
# First fetch current resources to get their resourceIds
RESOURCES=$(curl -s "$BASE/projects/$PROJECT_ID" \
  -H "X-API-Key: $API_KEY" | jq '.cloudResources')

echo "$RESOURCES" | jq '[.[] | {resourceId, name, syncStatus}]'
```

```json
[
  { "resourceId": "rm-bp1abc123456", "name": "prod-mysql-primary",  "syncStatus": "out-of-sync" },
  { "resourceId": "rm-bp1def789012", "name": "prod-mysql-replica",  "syncStatus": "out-of-sync" },
  { "resourceId": "oss-bucket-prod-assets", "name": "prod-oss-assets",     "syncStatus": "out-of-sync" }
]
```

```bash
# Mark the primary as synced and set its target resource ID
curl -s -X PATCH "$BASE/projects/$PROJECT_ID/resources" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [
      {
        "resource_id": "rm-bp1abc123456",
        "sync_status": "synced",
        "target_resource_id": "rm-cn-hz-mysql-target-001",
        "migration_completed": true
      }
    ]
  }' | jq '[.cloudResources[] | {resourceId, name, syncStatus, targetResourceId, migrationCompleted}]'
```

Only the provided fields change on `rm-bp1abc123456`. The other two resources are completely unaffected.

---

### Delete resources

Use `DELETE /projects/:id/resources` to remove specific resources by their resource_id. IDs that don't belong to the project are silently skipped — safe to call with a list that may include already-deleted IDs.

```bash
curl -s -X DELETE "$BASE/projects/$PROJECT_ID/resources" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_ids": ["oss-bucket-prod-assets"]
  }' | jq '[.cloudResources[] | .name]'
# → prod-mysql-primary, prod-mysql-replica
```

The remaining resources stay exactly as they were — no need to resend their fields.

---

### Create, update, and delete in one call

Send the complete desired final state. The backend resolves adds, changes, and removals in a single transaction:

```bash
curl -s -X PATCH "$BASE/projects/$PROJECT_ID/sections/currentInfrastructure" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "value": {
      "resources": [
        {
          "resourceId": "rm-bp1abc123456",
          "name": "prod-mysql-primary",
          "product": "rds",
          "resourceSet": "set-database",
          "needMigration": true,
          "syncStatus": "synced",
          "targetResourceId": "rm-cn-hz-target-001"
        },
        {
          "resourceId": "r-kvstore-abc999",
          "name": "prod-redis-session",
          "product": "r-kvstore",
          "resourceSet": "set-cache",
          "needMigration": true,
          "syncStatus": "out-of-sync"
        }
      ]
    }
  }'
```

This call simultaneously:
- Updates `prod-mysql-primary` — sets `targetResourceId` (audit: `resource_updated`)
- Deletes `prod-mysql-replica` — absent from payload (audit: `resource_removed`)
- Creates `prod-redis-session` — new `resourceId` (audit: `resource_added`)

---

---

## Additional Resource Operations

The `PATCH /projects/:id/resources` endpoint can also create resources, and `POST /projects/:id/resources/specs` merges spec metadata without touching the resource list.

> All fields use **snake_case** (e.g. `sync_status`, `need_migration`).

### Create new resources without replacing existing ones

Omit `resource_id` (or provide a new one) to create. Existing resources are untouched:

```bash
curl -s -X PATCH "$BASE/projects/$PROJECT_ID/resources" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [
      {
        "resource_id": "r-kvstore-new-001",
        "name": "prod-redis-session",
        "product": "r-kvstore",
        "resource_set": "set-cache",
        "need_migration": true
      }
    ]
  }' | jq '.cloudResources | length'
# → previous count + 1
```

---

### Mixed: update some, create others in one call

```bash
curl -s -X PATCH "$BASE/projects/$PROJECT_ID/resources" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [
      {
        "id": "rm-bp1abc123456",
        "sync_status": "synced"
      },
      {
        "resource_id": "oss-bucket-logs",
        "name": "prod-oss-logs",
        "product": "oss",
        "resource_set": "set-storage",
        "need_migration": false
      }
    ]
  }'
```

Audit log will show one `resource_updated` (for the existing resource) and one `resource_added` (for the new one).

---

### Targeted update + delete as an alternative to full replace

Instead of sending the complete resource list (full replace), you can compose two targeted calls:

```bash
# Step 1: update the resources you want to change
curl -s -X PATCH "$BASE/projects/$PROJECT_ID/resources" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resources": [{"resource_id": "rm-bp1abc123456", "sync_status": "synced"}]}'

# Step 2: delete the resources you want to remove
curl -s -X DELETE "$BASE/projects/$PROJECT_ID/resources" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource_ids": ["rm-bp1def789012"]}'
```

This avoids the need to fetch the full current state before writing, which the full-replace endpoint requires.

---

### Update resource specs only (survey/scan data)

Use this endpoint when you only need to write spec metadata (sizing, survey answers) into existing resources without touching the resource list itself. The `specs` object is **merged**, not replaced.

```bash
curl -s -X POST "$BASE/projects/$PROJECT_ID/resources/specs" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "id": "rm-bp1abc123456",
        "specs": {
          "currentCpu": 8,
          "currentRam": "32GB",
          "currentStorage": "500GB",
          "engineVersion": "8.0.28",
          "characterSet": "utf8mb4"
        }
      },
      {
        "id": "rm-bp1def789012",
        "specs": {
          "currentCpu": 4,
          "currentRam": "16GB",
          "currentStorage": "500GB"
        }
      }
    ]
  }'
# → 204 No Content
```

> `id` is the internal `cloud_resources.id` UUID returned by the project API. It is **not** the cloud provider `resourceId`.

---

## Python Example

Full sync using `httpx` — fetches current resources, reconciles against a local inventory, and submits the diff as a single replace call:

```python
import httpx

BASE = "http://localhost:8000/api/v1"
API_KEY = "mhub_9f3a1c...e72b"
PROJECT_ID = "PRJ-ABCD1234"

HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# Local inventory from your CMDB / scan tool
LOCAL_INVENTORY = [
    {
        "resourceId": "rm-bp1abc123456",
        "name": "prod-mysql-primary",
        "product": "rds",
        "resourceSet": "set-database",
        "needMigration": True,
        "syncStatus": "out-of-sync",
    },
    {
        "resourceId": "r-kvstore-abc999",
        "name": "prod-redis-session",
        "product": "r-kvstore",
        "resourceSet": "set-cache",
        "needMigration": True,
        "syncStatus": "out-of-sync",
    },
]


def sync_resources(project_id: str, local_inventory: list[dict]) -> dict:
    with httpx.Client(base_url=BASE, headers=HEADERS) as client:
        # Fetch current state to check which resources already exist
        project = client.get(f"/projects/{project_id}").raise_for_status().json()
        existing_ids = {r["resourceId"] for r in project["cloudResources"]}

        # Build payload — resourceId is enough; no internal id needed
        payload = []
        for item in local_inventory:
            payload.append(dict(item))

        # Single replace call — adds new, updates existing, removes absent
        result = client.patch(
            f"/projects/{project_id}/sections/currentInfrastructure",
            json={"value": {"resources": payload}},
        ).raise_for_status().json()

        resources = result["cloudResources"]
        added = sum(1 for item in local_inventory if item["resourceId"] not in existing_ids)
        removed = len(existing_ids) - len(local_inventory) + added
        print(f"Synced {len(resources)} resource(s) for project {project_id} (added: {added}, removed: {removed})")
        return result


sync_resources(PROJECT_ID, LOCAL_INVENTORY)
```

---

## Verifying the Audit Trail

After any resource sync, confirm all operations were recorded:

```bash
curl -s "$BASE/projects/$PROJECT_ID/audit-log" \
  -H "X-API-Key: $API_KEY" | \
  jq '[.entries[] | select(.eventType | test("resource_")) | {
    eventType,
    entityLabel: .entityLabel,
    actor: .actor.name,
    actorType: (.actor.type // "user"),
    timestamp
  }]'
```

```json
[
  {
    "eventType": "resource_added",
    "entityLabel": "prod-redis-session",
    "actor": "Inventory Sync Bot",
    "actorType": "service_account",
    "timestamp": "2026-04-25T14:32:10.123Z"
  },
  {
    "eventType": "resource_removed",
    "entityLabel": "prod-mysql-replica",
    "actor": "Inventory Sync Bot",
    "actorType": "service_account",
    "timestamp": "2026-04-25T14:32:10.123Z"
  },
  {
    "eventType": "resource_updated",
    "entityLabel": "prod-mysql-primary",
    "actor": "Inventory Sync Bot",
    "actorType": "service_account",
    "timestamp": "2026-04-25T14:32:10.123Z"
  }
]
```

Service account actions appear with `actorType: "service_account"`, making them distinguishable from human edits in the audit log.
