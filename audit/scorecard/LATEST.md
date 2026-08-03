# Rubric Audit Pass 001 — 2026-08-03T14:11:14Z

**Previous:** 84/100   **This pass:** 96/100   **Delta:** +12

| # | Criterion | Max | Score | Deductions (evidence: file:line, or the request/response a grader would see) |
|---|---|---:|---:|---|
| A | Tax calculation accuracy | 25 | 25 | No deduction after fixes. Live pre-fix probes exposed offset-date, uncovered-zero and over-discount defects; the patched local API passes the same 70-case matrix and 20 edges. |
| B | API design & usability | 15 | 14 | F-034: `README.md:116` promises snake_case responses, while live calculation output mixes `transaction_id` with `baseAmountMinor`, `taxLines` and `effectiveRateBps`. |
| C | Audit trail + reporting | 20 | 19 | Validation failures now persist (F-032), reports aggregate in SQL and live smoke is green. One point remains off for the documented Vercel per-instance `/tmp` durability boundary (`README.md:270-283`). |
| D | Rule management | 20 | 20 | No deduction after F-031. A direct in-place `treatment` mutation succeeded before the fix and is now rejected; only the first null-to-timestamp `superseded_at` transition is allowed. |
| E | Code quality | 10 | 10 | No deduction. Pure-core import scan, build/typecheck, SQL aggregation inspection and route/service layering all held. |
| F | Documentation | 10 | 8 | F-033: six catalogue rows have neither citation nor explanatory note despite the README/test claim; the demo heading says nine categories but displays seven distinct categories. |
|   | **Total** | **100** | **96** |  |

**Combinations verified:** 70 of 70 (five countries × seven seeded categories × two customer types). Failures: none after fixes; all expected rule ids and exact minor-unit totals matched.
**Edge cases run:** 20 of 20 from section 6 Step 4. Failures: none after fixes. Pre-fix failures were non-UTC offset selection, uncovered zero amount returning 200/0%, and discount larger than amount becoming a refund.
**Score ceiling:** 99/100 without adding the out-of-scope shared datastore. The highest-value bounded remaining change is F-033: label the six undocumented illustrative rules, make the test assert zero omissions, and correct the demo heading.

## What resisted attempts to break it

- **A:** 70 live combinations independently recomputed from the exposed rule catalogue; threshold ±1, one-minor-unit, largest exact amount, refund, inclusive-tax and date-boundary probes all held after the patch.
- **D:** rate, treatment, UPDATE and DELETE attacks were attempted directly against SQLite; all immutable mutations now abort, while stamping `superseded_at` still succeeds.
- **E:** `lib/calculator.ts` and `lib/rules.ts` have no database, Next or clock dependency; build and standalone TypeScript checks are clean; compliance aggregation remains SQL-based.

## Left undone

- **F-033:** factual catalogue/demo claims; deferred only because this pass reached the five-change cap.
- **F-034:** mixed response casing. Values are complete and usable, but the contract is inconsistent with the README.
- `npm audit --omit=dev` reports three high findings through Next's bundled PostCSS/Sharp tree. npm proposes an invalid major downgrade (`next@9.3.3`), and this is not a scored gap; no dependency change was made.

## Next pass

Start with F-033, then F-034. Re-run the matrix after any response translation. Do not revisit the documented Vercel cold-instance limitation without approval for a shared external datastore.
