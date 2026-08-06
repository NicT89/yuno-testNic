# QA Probe Run 021 — 2026-08-06T06:08:11.284Z — tier: daily

**Status:** BROKEN
**Checks:** 27/30   **Suppressed:** 0   **New since last run:** 0

## Findings
No new reportable findings. QA-001, QA-002 and QA-003 reproduced with
unchanged signatures; all were reported less than 24 hours ago, so this run
does not repeat their alerts.

## Regressions (passed last run, failing now)
None.

## Fixed autonomously
Corrected the local J11 probe sequence after `npm run demo` had deliberately
published CO IVA v2. The clone was reseeded and its server restarted before
the independent mutation journey, preventing a false v2-to-v3 assertion. The
final seeded v1-to-v2 check passed.

## Escalated
None this run. QA-001 remains P0 at 42 consecutive failures: an unknown BR
category returned 200 and 1700 tax through `BR:*:ICMS@v1`, not 422
`NO_APPLICABLE_RULE`. QA-002 remains P0 at 34 consecutive failures: a
missing-amount request returned structured 400, but its fixed transaction id
still returned 404 from the audit endpoint. QA-003 remains P1 at 15 daily
failures: the documented demo rewrote all five tracked compliance reports and
left the fresh clone dirty.

## Added to KNOWN.md
None.

## Trend
Production network-inclusive latency p99 was 285.97ms over 50 requests
(previous 132.72ms); there were no network errors or 5xx responses. This
includes network and instance overhead and is not the local engine NFR
measurement. Local engine p99 was 1.845ms, safely below 50ms (previous daily
baseline 1.609ms). J9 complete calculate-and-audit success was 5/5.

J1–J6 and J8 passed. The 15-case country/category sweep matched independently
resolved rules and integer arithmetic exactly. BR digital services charged
1425 bps with a zero-rate ICMS line and 2850 minor tax on 19999 minor. Refunds
were symmetric, the idempotency retry returned the same result with
`replayed_from_idempotency_key: true` and its audit-list count remained 1,
the BR date split remained 1700/1800 bps, and the report reconciled exactly
(93187 category tax and total tax; 1601 bps average on 582228 base).

Daily verification on Node 22.14.0: install passed; seed produced 30 rule
versions and 57 fixtures with 0 errors; all 35 tests passed; build, demo and
typecheck passed; smoke passed 8/8. J11 changed CO IVA from 1900 to 2100 bps
locally and left the historical audit response byte-identical
(`d5c8f8885a7e9027de84448b428519477fc813032fe074affdaa4acc4992e408`
before and after).

Consecutive-failure watchlist: QA-001 42; QA-002 34; QA-003 15 daily runs.
