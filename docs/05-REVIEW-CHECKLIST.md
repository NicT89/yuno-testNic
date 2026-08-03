# 05 — Review checklist (Cursor runs this)

Audit whatever lands against this list. Report findings as
`[file:line] — finding — rubric criterion at risk`. Do not fix silently.

## Correctness blockers

- [ ] Any floating-point arithmetic on money or rates. Search for `* 0.`,
      `rate *`, `parseFloat`, `toFixed` outside display formatting.
- [ ] `CLP` treated as a 2-decimal currency anywhere. It is 0.
- [ ] A rule `UPDATE` that mutates a rate in place instead of inserting a new
      version.
- [ ] `effectiveFrom`/`effectiveTo` used to answer "what did we believe at the
      time". That is the wrong axis; it must be `recordedAt`/`supersededAt`.
- [ ] A calculation path that returns 0% because no rule matched, instead of 422.
- [ ] An audit write that is skipped on the error path.
- [ ] Report aggregation done by loading all rows into JS instead of SQL.

## Architecture

- [ ] Anything in `lib/calculator.ts` or `lib/rules.ts` importing `node:sqlite`,
      `next/*`, or reading `Date.now()` internally. The core must be pure and
      take time as an argument.
- [ ] Route handlers containing business logic instead of delegating.
- [ ] `any` outside the JSON-parse boundary in the repo layer.

## Rubric coverage spot-check

- [ ] At least 20 country x category combinations return correct, explainable
      results (25 pts).
- [ ] Response includes base, rate, tax, total, and a breakdown naming the rule
      version used (15 pts).
- [ ] `GET /api/audit/{id}` returns every required field: timestamp,
      transaction id, all inputs, output, rule version identifier (20 pts).
- [ ] Compliance report shows total transactions, total tax, category
      breakdown, and edge cases encountered (20 pts).
- [ ] Changing a rate leaves historical calculations byte-identical (20 pts).
- [ ] README runs from a clean clone in two commands (10 pts).

## Deliverables present

- [ ] `README.md` with setup and example API calls
- [ ] `ARCHITECTURE.md`, 200-400 words
- [ ] `data/tax-rules.json` with 15+ distinct rules
- [ ] `data/transactions.json` with 50+ transactions including edge cases
- [ ] A generated compliance report committed at `out/compliance-report-BR.json`
