# 0020 — cursor — hourly QA probe run 002

**When:** 2026-08-05T10:05Z
**Agent:** cursor
**Task:** QA probe run 002 (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039 / QA-001, F-040 / QA-002
**Files changed:** audit/qa/STATE.json, audit/qa/runs/RUN-002.md, audit/qa/LATEST.md

## What changed
Recorded the second durable QA run. No regression or new signature appeared;
the two existing production P0 signatures reproduced and were not re-alerted
inside the 24-hour noise window.

## Verified how
Ran J1–J8 against `https://yuno-tax.vercel.app` using fixed `qa_probe_`
transaction ids: 18/20 checks passed, with no 5xx. Independent arithmetic
matched all 15 country/category responses; idempotency, audit reads, date
selection, refund symmetry and report reconciliation passed.

## For the next agent
QA-001 is now at 23 consecutive failures and QA-002 at 15. QA-003 remains at
14 daily failures because J10 is not part of the hourly tier. Network-inclusive
p99 was 303.38ms; the local engine baseline remains 1.609ms.
