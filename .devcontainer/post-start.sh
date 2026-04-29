#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/workspaces/migration-hub/.claude-backup"

if [ -d "$HOME/.claude" ]; then
  mkdir -p "$BACKUP_DIR"
  rsync -a --delete "$HOME/.claude/" "$BACKUP_DIR/"
  echo "~/.claude backed up to workspace."
fi

# Install dotfiles on every start (devcontainer dotfiles property only runs on create)
DOTFILES_TMP="/tmp/dotfiles-$$"
if [ -d "$DOTFILES_TMP" ]; then rm -rf "$DOTFILES_TMP"; fi
git clone --depth 1 https://github.com/lance-r17/dotfiles.git "$DOTFILES_TMP"
bash "$DOTFILES_TMP/install.sh"
rm -rf "$DOTFILES_TMP"

# Install pi extension
pi -e npm:@plannotator/pi-extension || true
