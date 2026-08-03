# 02 — Build plan for Cursor and Claude Code

Ordered by points-per-minute. Each task names the **exact files** to touch in
this repo and the **exact reference file** to port from.

Division of labour:
- **Claude Code** owns tasks T1-T5 (the scored core) and the git history.
- **Cursor** owns T6-T8 (fixtures, docs, review) and runs the audit in
  `docs/05-REVIEW-CHECKLIST.md` against whatever Claude Code lands.
- Both read `docs/00-CONTEXT.md` first. Neither touches `app/page.tsx`.

---

## T1 — Swap the rule catalogue to BR / CO / AR / CL / PE  ·  25 pts

**Edit:** `data/tax-rules.json`, `scripts/seed-db.ts`
**Port from:** `docs/reference/src/seed/rules.ts`, `docs/04-TAX-RULES.md`

29 rule versions across five countries. Every rule carries a `legalReference`.
Include the two seeded version pairs so date-based selection is demonstrable
immediately after seeding:
- `BR:ELECTRONICS:ICMS` v1 = 17% valid to 2026-01-01, v2 = 18% from 2026-01-01
- `PE:DIGITAL_SERVICES:IGV` valid only from 2024-12-01 (earlier dates fall back
  to the country wildcard)

**Done when:** `GET /api/tax/rules?country=BR` returns rules and a calculation
for each of the five countries returns a sane rate.

---

## T2 — Bitemporal rule schema + resolver  ·  20 pts

**Edit:** `lib/types.ts`, `lib/rules.ts`, `scripts/seed-db.ts`
**Create:** `scripts/schema.sql` (copy `docs/03-SCHEMA.sql` verbatim, it is
already commented for the reviewer)
**Port from:** `docs/reference/src/domain/ruleResolver.ts`,
`docs/reference/src/db/rulesRepo.ts`

Add `recordedAt` / `supersededAt` next to `effectiveFrom` / `effectiveTo`.
Resolution filters on **both** axes, then picks a winner **per tax type** by
specificity (exact category beats wildcard; exact customer type beats wildcard).

**Done when:** the same inputs dated 2025-12-31 and 2026-01-02 resolve to
`@v1` and `@v2` of the Brazil electronics rule.

---

## T3 — Audit trail  ·  20 pts

**Edit:** `lib/db.ts` (remove `readOnly: true`)
**Create:** `lib/audit.ts`, `app/api/audit/[transactionId]/route.ts`,
`app/api/audit/route.ts`
**Port from:** `docs/reference/src/db/auditRepo.ts`,
`docs/reference/src/api/routes/audit.ts`

Every calculation writes exactly one row, **including failures**. Each row
stores inputs, output, `rulesetVersion`, `appliedRuleVersionIds`,
`appliedRulesSnapshot` (full JSON copy), `engineVersion`, and a
`calculationFingerprint` (sha256 of canonical inputs + ruleset version).

Add the append-only triggers from `docs/03-SCHEMA.sql`. They make immutability
a database guarantee rather than a claim in the README, and they demo well.

**Done when:** `GET /api/audit/{id}` returns a self-contained record, and an
attempted `UPDATE` on the audit table is rejected by SQLite.

---

## T4 — Money in basis points + edge cases  ·  accuracy pts

**Create:** `lib/money.ts`
**Edit:** `lib/calculator.ts`, `lib/types.ts`
**Port from:** `docs/reference/src/domain/money.ts`,
`docs/reference/src/domain/calculator.ts`

`rate: number` becomes `rateBps: number`. Add currency exponents
(BRL/COP/ARS/PEN = 2, **CLP = 0**) and `applyRateBps` with integer division and
an explicit rounding mode. Handle zero amounts, negative refunds, thresholds,
gross-vs-net discount base, and tax-inclusive decomposition.

**Done when:** `docs/reference/tests/calculator.test.ts` ported into
`scripts/test-tax.ts` (or vitest) passes.

---

## T5 — Rule-write endpoint + compliance report  ·  rule mgmt + audit pts

**Edit:** `app/api/tax/rules/route.ts` (add POST), `lib/compliance.ts`,
`app/api/tax/report/route.ts`
**Port from:** `docs/reference/src/api/routes/rules.ts`,
`docs/reference/src/api/routes/reports.ts`,
`buildComplianceReport` in `docs/reference/src/db/auditRepo.ts`

`POST /api/tax/rules` inserts a new version and supersedes the previous one.
The compliance report aggregates **in SQL** over the audit table: totals,
by-category breakdown, by-tax-type breakdown, and an `edgeCases` block counting
refunds, zero amounts, exemptions, below-threshold hits and errors. Support
`format=json|csv`.

**Done when:** change a rate via POST, recalculate and see the new rate, then
re-fetch the original audit record and see it unchanged.

---

## T6 — Fixtures  ·  documentation pts

**Edit:** `data/transactions.json`, `scripts/seed-db.ts`
**Port from:** `docs/reference/src/seed/transactions.ts`

56 transactions across five countries, three amount bands, both customer types,
with annotated edge cases. Each fixture keeps its `note` field explaining what
it exercises; that doubles as the test plan.

---

## T7 — Demo script  ·  the highest-ROI unscored 15 minutes

**Create:** `scripts/demo.ts`, wired as `npm run demo`
**Port from:** `docs/reference/src/scripts/demo.ts`

Seeds, prints a calculation matrix, walks the edge cases, proves idempotency,
demonstrates date-based rule selection, publishes a rate change and shows the
historical record unchanged, then writes `out/compliance-report-*.json`.

Three of the six rubric criteria phrase their acceptance criteria as "a
reviewer should be able to". This script is that reviewer's 20 seconds.

---

## T8 — Docs  ·  10 pts

**Edit:** `README.md`, `NOTES.md`
**Create:** `ARCHITECTURE.md`
**Port from:** `docs/reference/README.md`, `docs/reference/ARCHITECTURE.md`

README needs setup in two commands, a full endpoint table, and copy-pasteable
curl for every endpoint. ARCHITECTURE.md is the required 200-400 word
write-up: structure, how rules are stored and versioned, trade-offs made under
the time budget. Keep the existing Vercel/SQLite trade-off paragraph.

---

## Command surface to converge on

```bash
npm run db:seed   # reset + load rules and fixtures
npm run dev       # Next.js API on :3000
npm run demo      # full walkthrough, writes out/compliance-report-*.json
npm test          # accuracy tests on the pure core
```

---

## T9 — Submission hardening  ·  do this last, it is not optional

**Read:** `docs/06-SUBMISSION.md`

Covers four things the tasks above do not: the `/out/` gitignore trap that
silently drops a required deliverable, the committed-`.db` staleness decision,
the Vercel-cannot-host-writes conflict, and the explicit brief requirements
(idempotency, fixture timestamp variety, amount bands, edge cases in the
report) that need naming in the README.

Ends with a clean-clone verification sequence. Run it before submitting.

---

## T10 — Vercel write path  ·  20 pts  ·  blocks a credible deployed URL

**Read:** `audit/findings/FINDINGS.md` → F-014
**Edit:** `lib/db.ts`, `scripts/seed-db.ts`, `README.md`, `NOTES.md`

The deployed instance is the first thing the reviewer opens. If `POST` does not
persist and `GET /api/audit/:id` returns nothing, Requirement 2 fails in public.

1. Drop `readOnly: true`. On Vercel (`process.env.VERCEL`), copy the bundled
   database to `/tmp/yuno-tax.db` on cold start and open it read-write.
2. Make `scripts/seed-db.ts` run all fixture transactions through the real
   calculator and persist their audit rows, so every instance boots with a
   populated audit trail and reporting works cold.
3. Document the per-instance durability limit and the Turso/Postgres path.
