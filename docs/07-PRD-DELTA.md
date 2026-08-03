# 07 — PRD delta audit

Audited the supplied PRD against the code on disk at 02:25Z and against
`docs/00-CONTEXT.md`. Neither document is wrong; they emphasise different
things. This file records where the reasoning diverges, whether it costs
points, and what to do.

Seven findings opened: **F-015 … F-021** in `audit/findings/FINDINGS.md`.

---

## Where we already exceed the PRD (leave alone)

| PRD asks for | We built |
|---|---|
| "evaluate the transaction date against `effective_date`" | **Two** time axes. `validFrom/validTo` for the law, `recordedAt/supersededAt` for what the system believed. The PRD's single axis cannot satisfy its own "Historical Immutability" clause on its own. |
| "must never retroactively alter historical audit logs" | Enforced by SQLite triggers, not convention. `UPDATE`/`DELETE` on the audit table are rejected by the database. |
| Category breakdowns in the report | Plus by-tax-type, plus an `edgeCases` block, plus `rulesetVersionsInPeriod`. |
| "the specific rule identifier used" | Full rule-version ids *and* a JSON snapshot of the rules, so an audit row is readable with no joins. |
| Currency handling (stretch) | Per-currency exponents with CLP at 0, already in the core rather than deferred. |
| — | `legalReference` on every rule; `GET /audit/:id/replay`; `calculationFingerprint`. |

**Credit where due:** `lib/compliance.ts` aggregates tax-type totals with
`json_each(json_extract(output_payload_json,'$.taxLines'))` — pure SQL. The
reference build in `docs/reference/` does that in a JavaScript loop, which
would not survive the PRD's 100,000/day target. Claude Code's version is
better. Do not "fix" it back.

---

## F-015 · Retrying a calculation with the same `transaction_id` returns 500 · HIGH

**PRD §4 CR1:** "Identical requests must consistently return the exact same
output **without duplicating side effects**."

**Reproduced against the reference build:**

```
call 1 with explicit transaction_id  -> ok
call 2, SAME transaction_id          -> THROWS: UNIQUE constraint failed:
                                        tax_calculation_audit.transaction_id
```

`transaction_id` is the audit table's primary key, so a client that supplies
its own id (which our API allows, and which a retrying checkout will do) gets a
500 on the retry. This is a genuine defect, not a documentation gap, and a
reviewer poking at idempotency will find it in about thirty seconds.

**Divergence in reasoning.** Our design deliberately writes one audit row per
request so the compliance log never drops an event, and only dedupes when an
`Idempotency-Key` header is supplied. The PRD wants no duplicate side effects
at all. Both positions are defensible. The bug is that we implemented neither
cleanly: we neither dedupe nor tolerate the duplicate.

**Recommendation (do this):** treat a caller-supplied `transaction_id` as an
idempotency key. On collision, look up the existing audit record and return it
with `replayed: true` instead of inserting. Anonymous calls keep generating
fresh ids and fresh audit rows. Roughly ten lines in `lib/audit.ts` /
`lib/tax-service.ts`, and it satisfies both readings.

---

## F-016 · Audit lookup returns one record, PRD says "complete audit history" · MEDIUM

**PRD §4 CR2:** "fetch the **complete audit history** for any specific
transaction ID."

Ours returns exactly one row, because `transaction_id` is the PK. If a
transaction is ever recalculated (an amended return, a corrected category), the
PRD's phrasing implies you should see both attempts.

**Options.** (a) Leave it: one calculation, one record, and the replay endpoint
covers "what would it be now". (b) Change the PK to a surrogate `audit_id`,
index `transaction_id`, and return an array.

**Recommendation:** (a) if F-015 is fixed as described, because
caller-supplied ids then mean "the same calculation", not "a new attempt". Note
the choice in the README in one sentence. (b) is more correct long-term but is
a schema change with the clock where it is. **Benign either way.**

---

## F-017 · Rules API is missing the U and D of CRUD · MEDIUM, cheap

**PRD §4 CR3:** "Support **CRUD** operations to define rules."

`app/api/tax/rules/route.ts` currently exports `GET` only; `POST` is queued as
T5. Even once POST lands we have Create and Read. Our append-only invariant
means there is deliberately no in-place Update and no Delete.

That invariant is correct and must not change. But a reviewer scanning for CRUD
against a rubric line that reads "flexible rule definition system" (20 pts) may
score what they cannot see.

**Recommendation (do this, it is cheap):** expose the full verb surface with
append-only semantics underneath.

- `POST /api/tax/rules` — create a new rule
- `PUT /api/tax/rules/:ruleKey` — "update": inserts vN+1, supersedes vN
- `DELETE /api/tax/rules/:ruleKey` — "delete": closes the rule by setting
  `validTo` and stamping `supersededAt`. Nothing is removed.

Then say so in the README: *the API presents CRUD; storage is append-only, so
every write is a new immutable version.* That sentence converts a perceived gap
into a design point.

---

## F-018 · Performance NFR is unaddressed · MEDIUM, cheap to demonstrate

**PRD §5:** "API response time must be under 50ms. Implement intelligent
caching for tax rules." **Reliability:** scale to 100,000/day.

`docs/00-CONTEXT.md` explicitly deprioritised caching because the scoring
rubric gives it zero points and the rule table is a few dozen rows. That
reasoning still holds for *building* a cache. It does not hold for *saying
nothing*, especially to a payments company.

**Recommendation:** measure, then decide.

1. Add a p50/p99 benchmark over ~1,000 calculations to `scripts/demo.ts`
   (about ten lines). Prepared statements plus SQLite will almost certainly
   land far under 50ms, and a printed number is worth more than a cache.
2. If you want the cache anyway, it is genuinely small: a process-local `Map`
   of country → rules keyed on `ruleset_version`. The version is monotonic, so
   the cache self-invalidates the moment a rule changes. No TTL, no staleness
   window. ~15 lines in `lib/rules-repo.ts`.
3. One README paragraph on the 100,000/day path: 36M audit rows a year, already
   indexed on `(input_country_code, transaction_date)`, reports aggregate in
   SQL, and the partitioning/archival story is monthly by `transaction_date`.

Do 1 and 3 regardless. Do 2 only after T1–T5 and T10 are green.

---

## F-019 · Brazilian stacking is two-level, PRD says three · LOW-MEDIUM, cheap

**PRD §6:** "Brazilian **Federal** + State ICMS + Municipal ISS."

We stack state ICMS 17% + municipal ISS 5%. There is no federal layer.

**Recommendation:** add `BR:DIGITAL_SERVICES:PIS_COFINS` at 9.25% federal,
priority 5, with `legalReference` "Lei 10.637/2002 and Lei 10.833/2003". It is
one entry in `data/tax-rules.json`, needs no code change since the stacking
engine already handles N taxes, and it turns the multi-tax demo from "two
levels" into the exact three-level Brazilian case both the PRD and the original
brief describe. Update the expected value in the tests and in
`docs/04-TAX-RULES.md`.

---

## F-020 · `countries.rounding_mode` is seeded but never read · LOW

`scripts/schema.sql:56` defines it, `scripts/seed-db.ts:80` inserts it, and
`lib/calculator.ts:59` defaults to `HALF_UP` from an option nobody passes.
Dead configuration reads as sloppiness under Code Quality (10 pts), and the PRD
asks for "local rounding laws respected", which implies per-country policy.

**Recommendation:** wire it. Load the country row in `lib/tax-service.ts` and
pass `roundingMode` into `calculateTax`. Two lines. If you would rather not
touch it, delete the column and the insert instead — either is better than a
config knob that does nothing.

---

## F-021 · Business metrics are absent from the README · LOW, cheap

The PRD opens with a metrics table (60+ hours/week → under 5; $47,000 fine →
zero). Our README opens with architecture. A reviewer at a payments company is
evaluating whether you connect engineering to business outcomes.

**Recommendation:** three lines at the top of `README.md` framing what the
service is for before what it is made of. Reuse the PRD's table.

---

## Not gaps

- **PRD lists `transaction timestamp` and `customer type` as required inputs.**
  Ours default them (now, and `individual`). More usable, still accepts both.
- **"No-code configuration."** Our API-driven rule management satisfies it.
- **Stretch goals.** All four PRD stretch items are already built except the
  federal layer in F-019.
