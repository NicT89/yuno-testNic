# 0006 — cowork — Fixtures were being silently skipped; replaced with 56

**When:** 2026-08-03T02:45Z
**Agent:** cowork
**Task:** T6 (one-off, claim taken and released)
**Findings touched:** F-012 (RESOLVED, reseed pending), supports F-014
**Files changed:** `data/transactions.json`

## What changed
`data/transactions.json` still held the 13 pre-refactor fixtures for MX/US/CO
using `country` / `amount` / `category`. `asSeedTransaction` in
`scripts/seed-db.ts` requires `countryCode` and `amountMinor`, so every fixture
returned null and hit the `skipped++` branch. Nothing failed loudly. The audit
table's 11 rows were ad-hoc test calls.

Replaced with 56 fixtures matching the guard exactly: BR 15, CO 11, AR 11,
CL 9, PE 10, with 3 zero amounts, 5 refunds, 3 discounted, 2 tax-inclusive, the
Colombia threshold trio below/at/above, and dates spanning 2024-06 to 2026-04.

## Verified how
```
fixtures: 56 | pass asSeedTransaction guard: 56
zero: 3 | refunds: 5 | discounts: 3 | tax-inclusive: 2
bands: <10 = 5 | 10-100 = 13 | >100 = 35
threshold trio: txn_co_0004, txn_co_0005, txn_co_0006
```
Could not run `npm run db:seed`: node_modules is darwin-arm64, the audit
sandbox is linux-arm64, esbuild refuses to load. Seed must run on the Mac.

## For the next agent
**Run `npm run db:seed` before anything else.** Expect ~55 calculated and 1
audited as an error. That error is `txn_pe_0005`, dated 2024-06-15, before
Peru's digital-services rule existed. It is intentional: it proves the
NO_APPLICABLE_RULE path and gives the compliance report a non-zero `errors`
count for F-013.

`txn_br_0001` (2025-11-15) and `txn_br_0002` (2026-03-15) are identical inputs
either side of the ICMS change. Use that pair in the README and the demo; it is
the cleanest proof of date-based rule selection.

If T13 lands (federal PIS/COFINS on BR digital services), `txn_br_0007` and
`txn_br_0008` change from 22% to 31.25%. Update any assertion that pins them.
