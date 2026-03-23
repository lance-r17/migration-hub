# Mock Sync Status Consistency — Plan

## Context

Access control change to `CloudResourceEditDrawer` (spec: `2026-03-23-1200-cloud-resource-access-control`) made "Mark Sync Completed" only available post-sign-off. Mock data was inconsistent: pre-sign-off projects had `synced` resources. M-11029 needed more resources to exercise the new UI.

## Changes

**File:** `frontend/src/data/mock.ts`

### PRJ-2024-ALPHA (`in-progress`) — 8 resources fixed

| Resource | Was | Now |
|---|---|---|
| res2 — Primary Oracle DB | synced | out-of-sync |
| res4 — Static Assets Bucket | synced | out-of-sync |
| res-a7 — HR Module App Server | synced | out-of-sync |
| res-a11 — SFTP File Transfer Server | synced | provisioning |
| res-a14 — Audit Trail Database | synced | out-of-sync |
| res-a16 — Document Archive Store | synced | provisioning |
| res-a17 — Backup Vault (Cold) | synced | out-of-sync |
| res-a20 — Perimeter Firewall Cluster | synced | provisioning |

### M-77122 (`blocked`) — 1 resource fixed

| Resource | Was | Now |
|---|---|---|
| res7 — DNS Primary Cluster (APAC) | synced | out-of-sync |

### M-11029 (`signed-off`) — 4 resources added

| Resource | Category | syncStatus |
|---|---|---|
| res-m11-3 — OAuth Token Cache | VM | out-of-sync |
| res-m11-4 — Auth Audit Log Store | Buckets | provisioning |
| res-m11-5 — Identity Provider DB | Database | out-of-sync |
| res-m11-6 — Auth API Gateway | Network | synced |
