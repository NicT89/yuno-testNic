# 0017 — cursor — QA probe baseline established

**When:** 2026-08-05T09:11Z
**Agent:** cursor
**Task:** QA probe run 001 (`docs/13-QA-PROBE-AGENT.md`)
**Findings touched:** F-028 / QA-001
**Files changed:** audit/qa/STATE.json, audit/qa/runs/RUN-001.md, audit/qa/LATEST.md, audit/findings/FINDINGS.md

## What changed
Established the first daily QA baseline and escalated one P0: unknown product
categories are silently charged a country wildcard rate instead of returning
422. Lower-severity first observations were recorded in state for the next run.

## Verified how
Ran J1–J9 against `https://yuno-tax.vercel.app` with fixed `qa_probe_` ids.
Fresh clone: 30 rules, 57 fixtures / 0 errors, 35 tests, build, demo, typecheck,
and local smoke 8/8. J11 changed local CO IVA to 2100 bps and the pre-change
audit response SHA remained `efe340af...ae5`.

## For the next agent
Read `STATE.json` and increment each exact signature independently. QA-001 is
already reported; do not report it again within 24 hours unless severity rises.
The P1 watchlist starts at one failure, and generated reports made the clean
clone dirty after `npm run demo`.
