# QA Probe Run 018 — 2026-08-06T03:04:40.845Z — tier: hourly

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
None this run. QA-001 remains P0 at 39 consecutive failures: an unknown BR
category returned 200 and 1700 tax through `BR:*:ICMS@v1`, not 422
`NO_APPLICABLE_RULE`. QA-002 remains P0 at 31 consecutive failures: a
missing-amount request returned structured 400, but its fixed transaction id
still returned 404 from the audit endpoint. QA-003 was not exercised by the
hourly tier and remains open at 14 daily failures.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 was 408.84ms over 44 requests
(previous 160.69ms); there were no network errors or 5xx responses. This
includes network and instance overhead and is not the local engine NFR
measurement. The local engine p99 baseline remains 1.609ms.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
resolved rules and integer arithmetic exactly. BR digital services charged
1425 bps with a zero-rate ICMS line and 2850 minor tax on 19999 minor. Refunds
were symmetric, the idempotency retry returned the same result with
`replayed_from_idempotency_key: true` and its audit-list count remained 1,
the BR date split remained 1700/1800 bps, and the report reconciled exactly
(93187 category tax and total tax; 1601 bps average on 582228 base).

Consecutive-failure watchlist: QA-001 39; QA-002 31; QA-003 14 daily runs.
