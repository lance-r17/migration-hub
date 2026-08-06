# Frontend Best Practices

## Layering rule

Data flows in one direction only:

```
Page → Hook → Service → Store / HTTP
```

- **Pages** call hooks, receive data and callbacks, and pass them to components as props
- **Components** never import from `services/` or `data/`; they receive everything via props
- **Hooks** own all data fetching and mutation logic; they call services
- **Services** are the only code that touches `apiClient` or `store`

Breaking this rule makes the data flow hard to follow and makes mock/real switching fragile.

---

## Section save pattern

All project edits go through `saveSection(key, value)` from `useProject`. Never call `updateProject` from a component directly.

```ts
// In a drawer, after the user clicks Save:
await saveSection('applicationOverview', {
  ...project.applicationOverview,
  applicationName: newName,
})
```

`saveSection` handles optimistic update, API call, audit log, rollback, and toast notification in one place. Always pass the complete new value for the section (not a partial patch) because the audit diff compares old and new values field-by-field.

---

## Drawer state

Drawers are controlled with a single `boolean` state variable in the parent component:

```tsx
const [editingProfile, setEditingProfile] = useState(false)

<Button onClick={() => setEditingProfile(true)}>Edit</Button>

<ApplicationProfileDrawer
  open={editingProfile}
  onOpenChange={setEditingProfile}
  data={project.applicationOverview}
  onSave={async (updated) => {
    await saveSection('applicationOverview', updated)
    setEditingProfile(false)
  }}
/>
```

Do not use a string/enum to track which drawer is open unless the section genuinely has multiple independent drawers. Keep it simple.

---

## Form state in drawers

Drawers manage their own local form state. On open, they populate from the incoming `data` prop. On save, they call `onSave` with the merged result.

```tsx
const [appName, setAppName] = useState(data?.applicationName ?? '')

useEffect(() => {
  setAppName(data?.applicationName ?? '')
}, [data])   // re-sync when the drawer reopens with new data
```

Never directly mutate `project` state from inside a drawer. Always go through the `onSave` callback.

---

## Composing class names (`cn`)

Always use `cn()` from `src/lib/utils.ts` when combining Tailwind classes, especially when some classes are conditional:

```ts
import { cn } from '@/lib/utils'

<div className={cn('rounded-md border', isActive && 'border-primary', className)}>
```

`cn` calls `clsx` then `tailwind-merge`, which resolves conflicting Tailwind utilities correctly (e.g. `p-2` + `p-4` → `p-4` instead of both being present).

---

## Type-safe project section updates

`updateProject` and `saveSection` are generic over `keyof Project`:

```ts
saveSection('availability', {
  rto: '4h',
  rpo: '1h',
  availabilitySla: '99.9%',
  // TypeScript enforces the AvailabilityResilience shape here
})
```

This means the TypeScript compiler will catch mismatched section keys or wrong value shapes at build time.

---

## Audit log generation

Audit entries are generated automatically by `saveSection`. You do not need to write any audit logic in drawers or components.

However, if you add a new section key to `Project` that needs human-readable field labels in the audit log, add it to `FIELD_LABEL_MAPS` in `src/hooks/use-projects.ts`:

```ts
const FIELD_LABEL_MAPS: Partial<Record<keyof Project, Record<string, string>>> = {
  myNewSection: {
    fieldOne: 'Field One Label',
    fieldTwo: 'Field Two Label',
  },
}
```

Without a label map entry, labels fall back to `toLabel(key)` which converts camelCase to Title Case automatically.

---

## Role-based access

Check `user.role` from `useCurrentUser()` for feature gating. Keep role checks co-located with the feature they protect:

```tsx
const { user } = useCurrentUser()
const canEdit = user?.role === 'Platform Migration Lead' || project.team.some(m => m.id === user?.id)
```

Do not scatter role checks across multiple files for the same feature. If a route is completely inaccessible, add the check in the page component (see `WavesPage`).

---

## Protected routes

`ProtectedRoute` only checks authentication. Role-based restrictions are enforced inside the page:

```tsx
// In WavesPage.tsx
const { user } = useCurrentUser()
if (user?.role !== 'Platform Migration Lead') {
  return <AccessDenied />
}
```

---

## Adding a new project section

1. Define the TypeScript interface in `src/types/index.ts`
2. Add the field to `Project` in `src/types/index.ts`
3. Add seed data to `src/data/mock.ts`
4. Add a label entry to `SECTION_LABELS` and `FIELD_LABEL_MAPS` in `src/hooks/use-projects.ts`
5. Create a section display component in `src/components/project/`
6. Create an edit drawer in `src/components/drawers/`
7. Wire them into `ProjectDetailsPage.tsx`

---

## Adding a new drawer

1. Copy `SectionEditDrawer.tsx` as a starting template
2. Accept `open`, `onOpenChange`, `data`, and `onSave` as props
3. Manage all form state with `useState` + `useEffect` to sync from `data` on open
4. Call `onSave(mergedData)` in the footer Save button handler
5. The parent section component controls `open` state and calls `saveSection` in `onSave`

---

## Do not call `appendAuditEntryMock` directly

`appendAuditEntryMock` is an implementation detail of the mock mode. It is called internally by `saveSection`. If you call it from a component or a new hook, audit entries will be written twice or with incorrect context. All audit generation happens in `useProject`.

---

## Reports and exports

Export helpers live in `src/lib/export-report.ts`. They call service functions (e.g. `getProjects`, `getBgiHierarchy`) to build XLSX workbooks.

When adding fields that should appear in exports:

1. Add the column to the row object built inside the export function.
2. Add the matching header to the `headers` array (or rely on `json_to_sheet` object key order).
3. Update `worksheet['!cols']` so the new column is readable.

Score columns exported from `src/lib/scoring.ts` (e.g. **Infra Footprint**, **Migration Driver**) should call the same scoring utilities used in the UI so the spreadsheet stays consistent with the Projects table.

For project-level reports, include survey timestamps consistently:
- `Survey Submitted At` — application survey submission date.
- `Data Migration Survey Submitted At` — data migration survey submission date.

## Mock store is session-scoped

`src/data/store.ts` is an in-memory object initialized from `mock.ts` when the module first loads. It persists for the lifetime of the browser tab but resets on page reload. This is intentional for development. Do not rely on it for any persistence guarantees.
