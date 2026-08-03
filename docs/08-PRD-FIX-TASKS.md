# 08 — PRD fix tasks (T11–T16)

Derived from `docs/07-PRD-DELTA.md`. Ordered by points-per-minute.
Do **not** start these until T1–T5 and T10 are green: they are additive, not
foundational.

Protocol reminder: claim paths in `audit/ACTIVE.md` before editing, write one
`audit/log/NNNN-claude-code-<slug>.md` entry per task, and flip the finding's
Status in `audit/findings/FINDINGS.md` when done.

---

## T11 — Idempotent retry on caller-supplied `transaction_id`  ·  F-015  ·  HIGH

**Why:** reproduced defect. A retry with the same `transaction_id` currently
throws `UNIQUE constraint failed: tax_calculation_audit.transaction_id` and the
caller gets a 500. The PRD requires identical requests to return identical
output "without duplicating side effects". A reviewer testing idempotency finds
this immediately.

**Files:** `lib/audit.ts`, `lib/tax-service.ts`, `app/api/tax/calculate/route.ts`

**Do:**
1. In the service, before inserting: if the caller supplied a `transaction_id`
   (or an `Idempotency-Key` header) and an audit row already exists for it,
   return the stored record instead of recalculating. Flag it in the response
   as `replayed: true`.
2. Anonymous calls (no supplied id) keep generating a fresh id and a fresh
   audit row. The compliance log must never drop an event.
3. Guard the insert defensively too: catch the unique-constraint error, re-read
   the row, and return it. Two clients retrying concurrently must not 500.

**Acceptance:**
```bash
curl -s -X POST localhost:3000/api/tax/calculate -H 'Content-Type: application/json' \
  -d '{"amount":100,"country_code":"BR","product_category":"electronics","transaction_id":"idem_test_1"}'
# repeat the exact same call
# -> 200 both times, identical tax amount, second response has replayed: true
# -> SELECT COUNT(*) FROM tax_calculation_audit WHERE transaction_id='idem_test_1' returns 1
```
Add a regression test for it.

**README:** one sentence stating the guarantee — the calculation is a pure
function of (canonical inputs, transaction date, ruleset version); a supplied
`transaction_id` makes the write idempotent; anonymous calls always append.

---

## T12 — Full CRUD verb surface on rules, append-only underneath  ·  F-017  ·  20 pts

**Why:** the PRD asks for CRUD. We have Create and Read. The append-only
invariant is correct and must not change, but a reviewer scoring "flexible rule
definition system" can only score what they can see.

**Files:** `app/api/tax/rules/route.ts`, `app/api/tax/rules/[ruleKey]/route.ts` (new), `lib/rules-repo.ts`

**Do:**
- `POST   /api/tax/rules` — create rule (v1) or new version
- `PUT    /api/tax/rules/:ruleKey` — "update": insert vN+1, stamp
  `supersededAt` on vN. Return both the old and new version in the response so
  the change is self-evident.
- `DELETE /api/tax/rules/:ruleKey` — "delete": close the rule by setting
  `validTo` to the supplied date (default: now) and stamping `supersededAt`.
  **Remove nothing.** Return the closing version.
- `GET    /api/tax/rules/:ruleKey/versions` — full lineage (may already exist)

Every write bumps `ruleset_version`.

**Acceptance:** a PUT changes the rate for new calculations, a previously
audited transaction still returns its original tax, and
`GET /api/tax/rules/:ruleKey/versions` shows v1 and v2 with the v1
`supersededAt` populated. A DELETE stops the rule applying to future dates
without altering history.

**README:** *"The API presents CRUD. Storage is append-only: every write
creates a new immutable version, and nothing is ever updated in place or
removed. `DELETE` closes a rule's validity window rather than erasing it."*

---

## T13 — Add the Brazilian federal tax layer  ·  F-019  ·  accuracy, ~5 min

**Why:** the PRD specifies "Federal + State ICMS + Municipal ISS". We stack
state + municipal only. The stacking engine already handles N taxes, so this is
data, not code.

**Files:** `data/tax-rules.json`, `scripts/test-tax.ts` (or the test suite), `docs/04-TAX-RULES.md`

**Do:** add one rule.

```json
{
  "ruleKey": "BR:DIGITAL_SERVICES:PIS_COFINS",
  "version": 1,
  "countryCode": "BR",
  "productCategory": "digital_services",
  "customerType": "*",
  "taxType": "PIS_COFINS",
  "taxScope": "federal",
  "rateBps": 925,
  "treatment": "standard",
  "thresholdMinor": 0,
  "taxableBase": "net",
  "priority": 5,
  "compoundOnPrevious": false,
  "validFrom": "2020-01-01",
  "validTo": null,
  "recordedAt": "2024-01-01T00:00:00.000Z",
  "legalReference": "Lei 10.637/2002 (PIS) and Lei 10.833/2003 (COFINS), non-cumulative regime",
  "notes": "Federal layer. Stacks with state ICMS and municipal ISS: the three-level Brazilian case."
}
```

`tax_scope` may need `federal` added to its allowed values in
`scripts/schema.sql` and the validation schema.

**Acceptance:** BRL 100.00 digital services in Brazil returns three tax lines
(PIS_COFINS 9.25% federal, ICMS 17% state, ISS 5% municipal) totalling 31.25%
effective. Update the expected value everywhere it is asserted.

---

## T14 — Wire `countries.rounding_mode` or delete it  ·  F-020  ·  ~2 min

**Why:** `scripts/schema.sql:56` defines it, `scripts/seed-db.ts:80` inserts
it, and `lib/calculator.ts:59` defaults to `HALF_UP` from an option nobody
passes. Dead configuration reads as sloppiness under Code Quality, and the PRD
asks for local rounding laws to be respected.

**Files:** `lib/tax-service.ts`, `lib/calculator.ts`

**Do:** load the country row in the service and pass `roundingMode` through to
`calculateTax`. If you would rather not, delete the column and the insert.
Either is better than a knob that does nothing.

**Acceptance:** changing a country's `rounding_mode` to `HALF_EVEN` in the seed
visibly changes a half-cent result. Or the column is gone.

---

## T15 — Measure performance, then decide on caching  ·  F-018  ·  code quality

**Why:** the PRD makes performance a hard NFR (under 50ms, caching, 100k/day).
The rubric gives caching zero points, so do not build it first. Measure
instead: a printed number is worth more than a cache you did not need.

**Files:** `scripts/demo.ts`, `README.md`, optionally `lib/rules-repo.ts`

**Do:**
1. Benchmark ~1,000 calculations in the demo. Print p50, p95, p99 and total
   throughput.
2. README paragraph on the 100,000/day path: 36M audit rows a year, indexed on
   `(input_country_code, transaction_date)`, reports aggregate in SQL, archival
   is monthly partitioning by `transaction_date`.
3. **Only if 1 and 2 are done and T1–T5, T10 are green:** add a process-local
   `Map` cache of country → rules keyed on `ruleset_version`. The version is
   monotonic, so it self-invalidates on any rule write. No TTL, no staleness
   window. Say that in the README; it is the interesting part.

**Acceptance:** `npm run demo` prints latency percentiles. README explains the
scale path and, if built, why the cache needs no invalidation logic.

---

## T16 — README business framing  ·  F-021 + F-016  ·  ~5 min

**Why:** the README opens with architecture. The reviewer works at a payments
company and is assessing whether engineering connects to business outcomes.

**Files:** `README.md`

**Do:**
1. Open with what the service is for before what it is made of: manual
   reconciliation 60+ hours/week to under 5, the $47,000 Brazilian
   underreporting fine to zero, rule updates from a sprint cycle to an API
   call, expansion unblocked.
2. Add one sentence closing F-016: *"`GET /api/audit/:id` returns a single
   immutable record per transaction id; recalculating a historical transaction
   is a read-only operation exposed at `/replay`, so a transaction never
   accumulates conflicting audit rows."*

**Acceptance:** first screen of the README explains the business problem.
