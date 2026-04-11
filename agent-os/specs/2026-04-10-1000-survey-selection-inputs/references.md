# References for Survey Selection Inputs

## Similar Implementations

### FormViewer — DROPDOWN

- **Location:** `typeflow-ai/components/form/FormViewer.tsx` lines 830–845
- **Relevance:** Native `<select>` with transparent background, bottom-border-only, `appearance-none`, floating `<ChevronDown>` indicator
- **Key patterns borrowed:** `appearance-none`, relative wrapper + absolute chevron, `border-b-2` bottom-only border

### FormViewer — MULTIPLE_CHOICE (multipleSelection)

- **Location:** `typeflow-ai/components/form/FormViewer.tsx` lines 782–828
- **Relevance:** Option buttons with letter badges (A, B, C…), accent color selection highlight, `<Check>` icon on right edge
- **Key patterns borrowed:** `String.fromCharCode(65 + idx)` for letter labels, `isSelected` toggle pattern, check icon on right with `ml-auto`

### SurveyModal — boolean buttons (existing)

- **Location:** `frontend/src/components/survey/SurveyModal.tsx` lines ~204–215
- **Relevance:** Existing pattern for styled toggle buttons using Tailwind CSS variables — used as the baseline styling for `checkbox_select` buttons to ensure visual consistency
