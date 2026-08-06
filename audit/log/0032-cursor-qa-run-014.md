# 0032 — cursor — QA probe run 014

**When:** 2026-08-05T23:05:57Z
**Agent:** cursor
**Task:** QA probe run 014 (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040, F-041
**Files changed:** audit/qa/STATE.json, audit/qa/LATEST.md, audit/qa/runs/RUN-014.md, audit/ACTIVE.md

## What changed
Ran the hourly J1–J8 production journeys and advanced the durable QA state.
QA-001 and QA-002 reproduced unchanged; the 24-hour noise budget suppressed
duplicate alerts. QA-003 remains open and was not exercised on the hourly tier.

## Verified how
45 production requests: 18/20 checks passed, with no network errors or 5xx.
All tax arithmetic, audit reads, idempotency, date selection, report
reconciliation, and rule-read checks passed; only the two established P0
signatures failed. Network-inclusive p99 was 76.83ms.

## For the next agent
Continue with run 015 from `audit/qa/STATE.json`. Reuse the fixed request bodies:
changing a body under an existing `qa_probe_` id replays historical data and
creates false numeric mismatches. Do not re-alert QA-001 or QA-002 inside their
24-hour window unless severity rises.
