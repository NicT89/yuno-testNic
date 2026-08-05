# 0019 — cursor — QA probe baseline established

**When:** 2026-08-05T09:15Z
**Agent:** cursor
**Task:** QA probe run 001 (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-039 / QA-001, F-040 / QA-002, F-041 / QA-003
**Files changed:** audit/qa/STATE.json, audit/qa/runs/RUN-001.md, audit/qa/LATEST.md, audit/findings/FINDINGS.md

## What changed
Established the first durable daily QA baseline and carried forward consecutive
failure history from automation memory. Escalated two production P0s and one
persistent clean-clone P1; product code was not modified.

## Verified how
Ran J1–J9 against `https://yuno-tax.vercel.app` with fixed `qa_probe_` ids.
Fresh clone: 30 rules, 57 fixtures / 0 errors, 35 tests, build, demo, typecheck,
and local smoke 8/8. J11 changed local CO IVA to 2100 bps and the pre-change
audit response SHA remained `efe340af...ae5`.

## For the next agent
QA-001 has failed 22 consecutive probes; QA-002 and QA-003 have failed 14.
Open [PR #7](https://github.com/NicT89/yuno-testNic/pull/7) and
[PR #8](https://github.com/NicT89/yuno-testNic/pull/8) overlap shared audit
artifacts; F-039+ and log 0019 avoid their allocated identifiers. Retest
production rather than assuming PR #8's local audit fix has deployed.
