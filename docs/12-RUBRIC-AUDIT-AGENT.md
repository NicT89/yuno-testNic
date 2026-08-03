# 12 — Rubric Audit Agent: operating instructions

Paste this whole file to the agent as its brief. One invocation = one deep
audit pass. It is expected to run repeatedly; each run must leave the repo
better against the rubric than it found it, or explicitly report that it found
nothing worth changing.

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
`https://yuno-tax.vercel.app`

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
verify/smoke-test.sh  8-check live smoke test
```

## 3. Assumptions and preconditions

Before you audit anything, establish the baseline. If any of this fails, **fix
the baseline first and report it as your finding** — a broken baseline is the
highest-value thing you can find.

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

Assume:
- Money is integer minor units; rates are integer basis points. Never floats.
- The reviewer runs `npm run demo` and hits the live URL before reading source.
- Rates are a **documented illustrative working set**, not legal advice. Rules
  that are invented say so in their `notes`. This is acceptable under the brief.
  What is *not* acceptable is a rule citing a real law that says something else.
- Other agents may be editing concurrently. Check `audit/ACTIVE.md` before
  writing, and claim your paths.

## 4. The rubric — this is the actual spec

| Criterion | Pts | Owning files |
|---|---|---|
| Tax calculation accuracy + edge cases | **25** | `lib/calculator.ts`, `lib/rules.ts`, `lib/money.ts` |
| API design & usability | **15** | `app/api/**/route.ts`, `lib/http.ts`, `lib/validation.ts`, `README.md` |
| Audit trail + compliance reporting | **20** | `lib/audit.ts`, `lib/compliance.ts`, `app/api/audit/**`, `app/api/tax/report/route.ts` |
| Tax rule management + versioning | **20** | `lib/rules.ts`, `lib/rules-repo.ts`, `scripts/schema.sql`, `app/api/tax/rules/**` |
| Code quality & architecture | **10** | layer separation, naming, business-logic comments |
| Documentation & deliverables | **10** | `README.md`, `ARCHITECTURE.md`, `NOTES.md`, `data/*.json`, `reports/` |

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
9. No new dependencies. No Docker, no auth, no caching layer, no UI work.

## 6. Method — how to run one audit pass

Work in this order. Stop and report when you run out of findings that clear the
bar in section 7.

**Step 0 — Read `audit/AGENT-FEEDBACK.md` end to end. This is mandatory and it
is your first action.** It is the curated memory between passes: what is
settled, what is already verified clean, what leads are open, which techniques
have paid off, and where the last pass thought you should start. Skipping it
means you will re-litigate decisions that are already made and re-find defects
that are already fixed — which is the main way a repeating agent wastes a run.

While you are in there, **sample-verify it**: pick at least two entries from its
"Verified clean" table and re-run their commands. That file is itself a claim
store, and this repository has twice shipped claim stores that went stale and
became actively misleading (`NOTES.md`, `ARCHITECTURE.md`). If an entry no
longer holds, that is a regression, it is your top-priority finding, and you
must correct the entry in the same pass.

**Step 1 — Establish the baseline** (section 3). A red baseline outranks
everything else.

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

**Step 5 — Domain-accuracy sweep.** For each rule in `data/tax-rules.json`,
check that its `legalReference` supports its `rateBps`, `validFrom`/`validTo`
and `treatment`. A rule citing a real statute that says something different is a
25-point risk and the most likely thing a Yuno reviewer catches. The remedy is
almost always **keep the mechanism, fix the citation** — relabel it honestly as
illustrative rather than deleting a rule that a demo depends on. Before deleting
any rule, check what falls through to a wildcard in its absence.

**Step 6 — Apply, verify, record.** Make the change, re-run the full baseline,
then follow the audit protocol in `audit/README.md`: claim paths in
`audit/ACTIVE.md`, add a finding to `audit/findings/FINDINGS.md`, write
`audit/log/NNNN-<agent>-<slug>.md`, release the claim.

**Step 7 — Update `audit/AGENT-FEEDBACK.md`. This is mandatory and it is your
last action.** A pass that changes the repo but not the feedback file has
broken the loop, and the next agent starts blind. Specifically:

- Add a row to **Pass history**.
- Move anything you decided-and-closed into **Settled**, with the reason and the
  date. This is what stops the next pass re-raising it.
- Update **Verified clean** with what you checked, the command, and today's
  date — including the two entries you re-verified in step 0.
- Rewrite **Open leads** with anything you found but did not act on, ranked,
  with why. Be honest here; a silently dropped finding is worse than a recorded
  one.
- Add to **Techniques that paid off** / **Dead ends** if this pass taught you
  something a future agent would otherwise have to rediscover.
- Replace **Start here next** with a concrete instruction, not a platitude.
  "Re-read the CO rules against their citations" is useful; "keep improving
  accuracy" is not.

Obey that file's own maintenance rules: every entry carries a date and the
command that established it, and the file stays under ~200 lines. Detail belongs
in `audit/log/`; this file is the index a fresh agent can read in one go.

## 7. Prioritisation — what to work on

Rank every candidate finding by **points at risk ÷ effort**, and apply this bar:

| Tier | Act? |
|---|---|
| A defect that makes a scored acceptance signal fail | **Always.** Highest priority. |
| A doc/comment/data claim that is factually wrong | **Always.** Cheap, and wrong claims actively lose points. |
| A gap in a scored criterion with a bounded fix | **Yes**, if it can be verified in the same pass. |
| Refactor that moves no criterion | **No.** |
| New capability nobody scores | **No.** |
| Anything on the section 5 invariant list | **Report, do not change.** |

When two findings compete, prefer the one a reviewer hits earlier: demo output
and the live URL beat source-level polish.

## 8. Acceptable outcomes — definition of done for a pass

A pass is complete when **one** of these is true, and you say which:

1. **Changes shipped.** Baseline green before and after, every change traced to
   a criterion, findings registry and log updated, committed and pushed.
2. **Nothing found above the bar.** You ran the full method and everything
   clears. Say so explicitly and list what you checked, so the next pass starts
   somewhere new rather than repeating you.
3. **Blocked.** Something needs a human decision (see section 10). Report the
   options with a recommendation and stop.

A pass that reports "improved code quality" with no criterion named is a failed
pass. Never report a fix you have not executed and verified.

## 9. Current state — do not re-raise these

> **The living version of this list is `audit/AGENT-FEEDBACK.md`.** What follows
> is the seed as of 2026-08-03 and it will go stale; the feedback file is
> maintained every pass and wins on any disagreement. If you notice the two have
> diverged, trust the feedback file and fix this section.

As of 2026-08-03, verified working. If you find one broken, that is a real
regression and a top-priority finding.

- 30 rule versions across BR/CO/AR/CL/PE, all with a `legalReference` or an
  explicit illustrative note; 57 fixtures; 35 tests; p99 1.9ms over 1,000 calcs.
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

## 10. Escalate instead of deciding

Stop and ask a human when:

- A fix requires a new dependency or an external service (e.g. Turso/Postgres).
- Two documents disagree about intent and the choice changes reviewer-visible
  numbers.
- A domain-accuracy fix would change published rates or delete a rule that a
  demo depends on.
- You would need to change something on the section 5 invariant list.

## 11. Report format

End every pass with:

```
PASS SUMMARY
Outcome:        shipped | nothing-above-bar | blocked
Feedback read:  yes — <n> entries re-verified, <n> stale entries corrected
Baseline:       before <result> / after <result>
Findings:       F-NNN <one line> -> <criterion> (<pts>) -> <status>
Changed:        <files>
Verified by:    <exact commands and their output>
Points moved:   <criterion>: <what a reviewer can now do that they could not>
Left undone:    <what you found but did not act on, and why>
Next pass:      <where to start, so the next run does not repeat this one>
Feedback file:  updated — <what you added to Settled / Verified / Open leads>
```

Be honest in "Left undone". A pass that quietly drops a finding it could not fix
is worse than one that reports it.

**A pass that does not end with `audit/AGENT-FEEDBACK.md` updated is not
complete, regardless of what else it achieved.** The loop is the point: each run
should start better-informed than the last, and that only happens if every run
pays into the file it read from.
