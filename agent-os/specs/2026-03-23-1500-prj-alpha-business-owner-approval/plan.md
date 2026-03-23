# Update PRJ-2024-ALPHA Mock Data — Business Owner Approval

## Context

Project PRJ-2024-ALPHA mock data needed updating to reflect that both the Technical Lead and Business Owner have now approved. The Business Owner approval (`a2`) was `'waiting'` — updated to `'approved'` with approver and timestamp. Platform Migration Lead remains pending.

## Change

**File:** `frontend/src/data/mock.ts`

`a2` updated: `status: 'waiting'` → `status: 'approved'`, added `approver: 'Sarah Jenkins'`, `timestamp: 'Mar 22, 02:30 PM'`.
