# 0017 — cursor — rubric audit pass 001

**When:** 2026-08-03T14:11Z
**Agent:** cursor
**Task:** Rubric Audit Pass 001 (`docs/12-RUBRIC-AUDIT-AGENT.md`)
**Findings touched:** F-028, F-029, F-030, F-031, F-032, F-033, F-034
**Files changed:** `lib/calculator.ts`, `lib/validation.ts`, `lib/tax-service.ts`, `app/api/tax/calculate/route.ts`, `scripts/schema.sql`, `scripts/test-tax.ts`, `audit/**`

## What changed

Canonicalized transaction instants, rejected uncovered zero-value calculations
and over-discounts/unsafe amounts, persisted pre-calculation validation failures,
and tightened the rule trigger so only the first `superseded_at` stamp is legal.
Pass score moved from a measured 84/100 baseline to 96/100. F-033 and F-034
remain open because the five-change cap was reached.

## Verified how

`npm run db:seed` → 30 rules, 57 fixtures, 0 errors; `npm test` → all 35;
`npm run build` and `npx tsc --noEmit` clean; `npm run demo` complete;
live smoke 8/8. Independent API probe: 70/70 combinations and 20/20 edge cases
against the patched local service; SQLite showed five persisted
`INVALID_REQUEST` rows. Direct in-place `treatment` UPDATE now aborts.

## For the next agent

Start with F-033 (six undocumented rule rows and the seven-vs-nine demo heading),
then F-034 (mixed response casing). Do not spend the pass on the known Vercel
per-instance write limit without approval for shared storage. `npm run demo`
changes only report timestamps; restore or deliberately regenerate them before
committing.
