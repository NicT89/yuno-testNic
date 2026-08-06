# 0040 — cursor — QA probe run 022

**When:** 2026-08-06T07:06Z
**Agent:** cursor
**Task:** Hourly QA probe (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040
**Files changed:** `audit/qa/STATE.json`, `audit/qa/LATEST.md`, `audit/qa/runs/RUN-022.md`, `audit/ACTIVE.md`

## What changed
Recorded hourly run 022 with 18/20 checks passing. The two existing production
defects reproduced with unchanged behaviour; no new finding or regression was
opened.

## Verified how
Production J1–J8 made 94 measured requests with no network errors or 5xx. The
15-case sweep matched independently resolved published rules and integer tax
math, and audit, refund, idempotency, date-selection, report and rule-history
journeys all passed.

## For the next agent
Failure counts are QA-001 43 and QA-002 35; QA-003 remains at 15 daily runs.
The next firing is hourly because run 021 already completed today's first
post-06:00 daily tier.
