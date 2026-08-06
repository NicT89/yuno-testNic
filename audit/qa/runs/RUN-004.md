# QA Probe Run 004 — 2026-08-05T13:04:43Z — tier: hourly

**Status:** BROKEN
**Checks:** 18/20   **Suppressed:** 0   **New since last run:** 0

## Findings
No new reportable findings. QA-001 and QA-002 reproduced with unchanged
signatures; both were reported less than 24 hours ago, so this run does not
repeat their alerts.

## Regressions (passed last run, failing now)
None.

## Fixed autonomously
| Check | What | Verified by |
|---|---|---|
| Probe fixtures | Corrected this run's transient probe to reuse the established fixed request bodies recorded in the immutable audit trail. | Reran J1–J8: J2 matched 15/15 independent calculations and J4 replayed with exactly one audit row. |

## Escalated
None this run. QA-001 (unknown categories are silently taxed) remains P0 at 25
consecutive failures. QA-002 (route-level validation failures are absent from
the audit trail) remains P0 at 17 consecutive failures. QA-003 was not exercised
by the hourly tier and remains open at 14 daily failures.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 109.29ms over 40 requests (previous
265.22ms); no endpoint returned 5xx and no network request failed. The local
engine p99 baseline remains 1.609ms.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
computed rule arithmetic exactly; BR digital services charged 1425 bps with
zero ICMS. Refund symmetry, idempotent replay with one audit row, the BR
1700/1800 bps date split, seeded and live audit reads, and report reconciliation
all passed. Five route-validation cases returned structured 400 responses; the
pre-rule date returned 422 `NO_APPLICABLE_RULE`.

Consecutive-failure watchlist: QA-001 25; QA-002 17; QA-003 14 daily runs.
