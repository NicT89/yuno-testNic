# CLAUDE.md — TiendaMax Tax Compliance Engine

Instructions for Claude Code working in this repository.

## What this is

A backend tax calculation and compliance service for LATAM cross-border
commerce, built as a timed take-home. It is scored against a 100-point rubric.
Every change should be justified against that rubric, not against general
"best practice."

| Criterion | Points | Where it lives |
|---|---|---|
| Tax calculation accuracy + edge cases | 25 | `src/domain/calculator.ts`, `src/domain/money.ts`, `tests/` |
| API design & usability | 15 | `src/api/`, `README.md` |
| Audit trail + compliance reporting | 20 | `src/db/auditRepo.ts`, `src/api/routes/audit.ts`, `routes/reports.ts` |
| Tax rule management + versioning | 20 | `src/db/schema.sql`, `src/db/rulesRepo.ts`, `src/domain/ruleResolver.ts` |
| Code quality & architecture | 10 | layer separation, naming, comments |
| Documentation & deliverables | 10 | `README.md`, `ARCHITECTURE.md`, `src/seed/` |

## Commands

```bash
npm install
npm run seed     # reset + load 29 rule versions and 56 transactions
npm start        # API on :3000
npm run demo     # full walkthrough, writes out/compliance-report-*.json
npm test         # vitest, pure-core accuracy tests
```

## Non-negotiable invariants

Break any of these and the submission loses points. Do not "simplify" them.

1. **Money never touches a float.** Integer minor units everywhere, rates in
   basis points. Currency exponents live in `src/domain/money.ts`; CLP is 0.
2. **`src/domain/` stays pure.** No database, no HTTP, no `Date.now()`, no
   `process`. If you need the current time, pass it in as an argument.
3. **`tax_rule_versions` is append-only.** Changing a rate means inserting a new
   version and stamping `superseded_at` on the previous one. The only permitted
   `UPDATE` on that table is setting `superseded_at`.
4. **Two independent time axes.** `valid_from`/`valid_to` is selected by the
   TRANSACTION DATE. `recorded_at`/`superseded_at` is selected by an AS-OF
   instant. Never merge them into one column.
5. **The audit trail is immutable and complete.** Every calculation request
   writes exactly one row, including failures. Database triggers enforce
   no-update and no-delete. Do not add an update path.
6. **Audit rows are self-contained.** Keep storing both
   `applied_rule_version_ids` and the full `applied_rules_snapshot`. The
   duplication is deliberate.
7. **No matching rule is a 422 error, never a silent 0%.** Assuming zero is how
   merchants under-remit.
8. **Aggregation happens in SQL**, not in a JavaScript loop over all rows.

## Layering

```
api  ->  service  ->  db  ->  domain
```

Arrows point inward only. `domain/` imports nothing from the other layers.
If you find yourself importing `better-sqlite3` into `src/domain/`, stop: the
logic belongs in `src/service/` instead.

## Style

- TypeScript, ESM, `strict: true`. No `any` in new code except at JSON parse
  boundaries that are already isolated in the repo layer.
- Comments explain **business logic and why**, not what the line does. Every
  non-obvious tax rule gets a `legal_reference`.
- Naming mirrors the domain: `rateBps`, `thresholdMinor`, `taxableBase`,
  `ruleKey` vs `ruleVersionId`. Keep it.
- Snake_case at the HTTP boundary, camelCase inside. `src/api/validation.ts`
  is the translation layer.

## When adding a country or category

1. Add rules to `src/seed/rules.ts` with a `legalReference`.
2. Add fixture transactions to `src/seed/transactions.ts` with a `note`
   explaining what they exercise, including at least one edge case.
3. Add a row to the table-driven test in `tests/calculator.test.ts`.
4. Update the rules table in `README.md`.

## Do not

- Add Docker, auth, a caching layer, or a UI. All out of scope and unscored.
- Add dependencies. The current set (express, zod, better-sqlite3) is complete.
- Reformat or restructure working code for taste. Time is the binding constraint.
