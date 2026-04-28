# Scrollbar Design Specification

> **Status:** Design Review  
> **Scope:** Application-wide scrollbar enhancement  
> **Target:** Slim, transparent-background scrollbars with refined micro-interactions

---

## 1. Design Philosophy

### Goals
- **Invisible until needed:** Scrollbars should not compete with content for attention
- **Context-aware:** Color adapts to light/dark surfaces automatically
- **Premium feel:** Subtle transparency, smooth state transitions, consistent radius language
- **Zero layout shift:** Track is transparent; only the thumb occupies space

### Principles
1. **Restraint** — The scrollbar is a navigational aid, not a decorative element
2. **Continuity** — Same interaction model across every scrollable surface
3. **Accessibility** — Visible enough when needed; respects `prefers-reduced-motion`
4. **Theme coherence** — Colors derived from existing CSS custom properties

---

## 2. Visual Specification

### 2.1 Anatomy

```
┌─────────────────────────────┐
│  Track (transparent)        │
│  ┌─────────────────────┐    │
│  │  Thumb              │    │ ← 6px width, rounded
│  │  (scrollable area)  │    │ ← opacity 0 → visible on hover
│  └─────────────────────┘    │
│                             │
│  Corner (transparent)       │
└─────────────────────────────┘
```

### 2.2 Dimensions

| Property | Value | Notes |
|---|---|---|
| Thumb width | `6px` | Slim, modern profile |
| Thumb min-height | `32px` | Prevents vanishing on long pages |
| Thumb border-radius | `9999px` | Fully rounded (pill shape) |
| Track width | `6px` | Matches thumb; transparent fill |
| Track padding | `2px` | Creates 1px gutter on each side |
| Corner size | `6px × 6px` | Transparent |

### 2.3 Color System

Colors are derived from existing CSS variables to guarantee harmony across themes.

#### Light Mode (`:root`)

| State | Thumb Color | Opacity | CSS Equivalent |
|---|---|---|---|
| **Rest** (no scroll activity) | `hsl(28.57 16.54% 24.90%)` | `0.12` | `hsl(var(--foreground) / 0.12)` |
| **Hover** (thumb or track) | `hsl(28.57 16.54% 24.90%)` | `0.28` | `hsl(var(--foreground) / 0.28)` |
| **Active** (dragging) | `hsl(28.57 16.54% 24.90%)` | `0.40` | `hsl(var(--foreground) / 0.40)` |
| **Track** | transparent | `0` | — |
| **Corner** | transparent | `0` | — |

#### Dark Mode (`.dark`)

| State | Thumb Color | Opacity | CSS Equivalent |
|---|---|---|---|
| **Rest** | `hsl(39 34.48% 88.63%)` | `0.14` | `hsl(var(--foreground) / 0.14)` |
| **Hover** | `hsl(39 34.48% 88.63%)` | `0.32` | `hsl(var(--foreground) / 0.32)` |
| **Active** | `hsl(39 34.48% 88.63%)` | `0.45` | `hsl(var(--foreground) / 0.45)` |
| **Track** | transparent | `0` | — |
| **Corner** | transparent | `0` | — |

> **Rationale:** Light mode uses slightly lower rest opacity because dark thumbs on light backgrounds are naturally more visible. Dark mode bumps rest opacity slightly to compensate for light thumbs on dark backgrounds.

### 2.4 Transitions

| Property | Duration | Easing |
|---|---|---|
| Thumb opacity (rest → hover) | `150ms` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Thumb opacity (hover → active) | `80ms` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Thumb width (on hover) | `150ms` | `cubic-bezier(0.4, 0, 0.2, 1)` |

**Width expansion behavior (optional enhancement):**
- Rest: `6px`
- Hover: `8px` (thumb subtly grows, giving a "magnetic" feel)
- Active: `8px`

> If width expansion is implemented, the track should also expand from `6px` to `8px` so content does not reflow.

---

## 3. CSS Implementation Strategy

### 3.1 Global WebKit Scrollbar Styles

Add to `frontend/src/index.css` inside the existing `@layer base` block:

```css
@layer base {
  /* ── Scrollbar Design System ── */

  /* WebKit (Chrome, Safari, Edge) */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: hsl(var(--foreground) / 0.12);
    border-radius: 9999px;
    border: 1px solid transparent; /* creates 1px gutter via background-clip */
    background-clip: padding-box;
    min-height: 32px;
    transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1),
                width 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--foreground) / 0.28);
  }

  ::-webkit-scrollbar-thumb:active {
    background: hsl(var(--foreground) / 0.40);
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* Dark mode overrides */
  .dark ::-webkit-scrollbar-thumb {
    background: hsl(var(--foreground) / 0.14);
  }

  .dark ::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--foreground) / 0.32);
  }

  .dark ::-webkit-scrollbar-thumb:active {
    background: hsl(var(--foreground) / 0.45);
  }

  /* Firefox (standard properties) */
  * {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--foreground) / 0.12) transparent;
  }

  .dark * {
    scrollbar-color: hsl(var(--foreground) / 0.14) transparent;
  }

  /* Respect user preference for reduced motion */
  @media (prefers-reduced-motion: reduce) {
    ::-webkit-scrollbar-thumb {
      transition: none;
    }
  }

  /* Existing base rules */
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### 3.2 Tailwind Utility Classes

Add custom utilities to `index.css` (or a new `scrollbar.css`) so components can opt into specific scrollbar behaviors:

```css
@layer utilities {
  /* Hide scrollbar entirely (replaces ad-hoc scrollbar-none) */
  .scrollbar-hidden {
    scrollbar-width: none;
  }
  .scrollbar-hidden::-webkit-scrollbar {
    display: none;
  }

  /* Always-visible scrollbar (for dense data UIs) */
  .scrollbar-stable {
    scrollbar-gutter: stable;
  }

  /* Horizontal-only scrollbar styling */
  .scrollbar-x ::-webkit-scrollbar {
    height: 4px;
  }
  .scrollbar-x ::-webkit-scrollbar-thumb {
    min-height: auto;
    min-width: 32px;
  }
}
```

---

## 4. Component-Specific Rules

### 4.1 Global Default
Every scrollable container gets the slim styled scrollbar by default. No class needed — it applies globally via `*`.

### 4.2 Hidden Scrollbars (Explicit Override)
Use `.scrollbar-hidden` when scrollbars would create visual noise:

| Location | Current | Recommendation |
|---|---|---|
| Sidebar (`sidebar.tsx`) | `no-scrollbar` utility | Replace with `scrollbar-hidden` |
| Audit log tab bar | `scrollbar-none` | Replace with `scrollbar-hidden` |
| Mobile carousels / swipers | — | Apply `scrollbar-hidden` |

### 4.3 Horizontal Scrollbars (Tables, Gantt)
Horizontal scrollbars should be even more subtle to avoid competing with data:

| Property | Horizontal Value |
|---|---|
| Height | `4px` (vs `6px` vertical) |
| Min-width | `32px` |
| Opacity rest | Same as vertical |

The `.scrollbar-x` utility can enforce this when needed.

**Affected components:**
- `CloudResourcesSection` (resource table)
- `MigrationEffortEstimationSection` (effort table)
- `DependenciesSection` (dependency table)
- `WaveGanttChart` (timeline)
- `StageProgressStepper` (stepper overflow)

### 4.4 Modal / Drawer Scrollbars
Scrollable areas inside modals and drawers should feel "nested" and slightly more subtle:

| Context | Adjustment |
|---|---|
| Drawer body | No change — global default is correct |
| Modal content | No change — global default is correct |
| Popover / Dropdown (Radix) | No change — `overflow-y-auto` already present |

> The transparent track ensures scrollbars never clash with drawer borders or modal backdrops.

### 4.5 Rich Text / Contenteditable
The email builder's `RichTextEditor` uses `overflow-y-auto`. The global scrollbar applies here too. If the editor iframe uses custom styles, the same CSS variables should be injected.

---

## 5. Interaction Design

### 5.1 Hover Proximity (Future Enhancement)
A refined enhancement: the scrollbar thumb becomes visible when the mouse is *near* the scrollbar track, not just when hovering the thumb itself. This requires JS and is **not** included in the CSS-only baseline.

```
Mouse at x = viewport-width - 20px
         ↓
Thumb opacity: 0.12 → 0.28 (even if not directly over thumb)
```

> **Recommendation:** Implement the CSS baseline first. Evaluate hover proximity in a follow-up if user feedback suggests scrollbars are hard to discover.

### 5.2 Scroll Activity Indicator (Future Enhancement)
Briefly flash the scrollbar thumb at higher opacity when scroll position changes (auto-fade after 1s of inactivity). This helps users locate their position in long documents.

> **Recommendation:** Not needed for MVP. The hover state provides sufficient discoverability.

### 5.3 Drag Behavior
While dragging the thumb:
- Opacity locks at active state (`0.40` light / `0.45` dark)
- Cursor changes to `grabbing`
- Thumb stays at expanded width (`8px`) if width expansion is enabled

---

## 6. Accessibility

### 6.1 Minimum Contrast
The active state (`0.40` / `0.45` opacity) against typical backgrounds exceeds WCAG 2.1 AA for graphical objects (3:1). The rest state is intentionally below contrast thresholds because the scrollbar is decorative until hovered.

### 6.2 Keyboard Navigation
- Scrollable regions must remain keyboard-focusable
- `Tab` focus rings should not be clipped by `overflow` containers
- Arrow keys and Page Up/Down continue to work natively

### 6.3 Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  ::-webkit-scrollbar-thumb {
    transition: none;
  }
}
```

### 6.4 Windows High Contrast Mode
In forced-colors mode, WebKit scrollbars fall back to system defaults. No override is needed.

---

## 7. Browser Support Matrix

| Browser | Support | Notes |
|---|---|---|
| Chrome 121+ | ✅ Full | WebKit pseudo-elements + `scrollbar-color` |
| Safari 17+ | ✅ Full | WebKit pseudo-elements |
| Edge 121+ | ✅ Full | Chromium-based |
| Firefox 125+ | ✅ Full | `scrollbar-width: thin` + `scrollbar-color` |
| iOS Safari | ⚠️ Partial | iOS uses overlay scrollbars; styles may not apply |
| Android Chrome | ✅ Full | WebKit support |

> iOS Safari renders its own minimal overlay scrollbar regardless of CSS. This is acceptable — the native iOS scrollbar is already slim and non-intrusive.

---

## 8. Theme Integration

### 8.1 Variable Mapping
The scrollbar uses only `--foreground`, which flips between dark brown (light mode) and cream (dark mode). No new CSS variables are required.

### 8.2 Theme Switching
When the user toggles light/dark mode via the `D` key or system preference:
- Scrollbar colors transition smoothly alongside the rest of the UI
- The `disableTransitionsTemporarily()` function in `theme-provider.tsx` should include scrollbar transitions in its suppression

### 8.3 Future Theme Additions
If additional themes are added (e.g., high-contrast, sepia), only `--foreground` needs to be adjusted. The scrollbar will adapt automatically.

---

## 9. Files to Modify

| File | Change |
|---|---|
| `frontend/src/index.css` | Add scrollbar rules inside `@layer base` and `@layer utilities` |
| `frontend/src/components/ui/sidebar.tsx` | Replace `no-scrollbar` with `scrollbar-hidden` |
| `frontend/src/components/drawers/AuditLogDrawer.tsx` | Replace `scrollbar-none` with `scrollbar-hidden` |
| `frontend/src/components/ui/table.tsx` | Consider adding `scrollbar-x` to table wrapper if horizontal scrollbar needs `4px` height |

---

## 10. Rollout Plan

### Phase 1: CSS Foundation
1. Add global WebKit + Firefox styles to `index.css`
2. Verify no visual regressions in main views (Home, Projects, Waves)
3. Check drawers and modals for clipping

### Phase 2: Utility Migration
1. Replace ad-hoc `scrollbar-none` / `no-scrollbar` with `.scrollbar-hidden`
2. Add `.scrollbar-x` to horizontal scroll containers if desired

### Phase 3: Polish (Optional)
1. Evaluate hover proximity enhancement
2. Evaluate width expansion (`6px` → `8px`)
3. Add scroll activity flash indicator

---

## 11. Visual Reference

### Light Mode — Rest State
```
┌──────────────────────────────────────────────┐
│  Lorem ipsum dolor sit amet, consectetur     │
│  adipiscing elit. Sed do eiusmod tempor      │
│  incididunt ut labore et dolore magna        │
│  aliqua...                                   │
│                                              │
│                                              │
│                                         ░░░  │  ← 6px thumb at 12% opacity
│                                         ░░░  │     (barely visible, cream-ish)
│                                         ░░░  │
└──────────────────────────────────────────────┘
```

### Light Mode — Hover State
```
┌──────────────────────────────────────────────┐
│  Lorem ipsum dolor sit amet, consectetur     │
│  adipiscing elit. Sed do eiusmod tempor      │
│  incididunt ut labore et dolore magna        │
│  aliqua...                                   │
│                                              │
│                                              │
│                                         ███  │  ← 6px thumb at 28% opacity
│                                         ███  │     (clearly visible)
│                                         ███  │
└──────────────────────────────────────────────┘
```

### Dark Mode — Rest State
```
┌──────────────────────────────────────────────┐
│  ··········································· │
│  ··········································· │
│  ··········································· │  ← dark background
│  ··········································· │
│  ··········································· │
│  ··········································· │
│  ·····································  ░░░  │  ← 6px thumb at 14% opacity
│  ·····································  ░░░  │     (subtle warm highlight)
│  ·····································  ░░░  │
└──────────────────────────────────────────────┘
```

---

## 12. Open Questions

1. **Width expansion (6px → 8px on hover):** Should the thumb grow on hover? It adds a "premium" feel but requires careful testing to avoid content reflow.
2. **Horizontal scrollbar height:** Should horizontal scrollbars be `4px` or match vertical at `6px`? Tables may benefit from the extra visibility of `6px`.
3. **Scrollbar on `html` vs. `body`:** Should the global scrollbar apply to `html` or only to scrollable containers? (Recommendation: global `*` — simplest and most consistent.)

---

*Ready for review. Once approved, I can implement this in a single surgical pass through `index.css` and the three component files.*
