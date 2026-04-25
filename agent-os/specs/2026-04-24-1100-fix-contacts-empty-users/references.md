# References for Fix Contacts Empty Users

## Service layer mapper

- **Location:** `frontend/src/services/users.ts:11`
- **Relevance:** `userFromApi()` — the correct function name that was being misreferenced as `fromApi`
- **Key patterns:** Parses comma-separated `role` string from API into `string[]`
