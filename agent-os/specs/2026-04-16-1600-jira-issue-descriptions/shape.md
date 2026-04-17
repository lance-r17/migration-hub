# Jira Issue Descriptions — Shaping Notes

## Scope

Populate rich ADF (Atlassian Document Format) descriptions on three Jira issue types created by Migration Hub:
1. **Migration Story** — represents the entire application migration project
2. **Resource Subtask** — represents a specific resource or resource group (4 bucketing modes)
3. **CR/Operation Subtask** — represents a change request linked to resource subtasks

The goal: migration leads can read all scheduling-critical information (wave dates, constraints, SNOW groups, risks) directly in Jira without switching back to the project details page.

## Decisions

- **Format: Rich ADF** (not plain text) — headings, kv tables, bullet lists, horizontal rules
- **CR subtasks included** — change board reviewers need the same context
- **Only backend changes** — frontend unchanged; description is built server-side during job processing
- `regularMigrationWindow` is a plain string in seed data (not a dict) — used directly
- `changeFreezePeriods` items are `{name, from, to}` dicts — formatted as `"{name} ({from} → {to})"`
- Description builders are pure functions (no I/O) — safe to run in both mock and real Jira modes
- `expire_on_commit=False` is set on this project's async session — ORM scalar attributes survive commits; still load Wave and Risk via explicit queries before any commits

## Context

- **Visuals:** None
- **References:** `jira_client.py`, `jira_service.py`, seed data (`projects.json`)
- **Product alignment:** Core value prop of Migration Hub is centralizing migration coordination; surfacing key info in Jira extends that to the Jira-native workflow

## Standards Applied

- None applicable (no agent-os/standards directory)
