# 0023 — cursor — hourly QA probe run 005

**When:** 2026-08-05T14:06:53Z
**Agent:** cursor
**Task:** QA probe run 005 (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040, F-041
**Files changed:** audit/qa/STATE.json, audit/qa/LATEST.md, audit/qa/runs/RUN-005.md, audit/ACTIVE.md

## What changed
Ran the hourly J1–J8 production journeys with fixed `qa_probe_` transaction
ids and advanced the durable QA state. No new regression appeared; QA-001 and
QA-002 reproduced with unchanged signatures and were not re-alerted inside the
24-hour noise window. QA-003 remains open and was not due on the hourly tier.

## Verified how
Forty-four production requests completed with zero network errors and zero 5xx
responses. Eighteen of twenty state checks passed; the 15-case sweep matched
independently resolved rules and integer arithmetic, BR digital services
remained 1425 bps with zero ICMS, idempotency replayed, and report totals
reconciled. `STATE.json` parsed successfully, `LATEST.md` was byte-identical to
`RUN-005.md`, and `git diff --check` passed.

## For the next agent
Continue from run 005. QA-001 is at 26 consecutive failures, QA-002 at 18, and
QA-003 at 14 daily runs. A post-write audit list returned zero rows after the
idempotency response had already proved a replay; suppress this under K-001's
documented per-instance `/tmp` behaviour rather than treating it as a duplicate
write.
