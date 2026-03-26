# Playwright UI Dev Container Fix — Shaping Notes

## Scope

Fix `npm run test:e2e:ui` crashing in the headless dev container with a `ProtocolError` because
no XServer / display server is available.

## Decisions

- **`xvfb-run` wrapper**: Playwright's own error message recommends this. It creates a virtual
  framebuffer so the process can launch without a real display.
- **Install `xvfb` in Dockerfile**: Required for `xvfb-run` to be available after container rebuild.
- **VS Code Playwright extension**: Added to devcontainer `customizations` — the recommended
  interactive approach for dev containers. Routes UI through VS Code's webview panel.
- **Docs updated**: Added a note to `docs/frontend/testing.md` explaining the limitation and
  the two available approaches.

## Context

- **Root cause**: `playwright test --ui` opens an Electron-based GUI test runner that requires
  a display. The base image (`mcr.microsoft.com/devcontainers/typescript-node:4-24-trixie`)
  does not include `xvfb` or any display server.
- **After container rebuild**: `xvfb-run` will be available and the script will work.
  Current session requires `sudo apt-get install xvfb` to test without rebuilding.
