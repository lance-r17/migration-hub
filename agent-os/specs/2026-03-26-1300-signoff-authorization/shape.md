# Sign-Off Authorization by Project Role — Shaping Notes

## Scope

Restrict the Sign-off button so only the explicitly assigned Technical Lead or Business Owner for a project can sign off their respective approval. Platform Migration Lead retains global sign-off authority.

## Decisions

- **Authorization source**: `applicationOverview.technicalLeadId` / `businessOwnerId` — not the approval `userId` field (which was stale placeholders), not the user's system role string
- **Logic placement**: `ProjectDetailsPage` (where `canSignOff` is computed) — one 3-line change
- **Mock data fix**: Replace `u-tech-lead`/`u-biz-owner` placeholder IDs in all approval entries with the real assigned user IDs from `applicationOverview`
- **devPersonas update**: Swap Sarah Jenkins (u1) for Karen Lee (u12) — Karen is the BO with a live pending sign-off on M-77122, making her the right persona for e2e testing

## Context

- **Visuals:** None
- **References:** ProjectDetailsPage.tsx lines 162–169 (canSignOff), mock.ts approvals arrays

## Standards Applied

- None (UI authorization logic only)
