# QA Probe Run 003 — 2026-08-05T12:03:25Z — tier: hourly

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
None this run. QA-001 (unknown categories are silently taxed) remains P0 at 24
consecutive failures. QA-002 (route-level validation failures are absent from
the audit trail) remains P0 at 16 consecutive failures. QA-003 was not exercised
by the hourly tier and remains open at 14 daily failures.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 265.22ms over 40 requests (previous
303.38ms); no endpoint returned 5xx and no network request failed. The local
engine p99 baseline remains 1.609ms.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
computed rule arithmetic exactly; BR digital services charged 1425 bps with
zero ICMS. Refund symmetry, idempotent replay with one audit row, the BR
1700/1800 bps date split, seeded and live audit reads, and report reconciliation
all passed. Five route-validation cases returned structured 400 responses; the
pre-rule date returned 422 `NO_APPLICABLE_RULE`.

Consecutive-failure watchlist: QA-001 24; QA-002 16; QA-003 14 daily runs.
