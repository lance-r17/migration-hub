# References for Block Project Dialog

## Similar Implementations

### EmbargoSection delete confirmation

- **Location:** `frontend/src/components/settings/EmbargoSection.tsx:166-185`
- **Relevance:** Exact Dialog/state pattern used — `open={!!deleteTarget}`, `onOpenChange` to reset state, `DialogHeader`/`DialogFooter` layout
- **Key patterns:** State-controlled dialog (no `DialogTrigger`), reset target state on close, disabled button during async operation

### SignOffModal comment field

- **Location:** `frontend/src/components/modals/SignOffModal.tsx:163-175`
- **Relevance:** Textarea for justification/reason in a modal before confirming an irreversible action
- **Key patterns:** `comment` state, optional vs required validation
