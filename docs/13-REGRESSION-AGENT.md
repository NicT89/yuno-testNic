# Hourly Regression Agent — SUPERSEDED

Merged into [`docs/13-QA-PROBE-AGENT.md`](13-QA-PROBE-AGENT.md), which is now
the single authoritative brief for the hourly probe agent.

What carried over from this file: the corroboration rule gating any autonomous
edit to an expected value (section 7), the seeded-id carve-out that keeps a
`GET /api/audit/txn_br_0001` 404 at P0 while K-001 suppresses the cold-start
case (`audit/qa/KNOWN.md`), the run-safety rules on concurrency and
mid-change trees (section 13), and the numeric golden-value fingerprint
(section 14).

Do not use this file. It is kept only so the merge is traceable.
