# 0018 — cursor — rubric audit pass 002

**When:** 2026-08-04T14:18Z
**Agent:** cursor
**Task:** Rubric Audit Pass 002 (`docs/12-RUBRIC-AUDIT-AGENT.md`)
**Findings touched:** F-033, F-034, F-035, F-036, F-037, F-038
**Files changed:** `data/tax-rules.json`, `lib/{calculator,http,tax-service}.ts`, `app/api/tax/calculate/route.ts`, `scripts/{demo,test-tax}.ts`, `verify/smoke-test.sh`, `reports/*.json`, `audit/**`

## What changed

Documented all illustrative rules and corrected the demo matrix; normalized all
JSON response keys; gave validation failures unique, retrievable audit
identities; and made zero-amount output provenance match its audit snapshot.
Published score moved 96→98; targeted probes measured the pre-fix tree at 92.
F-038 records the bounded documentation drift left at the five-finding cap.

## Verified how

`npm run db:seed` → 30 rules, 57 fixtures, 0 errors; `npm test` → all 35;
`npm run build` and `npx tsc --noEmit` clean; `npm run demo` complete with
seven displayed categories and five reports. Independent local API probe:
70/70 combinations, 20/20 prescribed edges and 5/5 finding regressions.
Local smoke 8/8; deployed smoke 8/8.

## For the next agent

Start with F-038: update linked docs from 29/56 to 30/57, reconcile the
statutory-rate language with the illustrative-data disclaimer, and add a direct
README link to the committed BR report. Then test audit-list pagination
metadata and whether optional CSV output needs its own edge-case section.
