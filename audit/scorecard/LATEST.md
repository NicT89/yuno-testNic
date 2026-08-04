# Rubric Audit Pass 002 — 2026-08-04T14:18:00Z

**Previous:** 96/100   **This pass:** 98/100   **Delta:** +2

The targeted pre-fix probes exposed deductions pass 001 had missed, so the
measured baseline was 92/100 before F-033–F-037 were applied.

| # | Criterion | Max | Score | Deductions (evidence: file:line, or the request/response a grader would see) |
|---|---|---:|---:|---|
| A | Tax calculation accuracy | 25 | 25 | No deduction. Covered zero amounts now name the matched rule versions, and the independent API matrix passes exact ids and minor-unit totals. |
| B | API design & usability | 15 | 15 | No deduction after F-034/F-036. Every JSON key is snake_case at the boundary; an invalid-then-corrected transaction-id probe now returns 400 then 200 rather than 500. |
| C | Audit trail + reporting | 20 | 19 | One point remains off for the documented Vercel per-instance `/tmp` durability boundary (`README.md:270-283`). Rejected-request collisions and zero-output provenance are fixed. |
| D | Rule management | 20 | 20 | Direct immutable-column probes remain green; valid time and system time stay independent. |
| E | Code quality | 10 | 10 | Pure-core import scan, no-`any` scan, build/typecheck and SQL aggregation inspection remain green. |
| F | Documentation | 10 | 9 | F-038: linked process/catalogue docs retain stale 29/56 and statutory-rate claims; README does not directly link a committed report. |
|   | **Total** | **100** | **98** |  |

**Combinations verified:** 70 of 70 (five countries × seven categories × two customer types). Failures: none; expected rule ids and exact minor-unit totals matched.
**Edge cases run:** 20 of 20 from section 6 Step 4. Failures: none.
**Score ceiling:** 99/100 without the out-of-scope shared datastore. The highest-value bounded remaining change is F-038: correct linked documentation counts/disclaimer and link the committed BR report.

## What resisted attempts to break it

- **A:** zero, refund, one minor unit, maximum exact amount, threshold −1/at/+1,
  over/equal discounts, inclusive decomposition and date boundaries all passed.
- **B/C:** valid-then-invalid requests produced separate retrievable success and
  rejection rows; invalid-then-corrected requests returned 400 then 200 under
  the requested id. Recursive casing checks found no uppercase JSON keys across
  calculation, audit, rules and reporting responses.
- **D/E:** all rule columns remain immutable except the first supersession
  stamp; pure domain files contain no database, Next or clock imports; report
  aggregation still uses SQL and `json_each`.

## Left undone

- **F-038:** bounded documentation drift, deferred at the five-finding cap.
- The Vercel `/tmp` write-sharing limit still requires a new external datastore
  and remains out of scope without human approval.
- Optional CSV reports do not repeat the JSON `edge_cases` block; the required
  committed deliverable is JSON and fully includes it, so this did not clear a
  full-point action bar.

## Next pass

Start with F-038, then probe audit-list pagination metadata and CSV completeness.
Do not revisit the Vercel durability boundary without approval for shared
storage.
