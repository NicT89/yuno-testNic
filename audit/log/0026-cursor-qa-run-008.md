# 0026 — cursor — QA probe run 008

**When:** 2026-08-05T17:06Z
**Agent:** cursor
**Task:** Hourly QA probe (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039, F-040, F-041
**Files changed:** audit/qa/STATE.json, audit/qa/LATEST.md, audit/qa/runs/RUN-008.md

## What changed
Recorded hourly production probe run 008. QA-001/F-039 and QA-002/F-040
reproduced with unchanged signatures; the run did not repeat either alert
inside the 24-hour noise budget. QA-003/F-041 remains open and was not due in
the hourly tier.

## Verified how
Ran J1–J8 against `https://yuno-tax.vercel.app`: 18/20 checks passed over 45
requests, with no network errors or 5xx. The two failures were the known open
signatures; all numeric, idempotency, report-reconciliation, date-selection,
seeded-audit and rule-read checks passed.

## For the next agent
Continue from run 008. QA-001 is at 29 consecutive failures, QA-002 at 21, and
QA-003 at 14 daily failures. Network-inclusive p99 was 512.91ms. Do not bound
the J4 audit-list verification with a date-only `to` value; transaction
timestamps include a time, so use the country query and count the fixed id.
