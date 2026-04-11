#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/workspaces/migration-hub/.claude-backup"

if [ -d "$BACKUP_DIR" ]; then
  echo "Restoring ~/.claude from workspace backup..."
  mkdir -p "$HOME/.claude"
  cp -rn "$BACKUP_DIR/." "$HOME/.claude/"
  echo "Restore complete."
else
  echo "No ~/.claude backup found in workspace — skipping restore."
fi
