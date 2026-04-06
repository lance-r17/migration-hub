# References for Table Data Source Editing

## Similar Implementations

### TemplateRenderer variable substitution

- **Location:** `frontend/src/components/email-builder/preview/TemplateRenderer.tsx`
- **Relevance:** Existing `resolveVariables` function handles `{{variable}}` substitution in text components. Extended with `resolveItemLinkPattern` for two-phase pattern resolution (top-level vars + item-level fields).
- **Key patterns:** Two-phase string replacement via regex

### ContentTab table config section

- **Location:** `frontend/src/components/email-builder/builder/right-panel/ContentTab.tsx`
- **Relevance:** Existing header toggle and header label inputs. Extended with data source selector and per-column field/type/linkPattern configuration.
- **Key patterns:** `onTableConfigChange` callback, `setTc` partial update pattern

### EmailPreviewPage sample data sets

- **Location:** `frontend/src/pages/EmailPreviewPage.tsx`
- **Relevance:** `SAMPLE_DATA_SETS` provides scalar string values for variable substitution. Extended to include `jiraBaseUrl` and `project.currentInfrastructure.resources` arrays.
- **Key patterns:** `Record<string, string | Record<string, unknown>[]>` union type

### CloudResource type

- **Location:** `frontend/src/types/index.ts`
- **Relevance:** Defines the shape of items in `project.currentInfrastructure.resources`. Fields `name`, `product`, `jiraSubtaskKey` are the three columns in the Jira template table.
