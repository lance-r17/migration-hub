# Cloud Resource `needMigration` + Row-Click Edit Drawer

See the full implementation plan at `/home/node/.claude/plans/quizzical-noodling-book.md`.

## Summary

- Added `needMigration?: boolean` to `CloudResource` type
- Rows with `needMigration === false` render strikethrough + reduced opacity
- Clicking any row opens `CloudResourceEditDrawer` (read-only detail view + `needMigration` checkbox)
- "Mark Sync Completed" button appears in drawer footer when project is `in-progress` or `migrating`
