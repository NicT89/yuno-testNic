# 0010 — cursor — Adversarial review + smoke script + submission notes

**When:** 2026-08-03T03:58Z
**Agent:** cursor
**Task:** C3–C5
**Findings touched:** F-005, F-014, F-015 (status note), F-020, F-022–F-025
**Files changed:** `audit/findings/CURSOR-REVIEW-001.md`, `verify/smoke-test.sh`, `docs/10-SUBMISSION-NOTES.md`

## What changed
Checklist review written (no code fixes). F-015 appears fixed in
`lib/tax-service.ts` — confirm via smoke check 4. Added
`verify/smoke-test.sh` (curl+python3) and submission paste text with both URLs.

## Verified how
Read-only grep/read of `lib/{money,calculator,rules,tax-service,db,compliance}.ts`
and `app/api/tax/rules/route.ts` (GET only). Did not run seed/tests against
claimed paths.

## For the next agent
Before submit: `chmod +x verify/smoke-test.sh && ./verify/smoke-test.sh https://yuno-tax.vercel.app`.
If check 3 fails, do not submit the Vercel URL as Deliverable. Still missing:
POST /rules, demo report file, F-009 untrack db, catalogue WRONG patches.
