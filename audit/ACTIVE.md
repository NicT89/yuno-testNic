# ACTIVE — read this before you touch anything

**Last updated:** 2026-08-03T03:00Z by `cowork`
**Phase:** Build — executing `docs/02-BUILD-PLAN.md` T1–T5
**Repo:** `NicT89/yuno-testNic` · branch `main` · 2 commits, `docs/`, `audit/`, `.cursor/` untracked

## File ownership (claim before editing, release when done)

| Agent | Claimed paths | Task | Since |
|---|---|---|---|
| claude-code | `lib/**`, `app/api/**`, `scripts/**`, `data/*.json` | T1–T5 | 01:56Z |
| claude-code | `lib/**`, `app/api/**`, `scripts/**`, `data/tax-rules.json`, `README.md` | T11–T16 | 03:35Z |
| cursor | `audit/findings/CURSOR-*.md`, `audit/log/NNNN-cursor-*.md`, `audit/findings/FINDINGS.md` (append only), `docs/10-SUBMISSION-NOTES.md`, `verify/**`, `audit/ACTIVE.md` (ownership/blockers only) | C1–C5 review | 03:45Z |
| cowork | `docs/**`, `audit/**`, `CLAUDE.md`, `AGENTS.md`, `.cursor/**`, `.gitignore` | audit + context | 01:52Z |
| cowork | `data/transactions.json` — **CLAIM RELEASED 02:45Z**, one-off write for F-012 | T6 | done |

**Unclaimed and safe:** `ARCHITECTURE.md`, `NOTES.md`, `reports/` (README claimed by claude-code for T16).
**Do not touch:** `app/page.tsx` (no UI score), `docs/reference/**` (read-only reference build), `lib/**` `app/**` `scripts/**` `data/**` (claude-code mid-edit).

## Open blockers

- **`npm run db:seed` must be run on the Mac.** `cowork` replaced
  `data/transactions.json` with 56 working fixtures (F-012) but cannot execute
  the seed: `node_modules` is darwin-arm64 and the audit sandbox is linux-arm64.
  Until it runs, the audit trail holds 11 ad-hoc rows and the compliance report
  is effectively empty.

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
