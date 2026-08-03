# 0001 — cowork — Rubric gap analysis of the existing Next.js build

**When:** 2026-08-03T01:53Z
**Agent:** cowork
**Task:** pre-build audit
**Findings touched:** F-001 … F-007 (opened)
**Files changed:** `docs/00-CONTEXT.md`, `docs/01-GAP-ANALYSIS.md`, `docs/02-BUILD-PLAN.md`, `docs/03-SCHEMA.sql`, `docs/04-TAX-RULES.md`, `docs/05-REVIEW-CHECKLIST.md`, `docs/reference/**`, `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/tax-engine.mdc`

## What changed
Read `lib/`, `app/api/`, `scripts/` and `data/` against the 100-point rubric and
opened seven findings. Three are blockers worth ~65 points combined: wrong
countries (F-001), no persisted audit trail (F-002), and a single time axis on
rules (F-003). Wrote the context pack in `docs/` and dropped a complete tested
reference implementation into `docs/reference/` (Express + SQLite, 19 passing
tests, 29 rule versions, 56 fixture transactions) for the build agents to port
from.

## Verified how
`git check-ignore`, direct reads of `lib/types.ts`, `lib/db.ts`,
`scripts/seed-db.ts`, `NOTES.md`. The reference build was run end to end in a
sandbox: `npm test` (19/19 pass) and `npm run demo`, whose verbatim output is
committed at `docs/reference/DEMO_OUTPUT.md`.

## For the next agent
`lib/` vs `app/` separation, integer minor units for amounts, JSON-seeded
fixtures, and the Vercel/SQLite trade-off paragraph in `NOTES.md` are all good.
Do not rewrite them. The reference build is Express and this repo is Next.js
App Router; port the ideas, not the transport layer. File-by-file mapping is in
`docs/02-BUILD-PLAN.md`.
