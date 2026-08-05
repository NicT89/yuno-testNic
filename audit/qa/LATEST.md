# QA Probe Run 007 — 2026-08-05T16:10:18Z — tier: hourly

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
None this run. QA-001 remains P0 at 28 consecutive failures: an unknown BR
category returned 200 and 1700 tax through `BR:*:ICMS@v1`, not 422
`NO_APPLICABLE_RULE`. QA-002 remains P0 at 20 consecutive failures: a
missing-amount request returned structured 400, but its fixed transaction id
still returned 404 from the audit endpoint. QA-003 was not exercised by the
hourly tier and remains open at 14 daily failures.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 was 165.88ms over 44 requests
(previous 122.41ms); there were no network errors or 5xx responses. The local
engine p99 baseline remains 1.609ms.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
resolved rules and integer arithmetic exactly. BR digital services charged
1425 bps with a zero-rate ICMS line and 2850 minor tax on 19999 minor. Refunds
were symmetric, the idempotency retry returned the same result with
`replayed_from_idempotency_key: true` and its audit-list count remained 1,
the BR date split remained 1700/1800 bps, and the report reconciled exactly.

Consecutive-failure watchlist: QA-001 28; QA-002 20; QA-003 14 daily runs.
