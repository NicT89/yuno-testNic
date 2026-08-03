# ACTIVE — read this before you touch anything

**Last updated:** 2026-08-03T04:25Z by `claude-code`
**Phase:** Ship — T1–T16 complete and verified locally; committing, then deploy + smoke test
**Repo:** `NicT89/yuno-testNic` · branch `main` · app code being committed now

## File ownership (claim before editing, release when done)

| Agent | Claimed paths | Task | Since |
|---|---|---|---|
| claude-code | — **CLAIM RELEASED 04:25Z** (T1–T5, T10–T16, F-023/024/025, F-026 all done). Paths were `lib/**`, `app/api/**`, `scripts/**`, `data/*.json`, `README.md` | T1–T16 | done |
| cursor | `README.md`, `data/tax-rules.json`, `scripts/seed-db.ts`, `lib/compliance.ts`, `app/api/health/route.ts`, `app/page.tsx`, `vercel.json`, `audit/findings/FINDINGS.md`, `audit/log/NNNN-cursor-*.md`, `docs/10-SUBMISSION-NOTES.md` | docs/11 disclaimer + deliverable URL | 04:20Z |
| cursor | — **CLAIM RELEASED 03:58Z** (C1–C5 done). Artifacts: `audit/findings/CURSOR-*.md`, `verify/**`, `docs/10-SUBMISSION-NOTES.md` | C1–C5 | done |
| cowork | `docs/**`, `audit/**`, `CLAUDE.md`, `AGENTS.md`, `.cursor/**`, `.gitignore` | audit + context | 01:52Z |
| cowork | `data/transactions.json` — **CLAIM RELEASED 02:45Z**, one-off write for F-012 | T6 | done |

**Unclaimed and safe for next agent:** `verify/**` (cursor-owned artifacts, free to run), `docs/10-SUBMISSION-NOTES.md`, `ARCHITECTURE.md`, `NOTES.md`, `reports/`.
**Do not touch:** `app/page.tsx` (no UI score), `docs/reference/**` (read-only reference build).

## Open blockers

**None.** The F-014 gate passed: `./verify/smoke-test.sh
https://yuno-tax.vercel.app` -> **8 passed, 0 failed**, check 3 included.

One caveat worth knowing before a demo: check 3 can 404 on a cold instance
(measured 3/5 immediately after a deploy, 5/5 once warm) because `/tmp` is
per-instance. Seeded transaction reads and all reporting are unaffected. If you
are demoing live, hit the URL once to warm it first, or read a seeded id such as
`txn_br_0001`.

### Cleared 2026-08-03T04:25Z by `claude-code`

- ~~`npm run db:seed` must be run on the Mac~~ — run: **57 fixtures calculated,
  0 errors**. Compliance reports populated for all five countries.
- ~~Catalogue WRONG: F-022/023/024/025~~ — all four remediated; see
  `audit/log/0013-claude-code-catalogue-accuracy.md`.
- ~~F-009: `git rm --cached data/yuno-tax.db`~~ — executed with this commit.
- **New and already closed: F-026.** The build-time seed was writing the audit
  trail into the Vercel build container's `/tmp` and discarding it. Had this
  shipped, smoke check 3 would have 404'd in production.

## Decisions made (both closed 02:15Z)

- **F-009 RESOLVED — untrack `data/yuno-tax.db`.** Inspection proved it stale:
  12 rules across MX/US/CO versus 29 across BR/CO/AR/CL/PE in
  `data/tax-rules.json`. Run `git rm --cached data/yuno-tax.db`.
- **F-010 RESOLVED — deploy to Vercel and submit both links.** Deliverable URL
  = Vercel app, GitHub Repository URL = repo (verified public). This opens
  **F-014**, below: the deployed instance must actually persist audit records.

## Observed in-flight work (not a claim, just what is on disk at 01:59Z)

`claude-code` has created `lib/money.ts`, `lib/rules-repo.ts`,
`scripts/schema.sql` and modified `lib/{types,db,rules,calculator}.ts` and
`data/tax-rules.json`. That is T1/T2/T4 territory, consistent with its claim.
Not yet present: `lib/audit.ts`, `app/api/audit/**` (T3, F-002), the POST
handler on `app/api/tax/rules/route.ts` (T5, F-005), `scripts/demo.ts` (T7).

## Recent log entries

- `0007-cowork-t13-revised-icms-iss.md` — F-022, T13 superseded by T13-R
- `0006-cowork-fixtures-replaced.md` — F-012 resolved, reseed pending
- `0005-cowork-prd-fix-tasks.md` — T11–T16 written and assigned
- `0004-cowork-prd-delta-audit.md` — 7 findings F-015…F-021 from the PRD
- `0003-cowork-seed-db-and-vercel-decisions.md` — F-009/F-010 closed, F-014 opened
- `0002-cowork-submission-audit.md` — 4 new findings, gitignore trap fixed
- `0001-cowork-gap-analysis.md` — 7 findings against the rubric
