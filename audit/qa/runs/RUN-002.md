# QA Probe Run 002 — 2026-08-05T10:05:27Z — tier: hourly

**Status:** BROKEN
**Checks:** 18/20   **Suppressed:** 0   **New since last run:** 0

## Findings
No new reportable findings. QA-001 and QA-002 reproduced with unchanged
signatures; both were reported less than 24 hours ago, so this run does not
repeat their alerts.

## Regressions (passed last run, failing now)
None.

## Fixed autonomously
None.

## Escalated
None this run. QA-001 (unknown categories are silently taxed) remains P0 at 23
consecutive failures. QA-002 (route-level validation failures are absent from
the audit trail) remains P0 at 15 consecutive failures. QA-003 was not exercised
by the hourly tier and remains open at 14 daily failures.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 303.38ms over 44 requests (previous
96.12ms); the slowest request was consistent with cold-start/network noise and
no endpoint returned 5xx. The local engine p99 baseline remains 1.609ms.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
computed rule arithmetic exactly; BR digital services charged 1425 bps with
zero ICMS. Refund symmetry, idempotent replay with one audit row, the BR
1700/1800 bps date split, seeded and live audit reads, and report reconciliation
all passed. Six structured validation cases returned 4xx, and the pre-rule date
returned 422 `NO_APPLICABLE_RULE`.

Consecutive-failure watchlist: QA-001 23; QA-002 15; QA-003 14 daily runs.
