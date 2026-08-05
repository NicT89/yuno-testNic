# Rubric Audit Pass 003 — 2026-08-05T14:15:00Z

**Previous:** 98/100   **This pass:** 98/100   **Delta:** 0

Targeted probes exposed hidden report, dependency and calculation deductions.
Five bounded changes closed the highest risks; the remaining rule-write
timestamp gap keeps the published score level with the previous pass.

| # | Criterion | Max | Score | Deductions (evidence: file:line, or the request/response a grader would see) |
|---|---|---:|---:|---|
| A | Tax calculation accuracy | 25 | 25 | No deduction. An independent 70-case API matrix matched exact rates, minor-unit totals and rule-version ids; all 20 prescribed edges passed. |
| B | API design & usability | 15 | 15 | No deduction after F-039/F-040. Malformed and reversed ranges return structured 400s, date-only bounds include the whole day, and audit pages expose total/continuation metadata. |
| C | Audit trail + reporting | 20 | 19 | One point remains off for the documented Vercel per-instance `/tmp` durability boundary (`README.md:275-287`). Empty and same-day report windows now return complete reports. |
| D | Rule management | 20 | 19 | F-043: rule-write valid-time timestamps are not UTC-canonicalized before the pure resolver compares them lexicographically. Seeded date-only windows and immutable-column probes remain green. |
| E | Code quality | 10 | 10 | No deduction after F-041. Build/typecheck and pure-core checks pass; production dependency audit reports zero vulnerabilities. |
| F | Documentation | 10 | 10 | No deduction after F-038. Counts/disclaimers agree with source, the BR report is directly linked, and the 400-word architecture deliverable is committed. |
|   | **Total** | **100** | **98** |  |

**Combinations verified:** 70 of 70 (five countries × seven categories × two customer types). Failures: none.
**Edge cases run:** 20 of 20 from section 6 Step 4. Failures: none; the initial USD probe was corrected to a genuinely unsupported code (`XYZ`) because USD is intentionally supported.
**Score ceiling:** 99/100 without the out-of-scope shared datastore. The highest-value bounded change is F-043: canonicalize and validate rule valid-time bounds.

## What resisted attempts to break it

- **A/D:** exact-rate matrix, rounding, refund, one-unit, maximum-safe amount,
  threshold boundaries, discount, inclusive-price, valid-time/system-time and
  direct immutability probes held. A cross-probe of inclusive price × threshold
  found and fixed F-042.
- **B/C:** empty periods, same-day date filters, malformed/reversed ranges,
  pagination totals, JSON/CSV rendering and local smoke now pass.
- **E/F:** clean build/typecheck, production dependency audit, clean-clone
  setup, artifact tracking, architecture word count and factual-count scans pass.

## Left undone

- Vercel `/tmp` remains per-instance. Shared durability requires an external
  datastore, which section 10 requires a human to approve.
- **F-043:** rule-write valid-time offsets are stored raw; fix next because the
  fifth-change cap was reached.
- **F-044:** anonymous 422 responses omit the generated audit URL even though
  the immutable row exists. The audit requirement still holds, so no additional
  full-point deduction was taken.
- **F-045:** one stale rule-resolution comment describes the old Brazil stack.
- Optional CSV output remains a category/totals view and does not repeat the
  JSON `edge_cases` detail. The required committed JSON deliverable includes
  the full block, so this does not clear the one-point action bar.

## Next pass

Start with F-043, then F-044/F-045 and replay behavior after multiple successive
versions. Do not revisit shared Vercel durability without approval.
