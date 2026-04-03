# References for Jira Clickable Links

## Similar Implementations

### Jira key display (current — non-clickable)

- **Location:** `frontend/src/pages/ProjectDetailsPage.tsx` lines 245–250
- **Relevance:** The code badges being converted to links
- **Key patterns:** `<code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">` — reuse this class, add `hover:underline` on the `<a>` wrapper

### Jira subtask key display in resource table

- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx` lines 131–142
- **Relevance:** Per-resource `jiraSubtaskKey` badge being converted to a link
- **Key patterns:** Same badge class; conditional rendering already handles loading/empty states

### Jira success banner

- **Location:** `frontend/src/components/project/CloudResourcesSection.tsx` lines 74–82
- **Relevance:** Inline story key mention in the green completion banner also needs a link
