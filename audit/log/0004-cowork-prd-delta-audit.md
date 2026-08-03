# 0004 — cowork — PRD delta audit

**When:** 2026-08-03T02:28Z
**Agent:** cowork
**Task:** audit
**Findings touched:** F-015 … F-021 (opened)
**Files changed:** `docs/07-PRD-DELTA.md`, `audit/findings/FINDINGS.md`, `audit/ACTIVE.md`

## What changed
Audited the supplied PRD against the code on disk. Seven findings. One is a
real defect (F-015), three are cheap wins (F-017, F-019, F-020), two are
framing (F-018, F-021), one is benign (F-016).

The PRD is weaker than our design in one important place: it specifies a single
`effective_date` axis, which cannot satisfy its own "Historical Immutability"
clause. Our bitemporal model stays. Do not simplify toward the PRD here.

## Verified how
Reproduced F-015 against the reference build:
```
call 2, SAME transaction_id -> THROWS: UNIQUE constraint failed:
                               tax_calculation_audit.transaction_id
```
Read `app/api/tax/rules/route.ts` (GET only), `lib/compliance.ts`,
`scripts/schema.sql:56`, `scripts/seed-db.ts:80`, `lib/calculator.ts:59`.

## For the next agent
`lib/compliance.ts` aggregates tax-type totals in SQL with
`json_each(json_extract(...))`. That is better than the reference build, which
does it in a JS loop and would not survive the PRD's 100,000/day target. Leave
it alone.

F-015 is the only one that will visibly break in front of a reviewer. Fix it
inside T3 while you are already in `lib/audit.ts`: on a caller-supplied
`transaction_id` collision, return the stored record with `replayed: true`
rather than inserting.

F-019 is one JSON entry, no code change — the stacking engine already handles
N taxes. It upgrades the Brazil demo from two tax levels to the three the PRD
and the original brief both describe.
