# 0011 — claude-code — T1–T5 core build landed and verified on the Mac

**When:** 2026-08-03T03:30Z
**Agent:** claude-code
**Task:** T1–T5 (docs/02-BUILD-PLAN.md), T10 (F-014)
**Findings touched:** F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-011, F-012, F-013, F-014
**Files changed:** `data/tax-rules.json`, `scripts/{schema.sql,seed-db.ts,test-tax.ts}`,
`lib/{types,money,rules,calculator,db,rules-repo,audit,tax-service,compliance,http,validation}.ts`,
`app/api/tax/{calculate,rules,report}/route.ts`, `app/api/audit/**`,
`app/api/transactions/route.ts`, `next.config.ts`, `tsconfig.json`

## What changed

The engine was rebuilt from the MX/US toy to the brief. **T1**: 29 rule versions
across BR/CO/AR/CL/PE, each with a `legalReference`. **T2**: `scripts/schema.sql`
copied verbatim from `docs/03-SCHEMA.sql`; `lib/rules.ts` is a pure bitemporal
resolver picking one winner per tax type; `lib/rules-repo.ts` holds the SQL.
**T3**: `readOnly` removed from `lib/db.ts`; `lib/audit.ts` writes exactly one
row per request including failures, storing both `appliedRuleVersionIds` and a
full `appliedRulesSnapshot`; `GET /api/audit`, `/api/audit/{id}` and
`/api/audit/{id}/replay` added. **T4** (money in basis points) and the SQL-side
compliance report with the `edgeCases` block (F-013) were pulled forward because
T2/T3 break the old core outright — the repo would not compile without them.

**T10/F-014 is done as a side effect of T3**: `getDbPath()` copies the bundled
database to `/tmp` when `process.env.VERCEL` is set and opens it read-write, and
`seed-db.ts` replays every fixture through the real service so each instance
boots with a populated audit trail.

Two files were added outside the documented `lib/` layout because it had nowhere
for orchestration or rule persistence: `lib/tax-service.ts` and
`lib/rules-repo.ts`. The inward-only dependency arrow still holds:
`app → {tax-service, rules-repo, audit, compliance} → {calculator, rules, money}`.

## Verified how

`npm run db:seed` → `30 tax rule versions (ruleset v1) across 5 countries,
56 fixture transactions calculated, 0 audited as errors` (29 at the time of this
work; the 30th arrived with T13-R, see 0012).

`npm test` → all checks pass. Live against `npm start`:

```
BR electronics 2025-12-31 -> BR:ELECTRONICS:ICMS@v1 17.00% tax 17.00
BR electronics 2026-01-02 -> BR:ELECTRONICS:ICMS@v2 18.00% tax 18.00
CO food 5.00 | AR digital 29.00 (PAIS+IVA) | CL books 19000 CLP | PE 18.00
AR digital business -> 0.00 reverse charge
GET /api/audit/{id} -> full record incl. snapshot + sha256 fingerprint
POST with an unknown category -> HTTP 422 NO_APPLICABLE_RULE, audit row status=error
UPDATE/DELETE on tax_calculation_audit -> rejected: "append-only"
```

`npm run build` clean; `npx tsc --noEmit` clean.

## For the next agent

- **F-012's reseed blocker is cleared.** All 56 fixtures calculate, 0 errors —
  not the "roughly 55 calculated and 1 error" the finding predicted.
  `txn_pe_0005` (2024-06-15 digital services) resolves fine: it falls through to
  the `PE:*:IGV` wildcard, which is the intended fallback, not an error.
- `tsconfig.json` now excludes `docs/` — `next build` was failing to typecheck
  `docs/reference/**`, which imports `express`. That break pre-existed this work.
- A `YUNO_DB_PATH` env override was tried and removed: it made Next's file
  tracer warn that the whole project was being traced.
- The cached `DatabaseSync` handle survives a re-seed, so a server started
  before `npm run db:seed` keeps serving the deleted file. `predev` covers the
  normal flow; restart the server if you reseed underneath it.
