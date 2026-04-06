# Default Template Background Color — Theme Alignment

## Context

The email builder's default template uses `backgroundColor: '#ffffff'` (pure white) for the email content card. The project's design system uses a warm near-white for cards — `--card: hsl(42, 100%, 98.04%)` which converts to `#FFFCF5`. The email body wrapper was already updated to `#F5F1E6` (warm beige) in a prior spec (2026-04-06-1400), but the inner card background was intentionally left as `#ffffff` at that time. The visual result is a cold-white card sitting inside a warm-beige wrapper, which is inconsistent.

**Goal:** Update `DEFAULT_TEMPLATE_STYLE.backgroundColor` to `#FFFCF5` so the email content card uses the project's warm near-white (`--card`) instead of pure white.

---

## Task 1: Save Spec Documentation ✅

Created `agent-os/specs/2026-04-06-1500-default-template-background-color/`.

---

## Task 2: Update DEFAULT_TEMPLATE_STYLE.backgroundColor ✅

**File:** `frontend/src/types/email.ts`

Changed `backgroundColor: '#ffffff'` → `backgroundColor: '#FFFCF5'`

**Color derivation:**
- `--card: hsl(42.0000 100.0000% 98.0392%)` → R=255, G=252, B=245 → `#FFFCF5`

**Scope:** Affects new blank templates and all 8 predefined templates (none override `backgroundColor` in their `templateStyle`).
