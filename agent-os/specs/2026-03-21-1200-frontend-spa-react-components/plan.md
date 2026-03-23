# Plan: Convert Prototypes to Frontend React SPA

## Context

Three HTML/Tailwind prototypes exist in `prototypes/screens/`:
1. `01_home_dashboard.html` — Home with global progress bento grid, project cards, activity timeline, security health widget
2. `02_project_details.html` — Project detail page with 9 content sections + sign-off workflow bar + toast
3. `03_approval_modal.html` — Sign-off modal with left panel (vertical timeline step-map) + right panel (form)

The design system is "The Architectural Ledger" (see `prototypes/DESIGN.md`): tonal layering, no 1px borders, Inter font, a custom Professional Blues/Slates color palette, gradient primary buttons, status badges, and ambient shadows.

Goal: Scaffold a Vite + React + TypeScript SPA in `frontend/` that faithfully converts these prototypes into **individual, reusable React components** with Lucide icons replacing Material Symbols.

---

## Spec Folder

`agent-os/specs/2026-03-21-1200-frontend-spa-react-components/`

---

## Component Architecture

### Layout (shared shell)
| Component | File | Description |
|---|---|---|
| `AppShell` | `layout/AppShell.tsx` | Root layout: sidebar + top nav + main content slot |
| `TopNav` | `layout/TopNav.tsx` | Fixed header: logo, nav links, role toggle switcher, avatar |
| `Sidebar` | `layout/Sidebar.tsx` | Fixed left sidebar: nav items with icons, brand label |
| `MobileNav` | `layout/MobileNav.tsx` | Fixed bottom nav for small screens |

### Shared / Primitives
| Component | File | Description |
|---|---|---|
| `StatusBadge` | `shared/StatusBadge.tsx` | Colored badge: Migrating / Signed-off / Blocked / Planning / In Progress / Completed |
| `ProgressBar` | `shared/ProgressBar.tsx` | Thin bar with configurable color: primary gradient, tertiary, error |
| `TeamAvatars` | `shared/TeamAvatars.tsx` | Stacked avatar group with overflow count (+N) |
| `SectionCard` | `shared/SectionCard.tsx` | Card wrapper with icon + title header used by all detail sections |

### Home Page Components
| Component | File | Description |
|---|---|---|
| `OverallProgressCard` | `home/OverallProgressCard.tsx` | Large bento card: overall %, total assets, target cloud |
| `StatCard` | `home/StatCard.tsx` | Small bento card: icon + number + label (Completed / In Progress) |
| `ProjectCard` | `home/ProjectCard.tsx` | Project card: name, ID, status badge, progress bar, team avatars, CTA |
| `ActivityTimeline` | `home/ActivityTimeline.tsx` | Recent activity list with vertical connector line and status dot nodes |
| `SecurityHealthWidget` | `home/SecurityHealthWidget.tsx` | SOC2 readiness bar + compliance quote + report button |

### Project Detail Section Components
| Component | File | Description |
|---|---|---|
| `SignOffWorkflowBar` | `project/SignOffWorkflowBar.tsx` | Horizontal approval step-map with connector line and 3 nodes |
| `ApplicationOverviewSection` | `project/ApplicationOverviewSection.tsx` | Owner, dept, tech stack, migration strategy grid |
| `CloudResourcesSection` | `project/CloudResourcesSection.tsx` | Comparison table: resource name / category / existing / target / sync status |
| `RisksBlockersSection` | `project/RisksBlockersSection.tsx` | Risk items with severity border-left and badge |
| `DataSecuritySection` | `project/DataSecuritySection.tsx` | Encryption, compliance, backup key-value list |
| `AvailabilitySection` | `project/AvailabilitySection.tsx` | SLA, failover, RTO/RPO key-value list |
| `DependenciesSection` | `project/DependenciesSection.tsx` | Upstream / downstream dependency tags |
| `NonFunctionalRequirementsSection` | `project/NonFunctionalRequirementsSection.tsx` | 4-column grid: performance, operations, observability, governance |
| `MigrationCutoverSection` | `project/MigrationCutoverSection.tsx` | Execution windows, cutover strategy, stakeholders (3-col grid) |
| `TargetArchitectureSection` | `project/TargetArchitectureSection.tsx` | Architecture summary + migration constraints text areas |

### Modal
| Component | File | Description |
|---|---|---|
| `SignOffModal` | `modals/SignOffModal.tsx` | Two-panel dialog: left = vertical ApprovalTimeline; right = role selector + comment textarea + ack checkbox + actions |
| `ApprovalTimeline` | `modals/ApprovalTimeline.tsx` | Vertical step-map with connector line, used inside SignOffModal left panel |

### Toast
| Component | File | Description |
|---|---|---|
| `Toast` | `shared/Toast.tsx` | Dark floating toast: icon + title + subtitle + dismiss |

---

## Pages
| Page | File | Route | Notes |
|---|---|---|---|
| `HomePage` | `pages/HomePage.tsx` | `/` | Bento progress grid + project cards grid + activity + security widget |
| `ProjectDetailsPage` | `pages/ProjectDetailsPage.tsx` | `/projects/:id` | Breadcrumb + header + sign-off bar + all 9 section cards + sign-off modal |

---

## File Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts          ← full Architectural Ledger color palette
├── tsconfig.json
├── components.json             ← shadcn/ui config
└── src/
    ├── main.tsx
    ├── App.tsx                 ← BrowserRouter + routes
    ├── index.css               ← Tailwind directives + Inter font import
    ├── types/
    │   └── index.ts            ← Project, Resource, Approval, Risk types
    ├── data/
    │   └── mock.ts             ← Mock projects, resources, approvals
    ├── lib/
    │   └── utils.ts            ← cn() helper
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx
    │   │   ├── TopNav.tsx
    │   │   ├── Sidebar.tsx
    │   │   └── MobileNav.tsx
    │   ├── shared/
    │   │   ├── StatusBadge.tsx
    │   │   ├── ProgressBar.tsx
    │   │   ├── TeamAvatars.tsx
    │   │   ├── SectionCard.tsx
    │   │   └── Toast.tsx
    │   ├── home/
    │   │   ├── OverallProgressCard.tsx
    │   │   ├── StatCard.tsx
    │   │   ├── ProjectCard.tsx
    │   │   ├── ActivityTimeline.tsx
    │   │   └── SecurityHealthWidget.tsx
    │   ├── project/
    │   │   ├── SignOffWorkflowBar.tsx
    │   │   ├── ApplicationOverviewSection.tsx
    │   │   ├── CloudResourcesSection.tsx
    │   │   ├── RisksBlockersSection.tsx
    │   │   ├── DataSecuritySection.tsx
    │   │   ├── AvailabilitySection.tsx
    │   │   ├── DependenciesSection.tsx
    │   │   ├── NonFunctionalRequirementsSection.tsx
    │   │   ├── MigrationCutoverSection.tsx
    │   │   └── TargetArchitectureSection.tsx
    │   └── modals/
    │       ├── SignOffModal.tsx
    │       └── ApprovalTimeline.tsx
    └── pages/
        ├── HomePage.tsx
        └── ProjectDetailsPage.tsx
```

---

## Design System — Tailwind Config

The full custom color palette from the prototypes must be reproduced in `tailwind.config.ts`:
- All `surface-*`, `on-*`, `primary`, `secondary`, `tertiary`, `error-*` tokens
- Custom `borderRadius`: DEFAULT=0.125rem, lg=0.25rem, xl=0.5rem, full=0.75rem
- Font family: Inter for headline/body/label

CSS utilities to define in `index.css`:
- `.primary-gradient` — `background: linear-gradient(135deg, #0053db 0%, #0048c1 100%)`
- `.glass-card` — `background: rgba(255,255,255,0.7); backdrop-filter: blur(12px)`

---

## Icon Mapping (Material Symbols → Lucide)

| Material Symbol | Lucide Icon |
|---|---|
| `dashboard` | `LayoutDashboard` |
| `layers` | `Layers` |
| `database` | `Database` |
| `shield` | `Shield` |
| `assignment_turned_in` | `ClipboardCheck` |
| `help` | `HelpCircle` |
| `description` | `FileText` |
| `check_circle` | `CheckCircle2` |
| `pending` | `Clock` |
| `warning` | `AlertTriangle` |
| `add` | `Plus` |
| `download` | `Download` |
| `chevron_right` | `ChevronRight` |
| `done` / `check` | `Check` |
| `priority_high` | `AlertCircle` |
| `verified` / `verified_user` | `BadgeCheck` |
| `edit` | `Pencil` |
| `refresh` | `RefreshCw` |
| `sync_problem` | `AlertOctagon` |
| `close` | `X` |
| `engineering` | `Wrench` |
| `payments` | `CreditCard` |
| `cloud_done` | `CloudCheck` |
| `info` | `Info` |
| `security` | `Lock` |
| `bolt` | `Zap` |
| `link` | `Link2` |
| `assignment` | `FileCheck` |
| `event_available` | `CalendarCheck` |
| `architecture` | `Blocks` |
| `schedule` | `Clock` |
| `block` | `Ban` |
| `swap_calls` | `ArrowLeftRight` |
| `settings_backup_restore` | `RotateCcw` |
| `groups` | `Users` |
| `rule` | `ListChecks` |
| `notifications` | `Bell` |
| `help_outline` | `HelpCircle` |
| `circle` | `Circle` |
| `hourglass_empty` | `Hourglass` |
| `analytics` | `BarChart2` |
| `settings` | `Settings` |
| `account_tree` | `GitFork` |
| `insights` | `TrendingUp` |

---

## Dependencies to Install

```bash
# Core
npm create vite@latest frontend -- --template react-ts

# Routing
npm install react-router-dom

# Styling
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui
npm install @radix-ui/react-dialog @radix-ui/react-checkbox @radix-ui/react-select
npx shadcn@latest init

# Icons
npm install lucide-react

# Utilities
npm install clsx tailwind-merge
```

---

## Task Execution Order

### Task 1: Save Spec Documentation
Create `agent-os/specs/2026-03-21-1200-frontend-spa-react-components/` with:
- `plan.md` — full plan
- `shape.md` — shaping notes
- `references.md` — prototype file locations

### Task 2: Scaffold Vite Project
- Run `npm create vite@latest frontend -- --template react-ts` in `/workspaces/migration-hub/`
- Install all dependencies listed above
- Remove Vite boilerplate (App.css, assets/react.svg, contents of App.tsx)

### Task 3: Configure Tailwind + Design System
- Write `tailwind.config.ts` with full color palette, border radius, and font families
- Write `src/index.css` with Tailwind directives, Inter font import, `.primary-gradient` and `.glass-card` utilities

### Task 4: Configure shadcn/ui
- Run `npx shadcn@latest init` (choose appropriate options)
- Add needed components: `button`, `dialog`, `checkbox`, `textarea`, `select`, `table`, `badge`

### Task 5: Types + Mock Data
- Write `src/types/index.ts` — TypeScript interfaces for `Project`, `CloudResource`, `Approval`, `Risk`, `Activity`
- Write `src/data/mock.ts` — 4 mock projects matching prototype data, resources, approvals

### Task 6: Shared + Layout Components
- `lib/utils.ts` — `cn()` helper
- `shared/StatusBadge.tsx` — status → color mapping
- `shared/ProgressBar.tsx` — width % + color variant prop
- `shared/TeamAvatars.tsx` — stacked avatars + overflow count
- `shared/SectionCard.tsx` — card wrapper with Lucide icon + title slot + children
- `shared/Toast.tsx` — dark floating toast
- `layout/TopNav.tsx` — logo, nav links (active state), role toggle, avatar
- `layout/Sidebar.tsx` — nav items with Lucide icons, active highlight
- `layout/MobileNav.tsx` — bottom 4-item nav
- `layout/AppShell.tsx` — composes Sidebar + TopNav + `<main>` with correct padding

### Task 7: Home Page Components
- `home/OverallProgressCard.tsx` — spans 2 cols, progress bar, total assets
- `home/StatCard.tsx` — icon container + big number + label
- `home/ProjectCard.tsx` — full card matching prototype (all 4 status variants)
- `home/ActivityTimeline.tsx` — timeline with connector line + 3 event types
- `home/SecurityHealthWidget.tsx` — SOC2 bar + quote + button

### Task 8: Project Detail Section Components
Implement each section component faithfully from `02_project_details.html`:
- `project/SignOffWorkflowBar.tsx` — horizontal 3-node workflow (approved/in-review/pending states)
- `project/ApplicationOverviewSection.tsx`
- `project/CloudResourcesSection.tsx` — table with sync status icons
- `project/RisksBlockersSection.tsx` — risk items with critical/medium variants
- `project/DataSecuritySection.tsx`
- `project/AvailabilitySection.tsx`
- `project/DependenciesSection.tsx`
- `project/NonFunctionalRequirementsSection.tsx`
- `project/MigrationCutoverSection.tsx`
- `project/TargetArchitectureSection.tsx`

### Task 9: Sign-Off Modal
- `modals/ApprovalTimeline.tsx` — vertical step-map with connector line, 3 states (approved/active/pending)
- `modals/SignOffModal.tsx` — shadcn Dialog: left panel (ApprovalTimeline) + right panel (role buttons, textarea, checkbox, cancel/confirm actions)

### Task 10: Pages + Routing
- `pages/HomePage.tsx` — assembles bento grid (OverallProgressCard + 2 StatCards), projects grid, secondary grid (timeline + security widget)
- `pages/ProjectDetailsPage.tsx` — breadcrumb, header with Edit+SignOff buttons, SignOffWorkflowBar, 12-col bento grid of all sections, SignOffModal (toggled by Sign-off button), Toast
- `App.tsx` — BrowserRouter with routes: `/` → HomePage, `/projects/:id` → ProjectDetailsPage

---

## Verification

1. `cd frontend && npm run dev` — app starts on localhost:5173 without errors
2. Home page renders with project cards, progress bento, activity timeline
3. Clicking "View Details" on a project card navigates to the project details page
4. All 9 sections render on project details page
5. Clicking "Sign-off" opens the modal; clicking "Confirm Approval" closes it and shows the toast
6. Sidebar and top nav are visible on desktop; bottom nav shows on mobile
7. No TypeScript errors (`npm run build` succeeds)
