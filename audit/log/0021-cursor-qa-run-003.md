# 0021 — cursor — QA probe run 003

**When:** 2026-08-05T12:03:25Z
**Agent:** cursor
**Task:** Hourly QA probe (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040, F-041
**Files changed:** audit/qa/STATE.json, audit/qa/LATEST.md, audit/qa/runs/RUN-003.md, audit/ACTIVE.md

## What changed
Recorded hourly run 003 against production. No new signature appeared:
QA-001/F-039 and QA-002/F-040 reproduced, while QA-003/F-041 remained open
and was not exercised by the hourly tier.

## Verified how
Ran J1–J8 against `https://yuno-tax.vercel.app`: 18/20 checks passed over 40
requests with no 5xx or network failures. The 15-case sweep matched
independently calculated rule arithmetic; p99 network-inclusive latency was
265.22ms.

## For the next agent
Carry forward QA-001 at 24 consecutive failures, QA-002 at 16, and QA-003 at
14 daily failures. Do not repeat their alerts within 24 hours unless severity
rises; all three signatures are unchanged.
