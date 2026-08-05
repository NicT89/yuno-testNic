# QA Probe Run 001 — 2026-08-05T09:20:19Z — tier: daily

**Status:** BROKEN
**Checks:** 27/30   **Suppressed:** 0   **New since last run:** 0 (three carried-forward failures published)

This is the first repository state file, but persistent automation history
corroborates the consecutive-failure counts below. It establishes the durable
baseline without discarding observations from the runs that were blocked by
shared audit-file ownership.

## Findings
| ID | Sev | Check | Classification | What a user sees | Evidence |
|----|-----|-------|----------------|------------------|----------|
| QA-001 | P0 | J7 | BROKEN (22 consecutive) | An unrecognised merchant product category is silently taxed at Brazil's 17% wildcard ICMS rate instead of being rejected with 422 `NO_APPLICABLE_RULE`. | `POST /api/tax/calculate` with `transaction_id=qa_probe_j7_unknown_category_01`, `country_code=BR`, `product_category=totally_unknown_category`, `amount_minor=10000` returned 200, `taxAmountMinor=1700`, rule `BR:*:ICMS@v1`. Expected 422. Signature `baed80eb...bb4`. |
| QA-002 | P0 | J7 | BROKEN (14 consecutive) | A rejected checkout is absent from the immutable audit trail, so compliance cannot prove that the request happened. | Missing-amount POST with `transaction_id=qa_probe_j7_missing_amount_01` returned structured 400; immediate `GET /api/audit/qa_probe_j7_missing_amount_01` returned 404 `AUDIT_RECORD_NOT_FOUND`. Signature `68e3e654...843`. |
| QA-003 | P1 | J10 | BROKEN (14 daily runs) | A reviewer following the documented clean-clone commands ends with a dirty worktree. | After `npm run demo`, `git status --short` listed all five tracked `reports/compliance-report-*.json` files modified. Signature `2db59f7d...65f`. |

## Regressions (passed last run, failing now)
None. All three signatures were already failing in persistent probe history.

## Fixed autonomously
Corrected this run's unsupported-currency probe from `USD` (intentionally
supported by `CURRENCY_EXPONENTS`) to `XYZ`; it returned a structured 400.
No product expectation was changed.

## Escalated
QA-001 and QA-002 are production P0 product defects under `lib/**` and
`app/**`; QA-003 is a P1 acceptance failure persistent beyond three runs.
They are outside this agent's autonomy boundary and cross-referenced as
F-039, F-040 and F-041. Open
[PR #8](https://github.com/NicT89/yuno-testNic/pull/8) contains a local
audit-failure fix, but it is neither merged nor deployed, so QA-002 remains
open on production.

## Added to KNOWN.md
None.

## Trend
Production request latency p99 96.12ms over 43 requests (first baseline; network-inclusive). Cold/warm readback success 5/5. Local engine demo p99 1.609ms.

Consecutive-failure watchlist: QA-001 22; QA-002 14; QA-003 14 daily runs.
Other validation cases returned structured 4xx responses and no endpoint
returned 5xx.

Daily verification: Node 22.14.0; 30 rule versions; 57 fixtures / 0 errors; 35 tests passed; build and typecheck clean; demo completed; smoke 8/8; local rule mutation applied 2100 bps and left the historical audit response byte-identical (`efe340af...ae5` before and after).
