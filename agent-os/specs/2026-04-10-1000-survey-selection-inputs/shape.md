# Survey Selection Inputs — Shaping Notes

## Scope

Refactor the `select` and `checkbox_select` input types in `SurveyModal.tsx` to use a Typeform-inspired visual pattern borrowed from `typeflow-ai/components/form/FormViewer.tsx`.

## Decisions

- Replace shadcn `<Select>` with a native `<select>` element (transparent bg, bottom-border-only, floating chevron)
- Replace `<Checkbox>` + `<Label>` pairs with full-width option `<button>` elements (letter badge, selection highlight, check icon)
- Use the existing Tailwind/shadcn CSS variables (`text-primary`, `bg-primary/10`, etc.) rather than inline style accentColor like FormViewer
- Keep shadcn `<Select>` for `DependencyListEditor` (different context, unrelated to survey questions)
- Both input types appear in two components (`SurveyFieldInput` and `ResourceQuestionInput`) — both refactored

## Context

- **Visuals:** None provided
- **References:** `typeflow-ai/components/form/FormViewer.tsx` — DROPDOWN and MULTIPLE_CHOICE patterns
- **Product alignment:** N/A

## Standards Applied

- None from agent-os/standards (directory does not exist)
