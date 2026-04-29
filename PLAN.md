# Plan: Add `pi -e npm:@plannotator/pi-extension` to post-start scripts

## Context
The repo uses a Dev Container with `post-start.sh` scripts that run on every container start. The `pi` CLI (`@mariozechner/pi-coding-agent`) is installed globally in the Dockerfile. We need to install the `@plannotator/pi-extension` Pi extension automatically via `pi -e npm:@plannotator/pi-extension`.

## Approach
Append `pi -e npm:@plannotator/pi-extension || true` at the very end of both `post-start.sh` files. The `|| true` ensures a transient network/npm failure won’t block container startup (`set -e` is active). `pi -e` is assumed to handle re-installation gracefully, so no extra idempotency gate is needed.

## Files to modify
- `.devcontainer/post-start.sh` (root repo)
- `scaffold/template/.devcontainer/post-start.sh` (scaffold template)

## Reuse
N/A — straightforward shell additions.

## Steps
- [ ] Append `pi -e npm:@plannotator/pi-extension || true` to the end of `.devcontainer/post-start.sh`
- [ ] Append `pi -e npm:@plannotator/pi-extension || true` to the end of `scaffold/template/.devcontainer/post-start.sh`

## Verification
1. Inspect both files to confirm the new line appears at the end.
2. (Optional) Rebuild/reopen the devcontainer and verify `post-start.sh` exits `0` even if the extension install fails.
