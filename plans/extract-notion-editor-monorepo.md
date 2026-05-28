# Extract `@frontend/src/components/notion-editor` as a Separate Package & Convert Frontend to Monorepo

## Context

The `frontend/` directory is currently a single Vite + React app. The `notion-editor` component (≈25 files under `src/components/notion-editor/`) is tightly coupled to the rest of the app via:

- **Direct imports into pages/components**: `EngagementNotesPage`, `TemplatePreviewPage`, `NoteTemplatesPage`, `TemplatePicker`, `SaveTemplateDialog`
- **Bidirectional import with `src/lib/noteTemplateUtils.ts`**: `VariableMenu.tsx` imports `TEMPLATE_VARIABLES` from `@/lib/noteTemplateUtils`, while `noteTemplateUtils.ts` imports `Block`/`cloneBlock` from the editor.
- **External runtime deps**: `react`, `react-dom`, `lucide-react`, `prism-react-renderer`, `@emoji-mart/data`, `@emoji-mart/react`

Goal: extract the editor into its own installable package inside the frontend workspace and convert the frontend to a pnpm monorepo layout.

## Decisions (answered)

1. **Monorepo tool**: **pnpm workspaces** — migrate `frontend/` from npm to pnpm.
2. **Template-variable coupling**: Make the package independent. `VariableMenu` will accept `variables` as a prop. `TEMPLATE_VARIABLES` stays in the app.
3. **Package name**: `@frontend/notion-editor`.

## Proposed Approach

### Target workspace layout

```
frontend/
├── pnpm-workspace.yaml          # packages: ['packages/*', '.' ]
├── package.json                 # renamed to @frontend/app, private
├── pnpm-lock.yaml               # replaces package-lock.json
├── src/                         # app source (unchanged structure)
├── index.html
├── vite.config.ts
├── packages/
│   └── notion-editor/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # public exports
│           ├── NotionEditor.tsx
│           ├── model.ts
│           ├── Editable.tsx
│           ├── …
│           └── styles.css
```

The app (root `frontend/`) remains a workspace member so existing source, config, and Docker context stay in place.

### Files to modify / create

| File | Change |
|------|--------|
| `frontend/pnpm-workspace.yaml` | New — define `packages: ['packages/*', '.']` |
| `frontend/package.json` | Rename to `@frontend/app`; add dep `"@frontend/notion-editor": "workspace:*"`; remove `package-lock.json` reference; update scripts to use `pnpm` |
| `frontend/packages/notion-editor/package.json` | New — name `@frontend/notion-editor`, `main`/`exports` point to `./src/index.ts`, peer deps on `react`/`react-dom` |
| `frontend/packages/notion-editor/tsconfig.json` | New — extends app tsconfig or standalone; `compilerOptions.outDir` omitted (`noEmit:true`) |
| `frontend/packages/notion-editor/src/index.ts` | New — re-exports `NotionEditor`, `Block` types, `createBlock`, `cloneBlock`, and `styles.css` |
| Move `frontend/src/components/notion-editor/**` → `frontend/packages/notion-editor/src/**` | Physical move of all editor source |
| `frontend/packages/notion-editor/src/VariableMenu.tsx` | Remove `@/lib/noteTemplateUtils` import; accept `variables` prop |
| `frontend/packages/notion-editor/src/NotionEditor.tsx` | Add `variables` prop; forward to `VariableMenu`; remove `@/lib/noteTemplateUtils` dependency |
| `frontend/src/lib/noteTemplateUtils.ts` | Keep here (not extracted); no change to its imports from the editor (they still work via workspace package) |
| `frontend/src/pages/EngagementNotesPage.tsx` | Update import paths to `@frontend/notion-editor`; pass `variables={TEMPLATE_VARIABLES}` to `NotionEditor` |
| `frontend/src/pages/EngagementNotesEditPage.tsx` | Same — update imports, pass variables |
| `frontend/src/pages/TemplatePreviewPage.tsx` | Same — update imports, pass variables |
| `frontend/src/pages/NoteTemplatesPage.tsx` | Same — update imports, pass variables |
| `frontend/src/components/note-template/TemplatePicker.tsx` | Same — update imports |
| `frontend/src/components/note-template/SaveTemplateDialog.tsx` | Same — update imports |
| `frontend/vite.config.ts` | No change needed — pnpm symlinks make Node resolution work automatically |
| `frontend/tsconfig.app.json` | Optional: add `"@frontend/notion-editor": ["packages/notion-editor/src/index.ts"]"` to `paths` for faster IDE resolution |
| `frontend/src/index.css` | Add `@source "../packages/notion-editor/src"` if Tailwind v4 does not scan workspace packages automatically |
| `frontend/Dockerfile` | Replace `npm ci` with `pnpm install --frozen-lockfile`; install pnpm in builder; copy `pnpm-workspace.yaml` and both `package.json`s before install |
| `frontend/.npmrc` | New — `shamefully-hoist=false` (pnpm default); optional `strict-peer-dependencies=false` if needed |

### Reuse

- **Vite** resolution: pnpm symlinks `@frontend/notion-editor` to the local `packages/notion-editor` directory. Vite follows the symlink and treats it as source, so HMR and Tailwind class scanning work transparently.
- **Tailwind v4**: The `@tailwindcss/vite` plugin scans files via Vite's module graph. Because workspace packages are resolved to real local paths (not opaque `node_modules`), utility classes in the package JSX should be picked up automatically. If not, `@source` in `index.css` is the fallback.
- **TypeScript**: `frontend/tsconfig.json` already uses project references. We can keep the package as a source-only workspace member (`noEmit: true`) and let the app build it via Vite.

### Steps

- [ ] Delete `frontend/package-lock.json`.
- [ ] Create `frontend/pnpm-workspace.yaml`.
- [ ] Update `frontend/package.json` → rename to `@frontend/app`, add `"@frontend/notion-editor": "workspace:*"` to deps, update scripts.
- [ ] Scaffold `frontend/packages/notion-editor/` with `package.json`, `tsconfig.json`.
- [ ] Move `frontend/src/components/notion-editor/**` → `frontend/packages/notion-editor/src/**`.
- [ ] Create `frontend/packages/notion-editor/src/index.ts` exporting the public API.
- [ ] Refactor `VariableMenu` to accept `variables` prop instead of importing from `@/lib/noteTemplateUtils`.
- [ ] Refactor `NotionEditor` to accept `variables` prop and forward it.
- [ ] Update all consumer files in `frontend/src/` to import from `@frontend/notion-editor` and pass `variables={TEMPLATE_VARIABLES}` where needed.
- [ ] Run `pnpm install` in `frontend/` to generate `pnpm-lock.yaml`.
- [ ] Verify dev server (`pnpm dev`) works and editor pages render correctly.
- [ ] Verify production build (`pnpm build`) succeeds.
- [ ] Update `frontend/Dockerfile` for pnpm workspace install and build.
- [ ] Run Docker build locally to confirm.

## Verification

1. `cd frontend && pnpm install` succeeds and creates `pnpm-lock.yaml`.
2. `pnpm dev` starts; editor renders on `/engagement-notes`, `/templates`, etc.
3. `pnpm build` (from `frontend/`) produces `dist/` with no errors.
4. Docker build (`docker build -f Dockerfile .`) completes and serves the app.
5. Slash menu (`/`), variable autocomplete (`{{`), drag-drop, and inline toolbar all still function.
