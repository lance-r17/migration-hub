# Send Test Email — Implementation Plan

## Problem

`sendTestEmail()` in `emailService.ts` was a no-op stub in mock mode (no backend). The "Send Test" button showed a success toast but never actually sent anything.

## Solution

A minimal Node.js/Express email server (`email-server/`) using nodemailer for SMTP. The frontend detects a `VITE_EMAIL_SERVER_URL` env var and routes send-test requests there, bypassing the `USE_MOCK` flag for sending only.

## Files Changed

| File | Change |
|---|---|
| `email-server/index.js` | New — Express + nodemailer server, single POST endpoint |
| `email-server/package.json` | New — dependencies: express, nodemailer, cors, dotenv |
| `email-server/.env.example` | New — SMTP config documentation |
| `frontend/.env.example` | Added `VITE_EMAIL_SERVER_URL` documentation |
| `frontend/src/services/emailService.ts` | Extended payload type; added email server fetch path |
| `frontend/src/pages/EmailPreviewPage.tsx` | Passes `htmlContent` + resolved `subject` to sendTestEmail |

## How to Use

1. `cd email-server && npm install`
2. `cp .env.example .env` and fill in SMTP credentials
3. `npm run dev` (runs on port 3001)
4. Add `VITE_EMAIL_SERVER_URL=http://localhost:3001` to `frontend/.env.local`
5. Click "Send Test" in any template preview
