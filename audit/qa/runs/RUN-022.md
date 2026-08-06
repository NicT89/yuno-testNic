# QA Probe Run 022 — 2026-08-06T07:06:52.926Z — tier: hourly

**Status:** BROKEN
**Checks:** 18/20   **Suppressed:** 0   **New since last run:** 0

## Findings
No new reportable findings. QA-001 and QA-002 reproduced with unchanged
behaviour; both were reported less than 24 hours ago, so this run does not
repeat their alerts.

## Regressions (passed last run, failing now)
None.

## Fixed autonomously
None.

## Escalated
None this run. QA-001 remains P0 at 43 consecutive failures: an unknown BR
category returned 200 and 1700 tax through `BR:*:ICMS@v1`, not 422
`NO_APPLICABLE_RULE`. QA-002 remains P0 at 35 consecutive failures: a
missing-amount request returned structured 400, but its fixed transaction id
still returned 404 from the audit endpoint. QA-003 was not exercised because
the daily tier already ran after 06:00; it remains at 15 daily failures.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 was 68.88ms over 50 read requests
(previous 285.97ms); there were no network errors or 5xx responses across 94
measured requests. This includes network and instance overhead and is not the
local engine NFR measurement.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
resolved published rules and integer arithmetic exactly. BR digital services
charged 1425 bps with an explicit zero-rate ICMS line and 2850 minor tax on
19999 minor. Refunds were symmetric, the retry replayed with one audit row,
the BR date split remained 1700/1800 bps, and the report reconciled exactly
(96587 category tax and total tax; 1604 bps average on 602228 base).

Consecutive-failure watchlist: QA-001 43; QA-002 35; QA-003 15 daily runs.
