# References

## Frontend Email Service

- **Location:** `frontend/src/services/emailService.ts`
- **Relevance:** Entry point for `sendTestEmail`; extended with `htmlContent`/`subject` fields and new `VITE_EMAIL_SERVER_URL` routing path

## Email Preview Page

- **Location:** `frontend/src/pages/EmailPreviewPage.tsx`
- **Relevance:** Calls `sendTestEmail`; already computes `html` via `useMemo(generateEmailHtml, ...)` — this is passed directly to the server

## API Client Toggle

- **Location:** `frontend/src/services/client.ts`
- **Relevance:** `USE_MOCK = !VITE_API_BASE_URL` — the email server URL check is intentionally placed before this toggle so sending works even in full mock mode
