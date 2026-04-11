---
name: commit
description: Commit staged git changes with a conventionally-formatted message. Use this skill whenever the user says "commit", "commit my changes", "commit staged", "make a commit", "write a commit message", or anything that implies they want to record their current staged work into git history. Prefer this skill over ad-hoc git commands whenever a commit is the end goal.
---

# Commit Staged Changes

Inspect the staged diff, draft a conventional commit message, confirm it with the user, and commit.

## Steps

### 1. Read the staged diff and recent history

Run these in parallel:

```bash
git diff --staged
git log --oneline -10
git status --short
```

- If `git diff --staged` is empty, stop and tell the user there is nothing staged to commit.
- Use the log to understand the project's commit message style and verb tense. If the project already uses conventional commits, match the scope format exactly.

### 2. Draft the commit message

Write a conventional commit message:

```
<type>(<scope>): <short summary>

[optional body — only if something non-obvious needs explaining]
```

**Choosing the type:**
- `feat` — new user-facing feature or capability
- `fix` — bug fix
- `refactor` — restructuring without behaviour change
- `chore` — tooling, deps, config, build system
- `style` — formatting, whitespace, naming (no logic change)
- `test` — adding or updating tests
- `docs` — documentation only
- `perf` — performance improvement
- `ci` — CI/CD changes

**Scope:** a short noun describing what part of the codebase changed (e.g. `auth`, `survey`, `api`, `ui`). Omit if the change is truly cross-cutting.

**Summary line rules:**
- Imperative mood: "add X", not "adds X" or "added X"
- No capital letter after the colon
- No trailing period
- Keep it under 72 characters

**Body (optional):** Add a body only when the *why* behind the change isn't obvious from the diff. Skip it for routine changes.

### 3. Confirm with the user

Present the drafted message clearly:

```
Proposed commit message:

  feat(survey): add checkbox_select multi-select input type

Ready to commit? (yes / edit / cancel)
```

Wait for the user's response:
- **yes / y** — proceed to commit
- **edit / e** — ask what they'd like to change, revise, and confirm again
- **cancel / n** — stop without committing

### 4. Commit

Once confirmed, run:

```bash
git commit -m "$(cat <<'EOF'
<the approved message>
EOF
)"
```

After a successful commit, show the one-line summary from `git log -1 --oneline` so the user can see the result.

Do **not** push. Do **not** stage additional files. Do **not** amend previous commits unless the user explicitly asks.

## Safety rules

- Never skip pre-commit hooks (`--no-verify`).
- Never commit `.env`, credential files, or secrets — warn the user if staged files look sensitive.
- Never use `git add -A` or `git add .`.
- If the hook fails, report the error clearly and wait for the user to fix it before retrying as a new commit (not an amend).
