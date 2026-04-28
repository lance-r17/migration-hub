# Custom Hooks

All hooks live in `frontend/src/hooks/`. They encapsulate all data fetching, mutations, and business logic. Components call hooks; they never call services directly.

---

## `useProjects`

```ts
import { useProjects } from '@/hooks/use-projects'

const { projects, loading, error } = useProjects()
```

Fetches all projects on mount. Used by `HomePage` and `ProjectsPage`.

**Returns:**

| Property | Type | Description |
|---|---|---|
| `projects` | `Project[]` | All projects the current user can see |
| `loading` | `boolean` | `true` while the initial fetch is in-flight |
| `error` | `string \| null` | Error message if the fetch failed |

---

## `useProject`

```ts
import { useProject } from '@/hooks/use-projects'

const { project, loading, error, saveSection, refreshProject } = useProject(id)
```

Fetches a single project by ID. Drives `ProjectDetailsPage`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string \| undefined` | Project ID from `useParams()` |

**Returns:**

| Property | Type | Description |
|---|---|---|
| `project` | `Project \| undefined` | The loaded project |
| `loading` | `boolean` | `true` during initial load |
| `error` | `string \| null` | Error message if load failed |
| `saveSection` | `<K extends keyof Project>(key: K, value: Project[K]) => Promise<void>` | Saves one section |
| `refreshProject` | `() => Promise<void>` | Re-fetches the project on demand |

**`saveSection` behavior:**

1. Applies an optimistic update to local state immediately
2. Calls `updateProject(id, key, value)` in the service layer
3. On success: updates local state with the server response and appends an audit log entry
4. On failure: rolls back to the pre-save snapshot and re-throws the error

It also classifies the change into the correct `AuditEventType`:

| Section key | Event type |
|---|---|
| `approvals` | `approval_submitted` |
| `risks` | `risk_created` / `risk_updated` / `risk_deleted` |
| `currentInfrastructure` | `resource_updated` / `resource_sync_completed` |
| `status` | `status_changed` |
| `waveId` | `wave_assigned` |
| `jiraSubtaskConfig` | `jira_story_created` |
| _anything else_ | `section_updated` |

**Jira polling:** while `project.jiraJobStatus` is `'pending'` or `'processing'`, the hook polls `getProject(id)` every 5 seconds and stops when the status changes.

---

## `useWaves`

```ts
import { useWaves } from '@/hooks/use-waves'

const { waves, loading, error, createWave, importWave } = useWaves()
```

Fetches all waves on mount and provides mutations. Used by `WavesPage`.

**Returns:**

| Property | Type | Description |
|---|---|---|
| `waves` | `Wave[]` | All migration waves |
| `loading` | `boolean` | `true` during initial fetch |
| `error` | `string \| null` | Error message if fetch failed |
| `createWave` | `(data: Omit<Wave, 'id' \| 'createdAt' \| 'jiraEpicKey'>) => Promise<Wave>` | Creates a new wave |
| `importWave` | `(epicKey: string) => Promise<Wave>` | Imports a wave from a Jira epic key |

Both `createWave` and `importWave` append the new wave to the local `waves` array on success.

---

## `useDashboard`

```ts
import { useDashboard } from '@/hooks/use-dashboard'

const { stats, activity, loading, error } = useDashboard()
```

Fetches overall stats and recent activity in parallel on mount. Used by `HomePage`.

**Returns:**

| Property | Type | Description |
|---|---|---|
| `stats` | `OverallStats \| undefined` | Aggregate migration statistics |
| `activity` | `Activity[]` | Recent activity entries for the timeline |
| `loading` | `boolean` | `true` while either request is in-flight |
| `error` | `string \| null` | Error message if either request failed |

---

## `useAuditLog`

```ts
import { useAuditLog } from '@/hooks/use-audit-log'

const { entries, loading, error, refresh } = useAuditLog(projectId)
```

Fetches audit log entries for a specific project, sorted newest-first.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `projectId` | `string \| undefined` | Project ID; hook is a no-op if undefined |

**Returns:**

| Property | Type | Description |
|---|---|---|
| `entries` | `AuditLogEntry[]` | All audit entries for the project |
| `loading` | `boolean` | `true` while fetching |
| `error` | `string \| null` | Error message if fetch failed |
| `refresh` | `() => void` | Manually re-fetches the log (e.g. after a save) |

---

## `useUsers`

```ts
import { useUsers } from '@/hooks/use-users'

const { users, loading, error } = useUsers()
```

Fetches all users. Typically used to populate people-picker dropdowns in drawers.

---

## `useProjectUsers`

```ts
import { useProjectUsers } from '@/hooks/use-users'

const { users, loading, error } = useProjectUsers(projectId)
```

Fetches only the users associated with a specific project (i.e. team members).

---

## `useIsMobile`

```ts
import { useIsMobile } from '@/hooks/use-mobile'

const isMobile = useIsMobile()   // true if viewport width < 768px
```

Listens to a media query and returns `true` on narrow viewports. Used to adjust layout behavior responsively.

---

## `useCurrentUser`

```ts
import { useCurrentUser } from '@/context/UserContext'

const { user, isAuthenticated, loading, login, logout } = useCurrentUser()
```

Reads from `UserContext`. This is the authoritative source of the authenticated user — use it anywhere a component needs to know who is logged in.

| Property | Type | Description |
|---|---|---|
| `user` | `User \| null` | Authenticated user, or `null` if not logged in |
| `isAuthenticated` | `boolean` | Whether a valid session exists |
| `loading` | `boolean` | `true` while the session is being restored on mount |
| `login` | `(user: User) => void` | Call after a successful auth response to set the session |
| `logout` | `() => void` | Clears session state and `sessionStorage` |
