# 0014 — cursor — Data disclaimer placements + deliverable URL diagnosis

**When:** 2026-08-03T04:30Z
**Agent:** cursor
**Task:** docs/11-DATA-DISCLAIMER.md four placements; F-023/024/025 by labelling
**Findings touched:** F-023, F-024, F-025
**Files changed:** `README.md`, `data/tax-rules.json`, `scripts/seed-db.ts`,
`lib/compliance.ts`, `app/api/health/route.ts`, `app/page.tsx`, `vercel.json`,
`audit/findings/FINDINGS.md`

## What changed
Applied all four disclaimer placements from `docs/11-DATA-DISCLAIMER.md` without
changing any rate numbers. Seed loader now skips a leading `_meta` object (and
accepts `{ rules: [...] }`). Invented `legalReference` values prefixed
`Illustrative:`; BR digital ICMS exclusion keeps the bare STF ADI citation.
Added `vercel.json` with `framework: nextjs` because project `yuno-test-nic`
was configured as Framework "Other" / output `public`, which serves the static
`public/` folder and 404s `/` and `/api/*` even when `next build` succeeds.

## Verified how
`npm run db:seed` and `npm run demo` after the edits (see following shell).
`yuno-tax.vercel.app/api/health` was already 200; `yuno-test-nic.vercel.app`
returned `x-vercel-error: NOT_FOUND` under the wrong framework preset.

## For the next agent
Redeploy to **project `yuno-test-nic`** (Deliverable URL), not only `yuno-tax`.
Then `./verify/smoke-test.sh https://yuno-test-nic.vercel.app`.
