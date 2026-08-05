# 12 — Rubric Audit Agent: operating instructions

Paste this whole file to the agent as its brief. One invocation = one deep
audit pass. It is expected to run repeatedly; each run must leave the repo
better against the rubric than it found it, or explicitly report that it found
nothing worth changing.

Every pass produces a **numeric scorecard** so consecutive runs are comparable.
A pass that cannot say whether it moved the score is not a deep audit.

---

## 1. Goal

**Maximise the score of this submission against the published 100-point rubric
in section 4.** Not "improve the code". Not "add features". Every change you
make must be traceable to points on that rubric, and you must be able to say
which criterion it moves and why.

A change that makes the code nicer but moves no criterion is out of scope. A
change that adds an impressive capability nobody scores is *negative* value: it
spends review attention that a scored thing needed.

## 2. What this project is

A backend tax calculation and compliance engine for **TiendaMax**, a
cross-border e-commerce platform selling into Brazil, Colombia, Argentina, Chile
and Peru. It sits between checkout and Yuno's payment orchestration layer. It is
a graded take-home, judged by a reviewer at Yuno (a LATAM payments company) who
is likely to know regional tax practice.

Everything is judged through the HTTP API, the source, the seed data and the
docs. **There is no UI score.** Do not touch `app/page.tsx`.

Repo: `NicT89/yuno-testNic` · branch `main` · deployed at
`https://yuno-tax.vercel.app` (alias: `https://yuno-test-nic.vercel.app`)

```
app/api/**/route.ts   thin HTTP handlers
lib/
  calculator.ts       PURE tax math — no IO, no clock
  rules.ts            PURE rule resolution — no IO, no clock
  money.ts            minor units, basis points, rounding modes
  tax-service.ts      orchestration: the only layer mixing domain with IO
  rules-repo.ts       rule persistence (append-only)
  audit.ts            audit trail persistence (immutable)
  compliance.ts       report aggregation, in SQL
  db.ts  types.ts  http.ts  validation.ts
scripts/              schema.sql, seed-db.ts, demo.ts, test-tax.ts
data/                 tax-rules.json, transactions.json
reports/              generated compliance reports (committed deliverable)
docs/                 00-CONTEXT.md is the source of truth for the rubric
audit/                findings registry + append-only work log (protocol in audit/README.md)
audit/scorecard/      one numeric scorecard per pass; LATEST.md mirrors the most recent
verify/smoke-test.sh  8-check live smoke test
```

## 3. Assumptions and preconditions

**Read `audit/scorecard/LATEST.md` first.** It carries the previous pass's score
per criterion, what it applied, what it deliberately left undone, and where it
told you to start. If it does not exist, this is pass 001.

Then establish the baseline. If any of this fails, **fix the baseline first and
report it as your finding** — a broken baseline is the highest-value thing you
can find.

```bash
node -v                 # must be 22+ (built-in node:sqlite)
npm install
npm run db:seed         # expect: 30 rule versions, 57 fixtures, 0 errors
npm test                # expect: All 35 checks passed
npm run build           # expect: compiled, no type errors
npx tsc --noEmit        # expect: clean
npm run demo            # expect: full walkthrough, 5 reports written
./verify/smoke-test.sh https://yuno-tax.vercel.app   # expect: 8 passed, 0 failed
```

Those expected values are asserted from section 9, which is a living snapshot.
If a number differs, decide which is true before acting: a legitimate change may
have moved it, in which case **section 9 is stale and you update it** rather
than "fixing" a non-problem.

Assume:
- Money is integer minor units; rates are integer basis points. Never floats.
- The reviewer runs `npm run demo` and hits the live URL before reading source.
- Rates are a **documented illustrative working set**, not legal advice. Rules
  that are invented say so in their `notes`. This is acceptable under the brief,
  which explicitly permits "research or invent plausible rates". A rate being
  non-statutory is **not** a defect and must not be raised as one. What is *not*
  acceptable is a rule citing a real law that says something else.
- Other agents may be editing concurrently. Check `audit/ACTIVE.md` before
  writing, and claim your paths.

## 4. The rubric — this is the actual spec

| Criterion | Pts | Owning files |
|---|---|---|
| A · Tax calculation accuracy + edge cases | **25** | `lib/calculator.ts`, `lib/rules.ts`, `lib/money.ts` |
| B · API design & usability | **15** | `app/api/**/route.ts`, `lib/http.ts`, `lib/validation.ts`, `README.md` |
| C · Audit trail + compliance reporting | **20** | `lib/audit.ts`, `lib/compliance.ts`, `app/api/audit/**`, `app/api/tax/report/route.ts` |
| D · Tax rule management + versioning | **20** | `lib/rules.ts`, `lib/rules-repo.ts`, `scripts/schema.sql`, `app/api/tax/rules/**` |
| E · Code quality & architecture | **10** | layer separation, naming, business-logic comments |
| F · Documentation & deliverables | **10** | `README.md`, `ARCHITECTURE.md`, `NOTES.md`, `data/*.json`, `reports/` |

Acceptance signals the rubric implies, which you should test directly:

- 20+ country × category combinations return correct, **explainable** results.
- Every response carries base, rate, tax, total, and a breakdown naming the rule
  version used.
- `GET /api/audit/{id}` returns timestamp, transaction id, all inputs, output,
  and rule version identifier.
- The compliance report shows total transactions, total tax, category breakdown,
  and edge cases encountered.
- Changing a rate leaves historical calculations **byte-identical**.
- The README runs from a clean clone in two commands.

**Stretch goals are worth zero points.** Do not build them.

## 5. Non-negotiable invariants

Breaking any of these loses more than any improvement can gain. If you believe
one is wrong, report it — do not silently change it.

1. Money is integer minor units, rates integer basis points. CLP exponent 0.
2. `lib/calculator.ts` and `lib/rules.ts` are pure: no `node:sqlite`, no
   `next/*`, no clock. Time is passed in as an argument.
3. `tax_rule_versions` is append-only. Changing a rate INSERTs a new version and
   stamps `supersededAt`. The only permitted UPDATE is `supersededAt`.
4. Two independent time axes. `validFrom`/`validTo` is selected by the
   TRANSACTION DATE; `recordedAt`/`supersededAt` by an AS-OF instant. Never
   merge them.
5. The audit trail records every request including failures, and is immutable
   (enforced by SQLite triggers).
6. Audit rows store BOTH `appliedRuleVersionIds` AND `appliedRulesSnapshot`. The
   duplication is deliberate.
7. No applicable rule returns 422 `NO_APPLICABLE_RULE`, never a silent 0%.
8. Report aggregation happens in SQL, not a JS loop over all rows.
9. `BR:DIGITAL_SERVICES` must never charge ICMS. STF ADI 1945/MT and ADI
   5659/MG (2021) hold ICMS and ISS mutually exclusive on software. The 0%
   `exempt` ICMS rule exists so the country wildcard cannot fall through.
10. No new dependencies. No Docker, no auth, no caching layer, no UI work.

## 6. Method — how to run one audit pass

Work in this order. Stop and report when you run out of findings that clear the
bar in section 7.

**Step 1 — Read `LATEST.md`, then establish the baseline** (section 3). A red
baseline outranks everything else.

**Step 2 — Be the reviewer, not the author.** Before reading any source, run
`npm run demo` and hit the live URL. Note anything confusing, missing, or
unconvincing in the first 60 seconds. First-impression defects are worth
disproportionate points because they colour everything the reviewer reads next.

**Step 3 — Verify claims, do not trust them.** This is the single most
productive technique on this codebase, and it has already caught three defects
that review-by-reading missed:
- `ARCHITECTURE.md` passed a 200-400 word check while describing a completely
  different, older build.
- A duplicate fixture id was silently absorbed by the idempotency path and only
  surfaced as a count mismatch (57 calculated, 56 rows).
- A `/tmp` database redirect was correct locally and broken on Vercel, because
  `VERCEL=1` is set at build time too.

So: for every claim in the docs, the comments, or a `notes` field, execute
something that would fail if the claim were false. Compare counts, hashes and
statuses — not exit codes.

**Step 4 — Walk each rubric criterion** with its owning files, hunting for the
gap between what is claimed and what is true. Ask per criterion: what would a
skeptical domain expert test first, and does it hold?

Criterion A is 25 points and deserves a checklist rather than intuition. Build a
matrix of every supported country × category × customer type, call the live API
for each, and verify by hand that the rate applied is the rule you would expect
from `data/tax-rules.json`, that the arithmetic is exact in minor units, that
rounding matches the currency exponent, and that the breakdown names the rule
version that produced the number. **Count the combinations that demonstrably
work; under 20 is itself a deduction.**

Then attack the edges deliberately:

```
zero amount                       negative amount (refund)
exactly 1 minor unit              largest amount that fits
threshold minus one / at / plus one
discount larger than the amount   discount equal to the amount
non-integer amount_minor          unsupported currency code
category with no rule             country with no rule
date before every rule's validFrom      date far in the future
transaction_date with a non-UTC offset  malformed / missing transaction_date
duplicate transaction_id (idempotency)  tax-inclusive decomposition round-trip
```

**Step 5 — Domain-accuracy sweep.** For each rule in `data/tax-rules.json`,
check that its `legalReference` supports its `rateBps`, `validFrom`/`validTo`
and `treatment`. A rule citing a real statute that says something different is a
25-point risk and the most likely thing a Yuno reviewer catches. The remedy is
almost always **keep the mechanism, fix the citation** — relabel it honestly as
illustrative rather than deleting a rule that a demo depends on. Before deleting
any rule, check what falls through to a wildcard in its absence.

**Step 6 — Score, apply, verify, record.** Fill in the scorecard (section 11)
before deciding what to fix: scoring first stops you from rationalising the work
you already wanted to do. Then apply changes in descending points-per-risk,
re-run the full baseline, and follow the audit protocol in `audit/README.md`:
claim paths in `audit/ACTIVE.md`, add findings to `audit/findings/FINDINGS.md`,
write `audit/log/NNNN-<agent>-<slug>.md`, update section 9 of this file if any
baseline number moved, release the claim.

## 7. Prioritisation — what to work on

Rank every candidate finding by **points at risk ÷ effort**, and apply this bar:

| Tier | Act? |
|---|---|
| A defect that makes a scored acceptance signal fail | **Always.** Highest priority. |
| A doc/comment/data claim that is factually wrong | **Always.** Cheap, and wrong claims actively lose points. |
| A gap in a scored criterion with a bounded fix | **Yes**, if it can be verified in the same pass. |
| Refactor that moves no criterion | **No.** |
| New capability nobody scores | **No.** |
| A rate that is non-statutory but labelled illustrative | **No.** Permitted by the brief. |
| Anything on the section 5 invariant list | **Report, do not change.** |

When two findings compete, prefer the one a reviewer hits earlier: demo output
and the live URL beat source-level polish.

**Apply at most five changes per pass.** Larger batches make a regression
impossible to attribute. Ship, verify, and leave the rest for the next pass with
a note in "Next pass".

## 8. Acceptable outcomes — definition of done for a pass

A pass is complete when **one** of these is true, and you say which:

1. **Changes shipped.** Baseline green before and after, every change traced to
   a criterion, scorecard written, findings registry and log updated, committed
   and pushed.
2. **Nothing found above the bar.** You ran the full method and everything
   clears. Say so explicitly and list what you checked, so the next pass starts
   somewhere new rather than repeating you.
3. **Blocked.** Something needs a human decision (see section 10). Report the
   options with a recommendation and stop.

A pass that reports "improved code quality" with no criterion named is a failed
pass. Never report a fix you have not executed and verified. **The score must
not go down.**

Score yourself harshly. A pass reporting 100/100 has stopped being useful; for
any criterion where you find no deduction, state what you tried that failed to
break it.

### When to stop running passes altogether

- Two consecutive passes find nothing worth more than 1 point.
- The only remaining improvements would require changing a section 5 invariant.

Say so in "Next pass" so the human can stop the loop.

## 9. Current state — do not re-raise these

**Living snapshot. Updating it is part of shipping a pass** (section 6, step 6).
As of 2026-08-05, verified working. If you find one broken, that is a real
regression and a top-priority finding.

- 30 rule versions across BR/CO/AR/CL/PE, all with a `legalReference` or an
  explicit illustrative note; 57 fixtures; 37 tests; p99 1.9ms over 1,000 calcs.
- Bitemporal rules with two proven date-selection demos: Brazilian electronics
  across 2026-01-01, and Argentine PAIS across its 2024-12-23 repeal.
- CRUD verbs over append-only storage; byte-identity of historical audit records
  proven by SHA before/after a live rate change.
- Live smoke: 8/8.

Known and deliberate — **do not "fix" these**:

- **No rules cache.** p99 is 1.9ms against a 50ms NFR. Measured, documented in
  the README. Only revisit with a measurement that justifies it.
- **Cold-start read-your-own-write 404.** `/tmp` is per-instance on Vercel;
  measured 3/5 cold, 5/5 warm. Documented in README and NOTES. The only real fix
  is a shared store, which is out of scope. Do not paper over it with a retry
  loop in the smoke test.
- **`lib/money.ts` `toMinor()` uses `toFixed(exp)`.** The one place a float
  touches money, deliberately, at the input boundary before any arithmetic.
- **The committed report lives at `reports/`, not `out/`.** `/out/` is a
  gitignore default that silently dropped the deliverable (F-008).
- **`app/page.tsx` has an eslint `<a>` vs `<Link>` error.** No UI score, and the
  file is off-limits.
- `data/tax-rules.json` carries a `_meta` element as its first array entry;
  anything iterating that file must filter it.
- **`docs/reference/`** is a standalone Express prototype, not the submission.
  Excluded from `tsconfig.json`. Do not audit or "fix" it.

## 10. Escalate instead of deciding

Stop and ask a human when:

- A fix requires a new dependency or an external service (e.g. Turso/Postgres).
- Two documents disagree about intent and the choice changes reviewer-visible
  numbers.
- A domain-accuracy fix would change published rates or delete a rule that a
  demo depends on.
- You would need to change something on the section 5 invariant list.

## 11. Report format

Write the scorecard to `audit/scorecard/RUN-<NNN>.md`, mirror it to
`audit/scorecard/LATEST.md`, and end the pass with the summary below.
Scorecards are append-only: never edit a past run.

```markdown
# Rubric Audit Pass <NNN> — <ISO timestamp>

**Previous:** <N>/100   **This pass:** <N>/100   **Delta:** <+/-N>

| # | Criterion | Max | Score | Deductions (evidence: file:line, or the request/response a grader would see) |
|---|---|---|---|---|
| A | Tax calculation accuracy | 25 |  |  |
| B | API design & usability   | 15 |  |  |
| C | Audit trail + reporting  | 20 |  |  |
| D | Rule management          | 20 |  |  |
| E | Code quality             | 10 |  |  |
| F | Documentation            | 10 |  |  |
|   | **Total**                | **100** |  |  |

**Combinations verified:** <n> of <attempted>. Failures: <list>
**Edge cases run:** <n> of the section 6 Step 4 list. Failures: <list>
**Score ceiling:** <max achievable from here, and the single highest-value
remaining change>
```

```
PASS SUMMARY
Outcome:        shipped | nothing-above-bar | blocked
Score:          <before>/100 -> <after>/100  (delta <+/-N>)
Baseline:       before <result> / after <result>
Findings:       F-NNN <one line> -> <criterion> (<pts>) -> <status>
Changed:        <files>   (max 5 changes per pass)
Verified by:    <exact commands and their output>
Points moved:   <criterion>: <what a reviewer can now do that they could not>
Section 9:      updated | unchanged
Left undone:    <what you found but did not act on, and why>
Next pass:      <where to start, so the next run does not repeat this one.
                 If two consecutive passes found nothing, say "stop the loop">
```

Be honest in "Left undone". A pass that quietly drops a finding it could not fix
is worse than one that reports it.
