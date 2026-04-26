# Block Project Dialog — Shaping Notes

## Scope

Add a confirmation Dialog to the "Block Project" button in `ProjectDetailsPage`. The button previously triggered `handleSave('status', 'blocked')` immediately on click. Now it opens a modal requiring the platform lead to enter a reason before confirming.

## Decisions

- **Reason is persisted**: The block reason is saved to the backend as `blocked_reason` on the project (not just a UX friction mechanism).
- **Single atomic API call**: `blockProject()` in the service layer calls `PATCH /projects/:id` with `{ status: 'blocked', blocked_reason }` in one request rather than two sequential section saves.
- **Reason cleared on unblock**: When the project is unblocked via "Unblock Project", `blocked_reason` is cleared server-side.
- **Confirm button disabled** when reason textarea is empty.
- **Dialog dismissal** resets the textarea state.

## Context

- **Visuals:** None provided
- **References:** `EmbargoSection.tsx:166-185` (delete confirmation dialog pattern), `SignOffModal.tsx` (comment field pattern)
- **Product alignment:** N/A
