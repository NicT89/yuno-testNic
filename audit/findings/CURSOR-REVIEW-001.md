# CURSOR-REVIEW-001 — Adversarial checklist pass

**When:** 2026-08-03T03:55Z  
**Agent:** cursor  
**Against:** `docs/05-REVIEW-CHECKLIST.md`  
**Method:** read-only. No fixes applied. Claude Code owns `lib/**`, `app/**`, `scripts/**`, `data/**`.

Ranked by points at risk. Style/refactors omitted.

---

## Critical / high (can cost scored points)

### 1. BR digital ICMS+ISS stack still in fixtures — **25 pts** (accuracy) — F-022
`[data/tax-rules.json:123-161]` — `BR:DIGITAL_SERVICES` still defines both ICMS@1700 and ISS@500 with notes calling it “the multi-tax case”. STF ADI 1945/5659 make that mutually exclusive on software. T13-R not visible in JSON at review time.

### 2. No `POST` (or PUT/DELETE) on rules API — **20 pts** (rule management) — F-005 / F-017
`[app/api/tax/rules/route.ts:16]` — file exports **GET only**. Requirement 3 acceptance (“reviewer modifies a rate…”) cannot be demonstrated via API. Suggested patch (do not apply here): add POST that calls `createRuleVersion` / supersede in `lib/rules-repo.ts`; CRUD surface per T12 without in-place rate UPDATE.

### 3. `countries.rounding_mode` seeded but unused — **code quality / accuracy edge** — F-020
`[scripts/seed-db.ts:50-82]` inserts `rounding_mode`.  
`[lib/calculator.ts:59]` — `const rounding = opts.roundingMode ?? "HALF_UP"` and nothing in `lib/tax-service.ts` loads the country row to pass it. Dead config; CLP/half-even jurisdictions cannot be demonstrated.

### 4. Deliverable compliance report file missing — **10 pts** (docs/deliverables)
`[reports/]` — only `.gitkeep`. No `scripts/demo.ts` on disk (`demo_no`). Checklist still mentions `out/compliance-report-BR.json` (stale path; F-008 moved to `reports/`). Without a committed generated report, brief deliverable is incomplete.

### 5. Vercel audit persistence still must be proven live — **20 pts** — F-014
`[lib/db.ts:28-35]` — `/tmp` copy on `VERCEL` is implemented (good).  
**Not verified:** whether seed populates audit rows into the bundled DB, and whether `GET /api/audit/{id}` works on the deployed URL after a fresh POST. Smoke script `verify/smoke-test.sh` check 3 is the gate. Do not submit if that 404s on Vercel.

### 6. Catalogue domain errors (accuracy) — F-023, F-024, F-025
See `audit/findings/CURSOR-RULE-VERIFICATION.md`. PAIS open-ended after repeal; CO clothing threshold invented; BR electronics 18% falsely attributed to EC 132.

---

## Medium

### 7. README / ARCHITECTURE may still describe pre-refactor demo — **10 pts** (docs) — F-021
Cursor did not edit these (claimed by Claude Code for T16). Spot-check before submit: countries BR/CO/AR/CL/PE, bitemporal axes, audit endpoints, `npm run db:seed`, honest Vercel `/tmp` note.

### 8. `data/yuno-tax.db` still tracked in working tree — correctness — F-009
Decision was untrack + gitignore. Safety commit did **not** run `git rm --cached` (Claude Code / submission owner). Stale binary risk remains until that lands.

### 9. Effective-rate ratio uses float division (display only)
`[lib/calculator.ts:183-184]` and `[lib/compliance.ts:166-173]` — `Math.round((tax / base) * 10000)`. Charged amounts use `applyRateBps` (integer). Low risk for reconciliation of **tax amounts**, but checklist searches for float on rates — flag as display-only, not a charge bug.

### 10. `toMinor` accepts JS number via `toFixed` — API boundary
`[lib/money.ts:97]` — `amount.toFixed(exp)` when caller passes a float major-unit amount. Classic IEEE footgun at the HTTP edge. Prefer string amounts in docs/examples; optional finding if reviewers pass awkward decimals.

---

## Checklist items that look GOOD (do not regress)

| Check | Evidence |
|---|---|
| CLP exponent 0 | `[lib/money.ts:17]`, `[lib/types.ts:6]` |
| Pure `calculator` / `rules` (no sqlite/next/Date.now) | imports are money/types only; time passed as `asOf` / `transactionDate` |
| No silent 0% on miss | `NoApplicableRuleError` → 422 in calculate route |
| Audit on error path | `[lib/tax-service.ts:115-131]` writes audit then rethrows; UNIQUE race replays |
| Report aggregation in SQL | `[lib/compliance.ts:59-145]` + `json_each` for tax types |
| F-015 idempotency | **Appears FIXED in current tree:** `[lib/tax-service.ts:66-80]` short-circuit + UNIQUE catch. Confirm with `verify/smoke-test.sh` check 4 — do not re-open unless smoke fails |
| Bitemporal axes present | `[lib/rules.ts:5-15]` documents valid vs system time |
| RW SQLite locally | `[lib/db.ts]` no `readOnly: true` |

---

## Rubric spot-check (status at review time)

| Criterion | Pts | Status |
|---|---|---|
| Accuracy + edge cases | 25 | At risk until F-022/023/024/025 closed + seed/tests green |
| API design | 15 | Calculate/audit/report shapes look solid; rules write missing |
| Audit trail | 20 | Code path present; live Vercel + seeded audit still unproven |
| Rule management | 20 | Read + bitemporal OK; runtime modify missing |
| Code quality | 10 | Layering good; F-020 dead rounding |
| Documentation | 10 | Context pack pushed; demo report + README refresh pending |

---

## Suggested patches (not applied)

**F-020** — in `lib/tax-service.ts` before `calculateTax`, load country rounding:

```ts
const country = getDb().prepare(
  "SELECT rounding_mode AS m FROM countries WHERE code = ?"
).get(input.countryCode) as { m: RoundingMode } | undefined;
result = calculateTax(input, applicable, {
  rulesetVersion,
  roundingMode: country?.m ?? "HALF_UP",
});
```

**F-005** — add `POST` handler on `app/api/tax/rules/route.ts` delegating to `rules-repo` create/supersede (exact body schema in `docs/08-PRD-FIX-TASKS.md` T12).

---

## Could not check (Claude Code mid-edit / no live server)

- Whether in-flight edits already add POST rules or T13-R beyond what is on disk now.
- Running `npm test` / `npm run db:seed` (would contend with claimed `scripts/**` / `data/**`; seed still listed as Mac blocker in ACTIVE).
- Live Vercel F-014 until smoke script is pointed at the deploy URL.
