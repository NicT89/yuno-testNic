# 0002 — cowork — Submission audit; deliverables and packaging

**When:** 2026-08-03T01:57Z
**Agent:** cowork
**Task:** T9 prep
**Findings touched:** F-008 (opened + resolved), F-009, F-010, F-011, F-012, F-013 (opened)
**Files changed:** `docs/06-SUBMISSION.md`, `docs/02-BUILD-PLAN.md` (T9 appended), `.gitignore`, `reports/.gitkeep`, `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/tax-engine.mdc`, `audit/**`

## What changed
Audited the plan against the brief's five literal deliverables rather than
against the three core requirements, which surfaced gaps the first pass missed.
Four are real: `/out/` was gitignored and would have silently dropped the
required generated compliance report (F-008, fixed); the committed `.db` can go
stale (F-009); Vercel cannot host the audit-trail write path (F-010); and
idempotency, fixture timestamp variety, amount bands and the report's
`edgeCases` block are explicit brief requirements that no task named (F-011 to
F-013). Also stood up this `audit/` folder and its protocol.

## Verified how
`git check-ignore -v out/compliance-report-BR.json` returned
`.gitignore:18:/out/`, proving the deliverable was excluded. `git log`,
`git remote -v`, `git status --short` for repo state. `wc -w` on the drafted
docs.

## For the next agent
`.gitignore` now also ignores `data/*.db`, on the assumption that
`predev`/`prebuild`/`pretest` reseed. That is a reversible call recorded as
F-009; if the reviewer should receive a prebuilt database, remove those lines
and say so in `README.md`.

Generated reports must be written to `reports/`, not `out/`. If `scripts/demo.ts`
still writes to `out/`, the required deliverable never reaches GitHub.

F-010 needs a human decision before submission. The recommendation in
`docs/06-SUBMISSION.md` Trap 3 is local-first with Vercel as a read-only bonus,
and a README paragraph naming the constraint and the Turso/Postgres migration
path. Shipping a deployment where `GET /api/audit/:id` returns nothing scores
worse than naming the trade-off.
