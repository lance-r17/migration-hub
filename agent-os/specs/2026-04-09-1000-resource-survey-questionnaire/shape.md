# Resource Survey Questionnaire — Shaping Notes

## Scope

Extend the existing survey system so that cloud resources within a project can have product-specific questionnaires that appear as additional steps after the main application survey. Answers are written into each resource's `specs` field as JSON key-value pairs.

## Decisions

- **UX**: Resource questions are embedded in the existing `SurveyModal` as additional steps after the main application questions — no separate modal or route needed.
- **Config hierarchy (additive)**: Category + product + resource-level questions are all additive. A redis resource may appear in a category step (Database) AND get its own resource step.
- **Step grouping**:
  - `level: 'category'` → one step per category across the whole survey
  - `level: 'product'` → one step per product across the whole survey
  - `level: 'resource'` → one step per individual matching resource
- **Per-resource vs per-group**: Clarified by user — if level is `resource`, ask once per matching resource; if `product` or `category`, ask once per survey.
- **Scope filter on resource groups**: A `level: 'resource'` group can target `product`, `category`, or `resourceId` to scope which resources get the question without repeating group config per resource.
- **Admin config**: Extend existing `SurveyBuilderPage` with a "Resource Questions" tab using shadcn/ui `Tabs`.
- **Submission**: Use new `batchUpdateResourceSpecs` service that merges specs patches (does not replace existing keys).
- **Pre-fill**: Resource step answers are pre-filled from existing `resource.specs` values.

## Context

- **Visuals**: None
- **References**: Existing `SurveyModal.tsx`, `SurveyBuilderSection.tsx`, `surveyService.ts`, `use-survey.ts`
- **Product alignment**: Supports richer migration profiling for cloud resources with product-specific metadata

## Standards Applied

- None formally defined at time of writing (agent-os/standards/ does not exist)
