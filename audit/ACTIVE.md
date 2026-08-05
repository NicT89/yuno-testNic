# ACTIVE — read this before you touch anything

**Last updated:** 2026-08-05T13:05Z by `cursor`
**Phase:** Submit-ready — final Cursor audit closed; F-001…F-027 RESOLVED
**Repo:** `NicT89/yuno-testNic` · branch `main` · Deliverable https://yuno-test-nic.vercel.app

## File ownership (claim before editing, release when done)

| Agent | Claimed paths | Task | Since |
|---|---|---|---|
| claude-code | — **CLAIM RELEASED 04:25Z** (T1–T5, T10–T16, F-023/024/025, F-026 all done). Paths were `lib/**`, `app/api/**`, `scripts/**`, `data/*.json`, `README.md` | T1–T16 | done |
| cursor | — **CLAIM RELEASED 05:15Z** (final audit + F-027). Artifacts: `audit/findings/CURSOR-FINAL-AUDIT.md`, log `0016`, reference banner, `_archive` removed | final audit + F-027 | done |
| cursor | — **CLAIM RELEASED 04:35Z** (docs/11 disclaimer + yuno-test-nic Next.js deploy). | disclaimer + deliverable | done |
| cursor | — **CLAIM RELEASED 03:58Z** (C1–C5 done). Artifacts: `audit/findings/CURSOR-*.md`, `verify/**`, `docs/10-SUBMISSION-NOTES.md` | C1–C5 | done |
| cursor | — **CLAIM RELEASED 10:08Z** (`audit/qa/**`, log `0020`) | QA probe run 002 | done |
| cursor | — **CLAIM RELEASED 09:20Z** (`audit/qa/**`, F-039–F-041, log `0019`) | QA probe run 001 | done |
| cursor | — **CLAIM RELEASED 12:05Z** (`audit/qa/**`, log `0021`) | QA probe run 003 | done |
| cursor | `audit/qa/**`, `audit/findings/FINDINGS.md`, `audit/log/0022-cursor-qa-run-004.md`, `audit/ACTIVE.md` | QA probe run 004 | 13:05Z |
| cowork | `docs/**`, `audit/**`, `CLAUDE.md`, `AGENTS.md`, `.cursor/**`, `.gitignore` | audit + context | 01:52Z |
| cowork | `data/transactions.json` — **CLAIM RELEASED 02:45Z**, one-off write for F-012 | T6 | done |

**Unclaimed and safe for next agent:** `verify/**`, `docs/10-SUBMISSION-NOTES.md`, `ARCHITECTURE.md`, `NOTES.md`, `reports/`.
**Do not touch:** `app/page.tsx` (no UI score). `docs/reference/**` is labelled process artifact — edit only for hygiene.

## Open blockers

**None.** Live smoke on the deliverable URL: `./verify/smoke-test.sh
https://yuno-test-nic.vercel.app` → **8 passed, 0 failed**, including F-014
audit GET.

One caveat worth knowing before a demo: check 3 can 404 on a cold instance
because `/tmp` is per-instance. Seeded transaction reads and all reporting are
unaffected. If you are demoing live, hit the URL once to warm it first, or
read a seeded id such as `txn_br_0001`.

### Cleared 2026-08-03T05:15Z by `cursor`

- ~~Missing formal final audit artifact~~ — `audit/findings/CURSOR-FINAL-AUDIT.md`
- ~~F-014 status still said “pending live smoke”~~ — status column RESOLVED
- ~~F-027 unlabelled reference + `_archive` junk~~ — banner + gitignore

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

## Recent log entries

- `0016-cursor-final-audit.md` — CURSOR-FINAL-AUDIT, F-014/F-027 closeout
- `0015-cowork-final-repo-audit.md` — opened F-027
- `0014-claude-code-ship-and-smoke.md` — ship + smoke
- `0014-cursor-data-disclaimer.md` — catalogue labelling
- `0013-claude-code-catalogue-accuracy.md` — F-022–025
