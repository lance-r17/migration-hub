# Standards for Projects Listing Page

No standards folder (`agent-os/standards/`) exists in this repository.

Relevant patterns observed in the codebase:
- Role checks use `user?.role.includes('platform_migration_lead')`
- Pages use `AppShell` for consistent layout
- shadcn/ui `Table` components are used for data tables
- Routes are wrapped in `ProtectedRoute` in `App.tsx`
