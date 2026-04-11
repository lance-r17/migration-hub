# Plan: Typeform-Inspired Selection Inputs in SurveyModal

## Context

`SurveyModal.tsx` rendered `select` questions using the shadcn `<Select>` component (a button-triggered dropdown) and `checkbox_select` questions as plain `<Checkbox>` + `<Label>` pairs. These felt heavy and utilitarian relative to the modal's typeform-style aesthetic.

The typeflow-ai `FormViewer.tsx` has polished equivalents:
- **DROPDOWN** — native `<select>` with transparent background, bottom-border-only styling, and a floating `<ChevronDown>` indicator
- **MULTIPLE_CHOICE (multi-select)** — option buttons with a letter badge (A, B, C…), border+background highlight on selection, and a `<Check>` icon at the right edge

## Changes Made

### `select` type (both `SurveyFieldInput` and `ResourceQuestionInput`)

Replaced shadcn `<Select>` with native `<select>` in a relative wrapper:
- `border-b-2 border-primary/30`, transparent bg, `appearance-none`
- Floating `<ChevronDown size={16}>` absolute-positioned right

### `checkbox_select` type (both `SurveyFieldInput` and `ResourceQuestionInput`)

Replaced `<Checkbox>` + `<Label>` pairs with styled `<button>` elements:
- Letter badge (A, B, C…) using `String.fromCharCode(65 + idx)`
- Selected: `border-primary bg-primary/10 text-primary` + filled badge + `<Check>` icon
- Unselected: `border-border hover:border-primary/50 text-muted-foreground`

### Imports

- Added `Check` to lucide-react imports
- Removed `Checkbox` from `@/components/ui/checkbox`
- Removed `Label` from `@/components/ui/label`
- Kept `Select` family (still used in `DependencyListEditor`)
