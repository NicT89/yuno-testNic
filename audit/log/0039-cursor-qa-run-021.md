# 0039 — cursor — QA probe run 021

**When:** 2026-08-06T06:08Z
**Agent:** cursor
**Task:** Daily QA probe (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040, F-041
**Files changed:** `audit/qa/STATE.json`, `audit/qa/LATEST.md`, `audit/qa/runs/RUN-021.md`, `audit/ACTIVE.md`

## What changed
Recorded daily run 021 with 27/30 checks passing. The three existing defects
reproduced with unchanged signatures; no new finding or regression was opened.

## Verified how
Production J1–J9 made 50 measured requests with no network errors or 5xx.
A Node 22 clean clone passed 30-rule/57-fixture seed, 35 tests, build, demo,
typecheck and smoke 8/8. Local J11 applied 1900→2100 bps and preserved the
historical audit response byte-for-byte.

## For the next agent
Failure counts are QA-001 42, QA-002 34 and QA-003 15 daily runs. Reseed and
restart after `npm run demo` before J11, because the demo itself publishes CO
IVA v2 and otherwise turns the intended v1→v2 journey into a false v2→v3 test.
