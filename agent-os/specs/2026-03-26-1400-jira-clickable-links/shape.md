# Jira Clickable Links — Shaping Notes

## Scope

1. Change M-11029 project status from `signed-off` → `in-progress` in mock data.
2. Make all Jira ticket references in the Project Details page clickable links that open the actual Jira ticket in a new tab. Affected surfaces:
   - Metadata strip: `jiraTicket` (static ticket) and `jiraStoryKey` (wave-job generated)
   - Cloud Resources section: story key in the success banner, and `jiraSubtaskKey` per resource row

## Decisions

- **Jira base URL source:** The URL is backend-owned (Jira configuration lives server-side). Modelled as `jiraBaseUrl?: string` on the Project entity, returned alongside project data from the API. Mock data uses a placeholder `https://your-org.atlassian.net`.
- **Graceful fallback:** If `jiraBaseUrl` is absent (not yet configured or older data), keys render as plain non-linked code badges — no broken links.
- **Link target:** `target="_blank" rel="noopener noreferrer"` — opens in new tab without security risk.
- **URL pattern:** Standard Atlassian format: `{jiraBaseUrl}/browse/{key}`

## Context

- **Visuals:** None provided
- **References:** Existing badge styling (`text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded`) reused; `hover:underline` added for links
- **Product alignment:** N/A
