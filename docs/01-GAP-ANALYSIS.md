# 01 — Gap analysis: current repo vs the rubric

Assessed against the code in `lib/`, `app/api/`, `scripts/` and `data/`.
Ordered by points recoverable per minute of work.

---

## G1 — Wrong countries  ·  up to 25 pts  ·  BLOCKER

**Where:** `data/tax-rules.json`, `data/transactions.json`, `lib/rules.ts`

**Now:** fixtures cover Mexico, the US and Colombia.
**Required:** Brazil, Colombia, Argentina, Chile, Peru, with at least 20
country x category combinations and 15-20 distinct rules.

A reviewer calling `POST /api/tax/calculate` with `country_code: "BR"` currently
gets nothing back. This is the single largest point loss in the repo.

**Fix:** replace the rule fixtures wholesale from
`docs/04-TAX-RULES.md` / `data/tax-rules.json` (30 rule versions, each with a
`legalReference` or explicit illustrative note).

---

## G2 — No persisted audit trail  ·  up to 20 pts  ·  BLOCKER

**Where:** `lib/db.ts` opens SQLite with `{ readOnly: true }`. `NOTES.md`
lists "persisted ledger of calculated results" as a *future* improvement.

**Required (Requirement 2):** every calculation request persisted with
timestamp, transaction id, all inputs, calculated output, and the tax rule
version used; retrievable by transaction id; plus a compliance report over a
country and date range.

**Fix:**
1. Drop `readOnly` in `lib/db.ts`; open read-write against `data/yuno-tax.db`.
2. New `lib/audit.ts` with `writeAudit`, `getAudit`, `listAudit`.
3. New route `app/api/audit/[transactionId]/route.ts`.
4. New route `app/api/audit/route.ts` for the searchable list.
5. Extend `lib/compliance.ts` to aggregate **from the audit table in SQL**, not
   from static fixtures.

Serverless caveat is real but does not excuse skipping this: seed and run
locally for the review, and document the Turso/Postgres swap in `NOTES.md`
(you already have that paragraph, keep it).

---

## G3 — Single time axis on rules  ·  up to 20 pts  ·  BLOCKER

**Where:** `lib/types.ts` `TaxRule` has `effectiveFrom` / `effectiveTo` only.

Requirement 3 asks for **two different things**:
- "use the correct rule based on the **transaction date**" — that is your
  `effectiveFrom`/`effectiveTo`. Already handled.
- "if a reviewer changes a rule, **old calculations must still reference the
  rule version active at the time**" — this is a *second, independent* axis and
  there is currently no column for it.

**Fix:** add `recordedAt` / `supersededAt` (system time) alongside
`effectiveFrom` / `effectiveTo` (valid time). Rule updates INSERT a new version
and stamp `supersededAt` on the old row; they never mutate a rate in place.
Full schema with comments: `docs/03-SCHEMA.sql`. Resolver reference:
`docs/reference/src/domain/ruleResolver.ts`.

---

## G4 — Rates stored as floats  ·  accuracy pts

**Where:** `lib/types.ts` — `rate: number` documented as "0.16 for 16%".

Amounts are already integer minor units, which is right. Rates are not.
`Math.round(amountMinor * 0.19)` drifts on odd values and is the classic source
of one-cent reconciliation breaks.

**Fix:** `rateBps: number` (integer basis points) and a
`applyRateBps(amountMinor, rateBps)` helper doing integer arithmetic. Reference:
`docs/reference/src/domain/money.ts`.

---

## G5 — No runtime rule-write endpoint  ·  rule mgmt pts

**Where:** `app/api/tax/rules/route.ts` is read-only. `NOTES.md` says "change
JSON and reseed".

Requirement 3's acceptance criterion is that *a reviewer* modifies a rate and
observes new calculations changing while historical ones do not. Asking them to
edit a JSON file and restart is a weak demonstration.

**Fix:** `POST /api/tax/rules` that publishes a new version. Reference:
`docs/reference/src/api/routes/rules.ts` and
`docs/reference/src/db/rulesRepo.ts` (`createRuleVersion`).

---

## G6 — Category taxonomy conflates two concepts  ·  accuracy pts

**Where:** `lib/types.ts` `TaxCategory = "standard" | "reduced" | ... | "food"`.

This mixes *tax treatment* (standard, reduced, zero_rated, exempt) with
*product category* (food, clothing, digital). The API contract takes a
**product category** from the merchant's catalogue; the treatment is an
*output* of rule resolution.

**Fix:** split into `productCategory` (free-form string: electronics, food,
books, clothing, digital_services, medicine, education) and `treatment`
(standard | reduced | exempt | zero_rated | reverse_charge) as a field on the
rule. Reference: `docs/reference/src/domain/types.ts`.

---

## G7 — Missing edge cases  ·  accuracy pts

Requirement 1 names these explicitly. Each needs a fixture and a test.

- zero-amount transactions
- negative amounts (refunds) returning mirrored negative tax
- amounts at, just below, and just above a threshold
- currency rounding where the currency has no minor unit (CLP)
- unknown country/category returning 422, not 0%

Submission fixtures: `data/transactions.json` (57 transactions, each annotated
with what it exercises).

---

## What is already good — do not rewrite

- `lib/` vs `app/` separation is the right shape. Keep it.
- Integer minor units for amounts. Keep.
- `lib/http.ts` shared response helper. Keep and extend.
- Seed-from-JSON so fixtures stay reviewable. Keep.
- The Vercel/SQLite trade-off paragraph in `NOTES.md` is a genuine maturity
  signal. Keep it and fold it into `README.md`.
