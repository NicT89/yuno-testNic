# 0012 — claude-code — T11–T16 landed

**When:** 2026-08-03T04:00Z
**Agent:** claude-code
**Task:** T11–T16 (docs/08-PRD-FIX-TASKS.md), T13 superseded by T13-R (docs/09-T13-REVISED.md)
**Findings touched:** F-015, F-016, F-017, F-018, F-019, F-020, F-021, F-022
**Files changed:** `lib/{tax-service,rules-repo,validation,types,db,compliance}.ts`,
`app/api/tax/calculate/route.ts`, `app/api/tax/rules/route.ts`,
`app/api/tax/rules/[ruleKey]/{route.ts,versions/route.ts}`,
`data/tax-rules.json`, `scripts/{demo.ts,test-tax.ts}`, `README.md`, `package.json`

## What changed

**T11 (F-015)** — reproduced first: a second `calculate()` with the same
caller-supplied `transaction_id` threw `UNIQUE constraint failed` and surfaced as
a 500. `calculate()` now short-circuits on a supplied `transaction_id` as well as
on `Idempotency-Key`, and catches the constraint violation defensively on both
the success and failure paths so concurrent retries cannot 500. A retried
*failure* replays as `ReplayedFailureError` and returns its original status
(422), not a fresh 500. Anonymous calls still always append.

**T12 (F-017)** — CRUD verbs over append-only storage. `POST /api/tax/rules`
(also closing T5/F-005), plus `GET`/`PUT`/`DELETE` on
`/api/tax/rules/{ruleKey}` and `GET .../versions`. `PUT` appends vN+1 and stamps
`supersededAt` on vN, returning both. `DELETE` appends a closing version
carrying `validTo` — note this *must* be an append: the `trg_rules_append_only`
trigger rejects an in-place `valid_to` UPDATE, so the storage model enforces the
semantics rather than relying on the handler.

**T13-R (F-022)** — see the F-022 resolution in the registry for the deviation.

**T14 (F-020)** — `countryRoundingMode()` reads `countries.rounding_mode` and the
service threads it into `calculateTax`, including both replay paths.

**T15 (F-018)** — `scripts/demo.ts` created, wired as `npm run demo`, benchmarks
1,000 calculations. **The cache was deliberately not built** — see below.

**T16 (F-021, F-016)** — README rewritten to open with the business outcome, and
carries the single-record-per-transaction-id sentence.

## Verified how

`npm test` → 35 checks pass, including two new regressions for F-015.

T11 acceptance, over HTTP, exactly as specified in T11:
```
POST .../calculate transaction_id=idem_test_1  -> 200 tax=18.00 replayed=false
POST .../calculate transaction_id=idem_test_1  -> 200 tax=18.00 replayed=true
SELECT COUNT(*) WHERE transaction_id='idem_test_1' -> 1
```

T12 acceptance, over HTTP:
```
audit a CO clothing sale        -> tax=38000.00 rule=CO:CLOTHING:IVA@v1
PUT rate_bps=500                -> previous=@v1 superseded=true, current=@v2
recalculate                     -> tax=10000.00 rule=CO:CLOTHING:IVA@v2
re-read the original audit row  -> tax=3800000 rule=@v1  (unchanged)
DELETE ?valid_to=2026-07-01     -> closing=@v3 validTo=2026-07-01
calculate dated 2026-09-01      -> falls through to CO:*:IVA@v1
calculate dated 2026-03-01      -> still CO:CLOTHING:IVA@v3  (history intact)
GET .../versions                -> 3 versions, none removed
```

T15 benchmark, `npm run demo`:
```
n=1000  p50 0.176 ms  p95 0.260 ms  p99 1.916 ms  ~4,666 calc/s single-threaded
```

## For the next agent

- **No rules cache was built, on purpose.** p99 is 1.92ms against a 50ms NFR —
  roughly 25x headroom. T15 says a printed number beats a cache you did not
  need; the README documents the `ruleset_version`-keyed design for whoever does
  need it later. Do not add it without a measurement that justifies it.
- `lib/tax-service.ts` now exports `ReplayedFailureError`. Any new caller of
  `calculate()` must handle it, or a retried failure will surface as a 500 again.
- `DELETE` on a rule is an append. If you ever find yourself writing
  `UPDATE ... SET valid_to`, the trigger will reject it — that is intended.
