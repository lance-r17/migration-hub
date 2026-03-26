# Fix Playwright UI Mode in Dev Container

## Problem

`npm run test:e2e:ui` crashed with `ProtocolError: Browser.getVersion — session closed` because
`playwright test --ui` launches a headed browser requiring an XServer. The dev container had
no display and no `xvfb` installed.

## Fix

| File | Change |
|------|--------|
| `.devcontainer/Dockerfile` | Added `xvfb` to apt install list |
| `frontend/package.json` | Changed `test:e2e:ui` to `xvfb-run playwright test --ui` |
| `.devcontainer/devcontainer.json` | Added `ms-playwright.playwright` VS Code extension |
| `docs/frontend/testing.md` | Added dev container UI note |
