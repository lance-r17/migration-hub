#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/workspaces/migration-hub/.claude-backup"

if [ -d "$HOME/.claude" ]; then
  mkdir -p "$BACKUP_DIR"
  rsync -a --delete "$HOME/.claude/" "$BACKUP_DIR/"
  echo "~/.claude backed up to workspace."
fi
