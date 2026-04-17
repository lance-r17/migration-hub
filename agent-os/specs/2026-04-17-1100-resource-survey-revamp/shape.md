# Resource Survey Revamp — Shaping Notes

## Scope

Replace all existing resource survey groups with a new set of product-specific per-resource questions.

## Decisions

- **Conditional date fields**: implemented fully — added `condition` field to `ResourceQuestionDef` and date rendering to `ResourceQuestionInput` rather than using workaround `short_text` fields.
- **Multi-product filter**: added `products?: string[]` to `ResourceQuestionGroup` (alongside the existing `product?: string`) rather than duplicating the 4-question database group for each of rds/polardb/dds.
- **Product code**: renamed `kvstore` → `r-kvstore` across all files (product map, seed data, mock data).
- **Question label capitalisation**: options use Title Case (e.g. "Cache-only", "Hot", "Standard") to match standard UI convention.
- **SLS "Downstream consumer projects"**: mapped to `string_array` input type (tag editor) since the existing type covers the list-of-text requirement.

## Context

- **Visuals**: None
- **References**: Existing `ResourceQuestionInput`, `Calendar`/`Popover` pattern from app survey `date` type
- **Product alignment**: r-kvstore maps to "database" category in the product category map

## Standards Applied

- Surgical changes only — no refactoring of unrelated SurveyModal code
- New `condition` field is additive / backward-compatible (optional field, existing configs unaffected)
