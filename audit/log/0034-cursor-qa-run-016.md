# 0034 — cursor — QA probe run 016

**When:** 2026-08-06T01:05:26.147Z
**Agent:** cursor
**Task:** QA probe run 016 (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040, F-041
**Files changed:** audit/qa/STATE.json, audit/qa/LATEST.md, audit/qa/runs/RUN-016.md, audit/ACTIVE.md

## What changed
Ran the hourly J1–J8 production journeys with the established fixed
`qa_probe_` transaction bodies. Recorded 18/20 passing checks; QA-001/F-039
and QA-002/F-040 reproduced unchanged, while daily-only QA-003/F-041 was not
exercised.

## Verified how
Issued 44 value-asserting requests to `https://yuno-test-nic.vercel.app`.
J1–J6 and J8 passed, there were no network errors or 5xx responses, and
network-inclusive p99 was 205.92ms.

## For the next agent
Continue from run 016. Failure counts are QA-001 37, QA-002 29, and QA-003
14 daily runs. Reuse the exact established request bodies: changing a body
under an existing `qa_probe_` id replays historical data and creates false
numeric mismatches.
