# Mock targetStatus Consistency — Plan

## Context

Previous fixes changed `syncStatus` from `synced` to `out-of-sync`/`provisioning` but left `targetStatus: 'Live'` unchanged, creating a new inconsistency.

## Rule Applied

- `syncStatus: 'synced'` → `targetStatus` ∈ Active category (`'Live'`, `'Ready'`, `'Active'`, `'Online'`)
- `syncStatus: 'out-of-sync'` or `'provisioning'` → `targetStatus` = `'Provisioning'`

## Changes (`frontend/src/data/mock.ts`) — 15 resources fixed

### PRJ-2024-ALPHA (`in-progress`)
res2, res4, res-a7, res-a10, res-a11, res-a14, res-a16, res-a17, res-a20, res-a22 → `targetStatus: 'Live'` → `'Provisioning'`

### M-11029 (`signed-off`)
res-m11-3, res-m11-4, res-m11-5 → `targetStatus: 'Live'` → `'Provisioning'`

### M-77122 (`blocked`)
res7, res9 → `targetStatus: 'Live'` → `'Provisioning'`

## Unchanged (already correct)
All `synced` resources keep `targetStatus: 'Live'` (res5, res6, res-m11-6).
All resources already showing `targetStatus: 'Provisioning'` are untouched.
