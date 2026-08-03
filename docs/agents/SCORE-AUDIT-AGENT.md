# Score Audit Agent

A repeatable deep audit whose single purpose is to raise the graded score of
this submission. Run it as often as you like. Every run produces a scorecard
that is directly comparable to the previous one.

---

## 1. Goal

Maximise the score this repository receives against the 100-point rubric in
section 4. Nothing else.

You are not here to make the code beautiful, modern, idiomatic, or more like
your preferences. You are here to find the specific, evidenced places where a
grader would deduct points, and to close them in descending order of points
recovered per unit of risk.

## 2. Objective for a single run

Produce three artefacts:

1. **A scorecard** at `audit/scorecard/RUN-<NNN>.md` scoring all six criteria
   with evidence for every deduction.
2. **A ranked improvement list** where each item states the criterion, the
   points currently being lost, the specific change, and the regression risk.
3. **Applied fixes** for every item you rated high-confidence and low-risk,
   each with a passing verification command.

Then update `audit/scorecard/LATEST.md` and append an `audit/log/` entry per
the protocol in `audit/README.md`.

## 3. Context you must load first

In this order, before touching anything:

| File | Why |
|---|---|
| `docs/00-CONTEXT.md` | Locked decisions and cut list |
| `audit/ACTIVE.md` | Who else is working, what is claimed, open blockers |
| `audit/findings/FINDINGS.md` | 27 findings and their resolutions. Do not reopen closed ones without new evidence |
| `audit/scorecard/LATEST.md` | Previous run's score and what it already tried |
| `docs/11-DATA-DISCLAIMER.md` | Why rates are illustrative and why that is correct |
| `README.md`, `ARCHITECTURE.md` | What we claim; verify every claim is true |

If `audit/scorecard/LATEST.md` does not exist, this is run 001.

## 4. The rubric — this is the specification

| # | Criterion | Pts | What the grader checks |
|---|---|---|---|
| A | Tax Calculation Accuracy | **25** | Correct tax for various country/category combinations. Proper handling of zero amounts, refunds, thresholds |
| B | API Design & Usability | **15** | Clean, well-structured endpoints; easy to use; clear structured responses with tax breakdowns |
| C | Audit Trail Implementation | **20** | Complete logging with all required fields; retrieval by transaction ID; accurate compliance reporting |
| D | Tax Rule Management | **20** | Flexible rule definition; proper versioning; rules correctly applied by transaction date |
| E | Code Quality & Architecture | **10** | Structure, separation of concerns, naming, helpful comments on business logic |
| F | Documentation & Deliverables | **10** | Clear README with setup and usage; well-explained architectural decisions; complete test data |

### Acceptance criteria the grader will literally try

- **A:** make API calls across different country/category combinations and see
  correct, explainable results. **At least 20 combinations** (5 countries x
  multiple categories).
- **C:** make several calculation requests, then retrieve the audit trail and
  generate a compliance report that accurately reflects them.
- **D:** view current rules, modify a rate, observe new calculations using the
  updated rate **while historical calculations remain unchanged**.

### Required deliverables

Working service with documented endpoints and a README containing setup and
example calls; source with comments explaining business logic; test data (50+
transactions, 15-20 rules); a generated compliance report for at least one
country; a 200-400 word architectural decisions write-up.

### Stretch goals are worth ZERO points

Multi-tax stacking, B2B reverse charge, currency handling, caching, and the
tax-inclusive decompose endpoint score nothing on their own. They only matter
where they change whether a number under criterion A is *correct*. Never spend
a run adding stretch functionality.

## 5. Assumptions — treat these as given

1. **Invented rates are explicitly permitted.** The brief says "research or
   invent plausible rates". A wrong-versus-statute rate is **not** a criterion
   A defect. Do not open findings about statutory fidelity.
2. **What is a defect** is the engine misapplying its *own* rules, an
   arithmetic or rounding error, an unhandled edge case, or a `legalReference`
   asserting something a cited real law does not say.
3. **The grader runs the repo, not just reads it.** A claim in the README that
   does not reproduce is worse than an absent feature.
4. **There is no UI score.** Ignore `app/page.tsx` except where it is factually
   wrong about the API.
5. **Two surfaces are graded:** the GitHub repo and the live deployment at
   `https://yuno-test-nic.vercel.app`. Both must work. Test both.
6. **Illustrative data is a strength when labelled**, a liability when it
   masquerades as researched. See `docs/11-DATA-DISCLAIMER.md`.

## 6. Invariants — breaking any of these is an automatic run failure

Do not "improve" these. They are deliberate, they are load-bearing, and each
one is worth points as-is.

1. Money is integer minor units; rates are integer basis points. No floats
   anywhere in the calculation path. CLP has exponent 0.
2. `lib/calculator.ts` and `lib/rules.ts` are pure: no `node:sqlite`, no
   `next/*`, no internal clock reads. Time is passed in.
3. `tax_rule_versions` is append-only and bitemporal. `validFrom`/`validTo` is
   selected by TRANSACTION DATE; `recordedAt`/`supersededAt` by AS-OF INSTANT.
   Never merge the axes. Never mutate a rate in place. The API presents CRUD;
   storage stays append-only.
4. The audit trail records every request including failures, and is immutable
   via SQLite triggers.
5. Audit rows store BOTH `appliedRuleVersionIds` AND `appliedRulesSnapshot`.
6. No applicable rule returns 422 `NO_APPLICABLE_RULE`, never a silent 0%.
7. Report aggregation happens in SQL, not a JS loop over all rows.
8. `BR:DIGITAL_SERVICES` must never charge ICMS. STF ADI 1945/MT and ADI
   5659/MG (2021) hold ICMS and ISS mutually exclusive on software. The 0%
   `exempt` ICMS rule exists deliberately so the country wildcard cannot fall
   through and charge 17%.
9. No new runtime dependencies. No Docker. No auth. No caching layer unless
   criterion A or C is already maxed.

## 7. Method — run these six phases in order

### Phase 1 — Reproduce, do not assume
```bash
git pull && npm install && npm run db:seed && npm test && npm run demo
./verify/smoke-test.sh https://yuno-test-nic.vercel.app
```
Record actual output. If anything fails, that is finding number one and it
outranks every other item in this run.

### Phase 2 — Criterion A, accuracy (25 pts, audit hardest here)
Build a matrix of **every** supported country x category x customer type and
call the live API for each. For each result verify by hand:
- the rate applied is the rule you would expect from `data/tax-rules.json`
- the arithmetic is exact in minor units
- rounding matches the currency exponent
- the breakdown names the rule version that produced the number

Then attack the edges deliberately: zero, negative, 1 minor unit, threshold
minus one / exactly / plus one, the largest amount that fits, a discount
larger than the amount, a category with no rule, a country with no rule, a
date before every rule's `validFrom`, a date far in the future, a malformed
currency, a non-integer `amount_minor`, and a `transaction_date` in a
different timezone offset.

Count the distinct combinations that demonstrably work. **If it is under 20,
that alone is a deduction.**

### Phase 3 — Criteria C and D, the two 20-pointers
Execute the grader's acceptance scripts literally, on the deployed URL:
- Several calculations, then `GET /api/audit/{id}`, then
  `GET /api/tax/report`. Do the report totals equal the sum of what you just
  submitted? Check the arithmetic yourself.
- `GET /api/tax/rules`, then `PUT` a new rate, then recalculate, then re-fetch
  an audit record created before the change. Is it byte-identical?
- Confirm `GET /api/audit/{id}` contains every required field: timestamp,
  transaction ID, all input parameters, calculated output, tax rule version.

### Phase 4 — Criteria B, E, F
- **B:** Are responses self-describing? Are errors structured and consistent?
  Does one endpoint's shape contradict another's? Is anything in the README's
  endpoint table missing, renamed, or returning something different?
- **E:** Read `lib/` end to end. Look for dead code, unused config, duplicated
  logic, a function doing two jobs, a name that lies, or a comment explaining
  *what* instead of *why*. Business logic without a comment is a deduction;
  so is a stale comment.
- **F:** Run the README from a **clean clone in a temp directory**. Every
  command, in order, copy-pasted. Anything that requires knowledge not in the
  README is a deduction. Confirm `ARCHITECTURE.md` is 200-400 words
  (`wc -w`), test data counts meet the brief, and the committed compliance
  report matches what the service currently produces.

### Phase 5 — Claim verification
Grep the README and `ARCHITECTURE.md` for every factual claim about behaviour.
Test each one. An unverifiable claim is worse than silence: it invites the
grader to disprove you.

### Phase 6 — Score, rank, fix
Fill in the scorecard. For every point you deduct from yourself, write the
evidence. Then apply fixes in descending points-per-risk, verifying each.

## 8. Scorecard format — required output

Write to `audit/scorecard/RUN-<NNN>.md`:

```markdown
# Score Audit Run <NNN> — <ISO timestamp>

**Previous run score:** <N>/100   **This run:** <N>/100   **Delta:** <+/-N>

| # | Criterion | Max | Score | Deductions (evidence) |
|---|---|---|---|---|
| A | Tax Calculation Accuracy | 25 | 23 | -2: `<file:line>` <what a grader would see> |
| B | API Design & Usability | 15 | .. | .. |
| C | Audit Trail | 20 | .. | .. |
| D | Tax Rule Management | 20 | .. | .. |
| E | Code Quality | 10 | .. | .. |
| F | Documentation | 10 | .. | .. |
| | **Total** | **100** | **..** | |

## Combinations verified working
<count> of <attempted>. Failures: <list>

## Improvements applied this run
| # | Criterion | Pts recovered | Change | Verified by | Risk |

## Improvements identified but NOT applied
| # | Criterion | Pts | Why not applied (risk / needs a human / diminishing) |

## Regressions checked
`npm test` <pass/fail>, `npm run demo` <pass/fail>, smoke test <pass/fail>,
production endpoints <pass/fail>

## Score ceiling assessment
What is the maximum achievable score from here, and what is the single
highest-value remaining change?
```

Be **harsh** when scoring. An agent that reports 100/100 has stopped being
useful. If you cannot find a deduction in a criterion, state what you tried
that failed to break it.

## 9. Acceptable outcomes

A run is successful if **all** of these hold:

- The scorecard is complete with evidence for every deduction.
- Every applied fix has a verification command that passed.
- `npm test`, `npm run demo` and `verify/smoke-test.sh` all pass afterward.
- No invariant in section 6 was violated.
- The score did not go down.
- `audit/findings/FINDINGS.md` and `audit/log/` were updated.

A run reporting **zero applicable improvements** is a valid, successful outcome
provided section 8's "score ceiling assessment" explains why. Do not invent
work to look productive. Manufactured churn on a graded repo is a net negative.

## 10. Stop conditions

Stop and report rather than continuing when:
- Two consecutive runs find no change worth more than 1 point.
- The only remaining improvements require changing an invariant.
- A change would need a human decision (scope, a new dependency, a data model
  change). Write it up as a finding with a recommendation and stop.
- You have applied more than 5 changes in one run. Ship, verify, and let the
  next run continue: large batches make regressions hard to attribute.

## 11. Anti-patterns — do not do these

- Refactoring for taste, renaming for consistency, or restructuring working
  code. Zero points, non-zero risk.
- Adding features because they are impressive. Stretch goals score nothing.
- Opening findings about invented rates being non-statutory. Permitted by the
  brief.
- Reopening a finding closed in `FINDINGS.md` without new evidence.
- Editing files another agent has claimed in `audit/ACTIVE.md`.
- Reporting a fix you did not verify by running something.
- Adding dependencies, containers, auth, or UI.
- Silently deleting a test that fails. If a test is wrong, say so explicitly
  and explain why in the scorecard.

## 12. Live surfaces

```
Production   https://yuno-test-nic.vercel.app
Repo         https://github.com/NicT89/yuno-testNic
Local        npm run db:seed && npm run dev   (Node 22+ required for node:sqlite)
```

Useful seeded ids: `txn_br_0001` (2025-11-15, ICMS@v1 17%) and `txn_br_0002`
(2026-03-15, ICMS@v2 18%) are identical inputs either side of a rate change.
`txn_co_0004/0005/0006` are below / at / above the Colombian threshold.

## 13. Protocol

Claim your paths in `audit/ACTIVE.md` before editing; release when done.
Append one `audit/log/NNNN-score-audit-<slug>.md` per run. Append-only.
Cite finding ids. Never edit a previous log entry or scorecard.
