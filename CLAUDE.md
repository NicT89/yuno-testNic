# CLAUDE.md — TiendaMax Tax Compliance Engine

**Read `docs/00-CONTEXT.md` before doing anything.** It holds the scoring
rubric, the locked decisions, and the cut list. This file is the short version.

## Docs map

| File | What it is |
|---|---|
| `docs/00-CONTEXT.md` | Rubric, locked decisions, cut list. Start here. |
| `docs/01-GAP-ANALYSIS.md` | What this repo is missing, by points at risk |
| `docs/02-BUILD-PLAN.md` | Ordered tasks T1-T8 with exact file paths |
| `docs/03-SCHEMA.sql` | Bitemporal rule + audit schema, commented |
| `docs/04-TAX-RULES.md` | The 29-rule catalogue for BR/CO/AR/CL/PE |
| `docs/05-REVIEW-CHECKLIST.md` | What Cursor audits against |
| `docs/06-SUBMISSION.md` | **Deliverables checklist, gitignore trap, clean-clone test. Read before submitting.** |
| `docs/reference/` | Complete working reference build. Port, do not deploy. |
| `audit/` | **Shared work log across agents. Read `audit/ACTIVE.md` first.** |


## Multi-agent protocol — MANDATORY

Several agents work this repo concurrently: **claude-code** (build), **cursor**
(review and fixtures), **cowork** (planning and audit). None share memory.
`audit/` is the shared memory. Full rules: `audit/README.md`.

**Before you do anything:** read `audit/ACTIVE.md`. It holds the current phase,
the file-ownership table, open blockers, and decisions waiting on Nic. If a
path you need is claimed by another agent, do not edit it.

**Before you edit:** claim your paths in the `audit/ACTIVE.md` ownership table.
Release the claim when you finish.

**After any meaningful action:** append a new file to `audit/log/` using the
template in `audit/README.md`. Never edit an existing entry; the trail is
append-only, exactly like the tax audit table this product implements. Name it
`NNNN-<agent>-<slug>.md` with the next unused sequence number.

**When you fix a finding:** update its Status row in
`audit/findings/FINDINGS.md` and reference the finding id in your log entry.
Never delete a finding; mark it RESOLVED or WONTFIX with a reason.

Write a log entry when you finish a task, change a shared contract (schema,
types, API shape), find or fix a finding, hit a blocker, or make a decision
another agent could reverse by accident. Skip it for routine edits inside a
task you already claimed.

## Audit map

| File | What it is |
|---|---|
| `audit/ACTIVE.md` | **Read first.** Phase, file ownership, blockers, pending decisions |
| `audit/findings/FINDINGS.md` | Numbered findings F-001+, with points at risk and status |
| `audit/log/` | Append-only work log, one file per action |
| `audit/README.md` | The protocol in full |

## Ownership

Claude Code owns tasks **T1-T5** and **T9** in `docs/02-BUILD-PLAN.md` and the git
history. Cursor owns T6-T8 and the review checklist. Do not edit
`app/page.tsx`: there is no UI score.

## Repo layout

```
app/api/**/route.ts   HTTP handlers, thin
lib/                  business logic
  calculator.ts         PURE tax math, no IO
  rules.ts              PURE rule resolution, no IO
  money.ts              minor units, basis points, rounding
  db.ts                 SQLite connection
  audit.ts              audit trail persistence
  compliance.ts         report aggregation, in SQL
  types.ts  http.ts
scripts/              seed-db.ts, demo.ts, test-tax.ts, schema.sql
data/                 tax-rules.json, transactions.json, yuno-tax.db
```

Dependency arrow points inward only: `app -> lib/{db,audit,compliance} ->
lib/{calculator,rules,money}`. The inner three import nothing from the outer.

## Non-negotiable invariants

1. Money is integer minor units, rates are integer basis points. No floats.
   CLP has exponent 0.
2. `lib/calculator.ts` and `lib/rules.ts` are pure: no `node:sqlite`, no
   `next/*`, no clock. Pass time in as an argument.
3. Rules are append-only. Changing a rate INSERTs a new version and stamps
   `supersededAt` on the old one. The only permitted UPDATE is `supersededAt`.
4. Two independent time axes. `effectiveFrom`/`effectiveTo` is selected by the
   TRANSACTION DATE. `recordedAt`/`supersededAt` is selected by an AS-OF
   instant. Never merge them.
5. The audit trail records every request, including failures, and is immutable
   (enforced by SQLite triggers).
6. Audit rows store BOTH `appliedRuleVersionIds` AND a full
   `appliedRulesSnapshot`. The duplication is deliberate.
7. No applicable rule returns 422 `NO_APPLICABLE_RULE`, never a silent 0%.
8. Report aggregation happens in SQL, not in a JS loop over all rows.

## Style

TypeScript, ESM, strict. snake_case at the HTTP boundary, camelCase inside.
Comments explain business logic and *why*, not what the line does. Every tax
rule carries a `legalReference`.

## Do not

Add Docker, auth, a caching layer, or UI work. Add dependencies. Reformat
working code for taste. Time is the binding constraint.
