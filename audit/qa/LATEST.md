# QA Probe Run 001 — 2026-08-05T09:11:13Z — tier: daily

**Status:** BROKEN
**Checks:** 22/29   **Suppressed:** 0   **New since last run:** 1 reportable (new baseline)

This is the first probe run. It establishes the baseline; only the hard P0 failure below is reported.

## Findings
| ID | Sev | Check | Classification | What a user sees | Evidence |
|----|-----|-------|----------------|------------------|----------|
| QA-001 | P0 | J7 | NEW | An unrecognised merchant product category is silently taxed at Brazil's 17% wildcard ICMS rate instead of being rejected with 422 `NO_APPLICABLE_RULE`. | `POST /api/tax/calculate` with `transaction_id=qa_probe_j7_unknown_category_01`, `country_code=BR`, `product_category=totally_unknown_category`, `amount_minor=10000` returned 200, `taxAmountMinor=1700`, rule `BR:*:ICMS@v1`. Expected 422. Signature `baed80eb...bb4`. |

## Regressions (passed last run, failing now)
None — this is the first run.

## Fixed autonomously
None.

## Escalated
QA-001 is product rule-resolution behaviour under `lib/**`, outside this agent's autonomy boundary. It is score-relevant and cross-referenced as F-028. Do not change the expected value: no product commit, finding, or agent-feedback entry authorises this numeric behaviour.

## Added to KNOWN.md
None.

## Trend
Production request latency p99 96.12ms over 43 requests (first baseline; network-inclusive). Cold/warm readback success 5/5. Local engine demo p99 1.609ms.

Consecutive-failure watchlist: J7 missing amount, unknown country, non-integer amount, and malformed date returned structured 400 instead of the journey's expected 422 (1 run each); unsupported currency returned 200 with tax (1); J10 left five generated compliance reports modified after the documented command sequence (1). These first-observed P1 signals are recorded but not reported until the triage threshold is met.

Daily verification: Node 22.14.0; 30 rule versions; 57 fixtures / 0 errors; 35 tests passed; build and typecheck clean; demo completed; smoke 8/8; local rule mutation applied 2100 bps and left the historical audit response byte-identical (`efe340af...ae5` before and after).
