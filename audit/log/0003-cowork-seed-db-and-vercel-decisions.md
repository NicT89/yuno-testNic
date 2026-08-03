# 0003 — cowork — Stale seed DB confirmed; Vercel and packaging decisions closed

**When:** 2026-08-03T02:15Z
**Agent:** cowork
**Task:** T9 / T10 prep
**Findings touched:** F-009 (RESOLVED), F-010 (RESOLVED), F-014 (opened)
**Files changed:** `audit/findings/FINDINGS.md`, `audit/ACTIVE.md`, `docs/02-BUILD-PLAN.md`, `docs/06-SUBMISSION.md`

## What changed
Opened `data/yuno-tax.db` directly and confirmed it is stale: 12 rules across
MX/US/CO and 13 transactions, against 29 rules across BR/CO/AR/CL/PE now in
`data/tax-rules.json`. F-009 closed in favour of untracking the file.

Nic supplied the submission form: Deliverable URL plus an optional GitHub
Repository URL, both required to be public. Verified `NicT89/yuno-testNic` is
public. F-010 closed in favour of deploying to Vercel and filling both fields.

That decision opened F-014: the deployed instance must persist audit records or
Requirement 2 (20 pts) visibly fails on the URL the reviewer opens first.
Fix specified in the registry, added to the build plan as T10.

## Verified how
```
node -e "...sqlite_master + COUNT(*) + DISTINCT country..."
  tax_rules: 12 rows, countries CO/MX/US
  transactions: 13 rows
node -e "require('./data/tax-rules.json')"
  29 entries, countries BR,CO,AR,CL,PE, first key BR:*:ICMS with rateBps 1700
```
Repo visibility checked by fetching the GitHub page: public, not a 404.

## For the next agent
`data/tax-rules.json` is already correct and matches
`docs/reference/src/seed/rules.ts`. Do not re-port it. What is missing is
`data/transactions.json` (still 13 rows at 3.6KB; the brief wants 50+ with edge
cases and timestamp variety, F-012) and the audit-table seeding described in
F-014, which T10 needs and which also fixes reporting on a cold Vercel instance.

Do not add `readOnly: true` back to `lib/db.ts`. See F-014 for the `/tmp`
pattern and the exact README wording for the trade-off.
