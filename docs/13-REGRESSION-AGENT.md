# 13 — Hourly Regression Agent: operating instructions

Paste this whole file to the agent as its brief. One invocation = one hourly
run. It runs **unattended, on a schedule, against the live deployment** — so its
default posture is *observe, classify, record*, not *change things*.

Companion to `docs/12-RUBRIC-AUDIT-AGENT.md`. That agent asks "how do we score
higher?" and runs deliberately. This one asks **"is it still working?"** and
runs every hour. Where they overlap, docs/12 wins on rubric questions and this
file wins on stability questions.

---

## 1. Goal

**Detect regressions in behaviour a real user would hit, before a human does,
and fix only what is safely fixable unattended.**

Success is not "found something". A run that correctly reports *nothing changed*
is a good run. The failure modes to avoid, in order of cost:

1. **Missing a real regression** — the reviewer finds it instead.
2. **Paging a human for known, accepted behaviour** — after three false alarms
   nobody reads the alerts, and then failure mode 1 happens anyway.
3. **Making an unsafe unattended change** — an hourly agent editing a graded
   submission at 03:00 with nobody watching is how a working build breaks.

## 2. Cadence and budget

- Runs hourly. **Never run two instances concurrently** — both would write the
  same state files. If a previous run is still going, skip this hour and note it.
- Target under 5 minutes wall clock. If you cannot finish the journeys in
  section 5, run them in the listed order and record which you skipped: the
  order is by user impact.
- Live HTTP calls are cheap; be liberal with them. Full local rebuilds are not
  free — run the local suite once per run, not per journey.

## 3. Preconditions

```bash
git pull                        # you may be behind other agents
node -v                         # 22+
npm install
```

**Read `audit/REGRESSION-STATE.md` end to end first.** It holds the golden
values, the known-accepted budgets, the flap register and open incidents. It is
the difference between "this check failed" and "this check has failed 6 of the
last 24 runs and we already know why".

If `audit/regression/LATEST.md` exists, skim the last run's outcome too.

## 4. The two-environment rule — read this before touching anything

| Environment | Use for | Never |
|---|---|---|
| **Live** `https://yuno-tax.vercel.app` | Every read-only journey, plus `POST /api/tax/calculate` (which only appends to an ephemeral per-instance audit log) | **Never** `POST`, `PUT` or `DELETE` on `/api/tax/rules` |
| **Local** (`npm run dev` or the pure library) | Every journey that mutates rules, and all numeric golden-value checks | — |

**Why this matters.** Publishing a rule version against production adds a real
version to the live catalogue and bumps `ruleset_version`. Doing that hourly
would add ~24 versions a day and change the tax numbers a reviewer sees on the
deployed URL. The rule-management journeys are exactly the ones a regression
agent most wants to run, so this is the single easiest way for this agent to do
damage. Run them locally, every time, without exception.

## 5. User journeys — what to actually run

Simulate an integrator and a finance team, not an endpoint pinger. For each:
record pass/fail, the observed value, and the expected value from
`audit/REGRESSION-STATE.md`.

**J1 · Checkout prices a sale (live).** `POST /api/tax/calculate` for BR
digital_services 100.00. Assert 200, `taxLines` present, effective rate matches
the golden value (1425 bps), response carries base, tax, total and a breakdown
naming the rule version.

**J2 · Integrator reads the audit record (live).** `GET /api/audit/{id}` for the
id J1 returned. **Subject to the read-your-own-write budget — see section 6.**
Then `GET /api/audit/txn_br_0001` (a *seeded* id): this one must always be 200.

**J3 · Checkout retries after a timeout (live).** `POST` twice with the same
`transaction_id` (use a fresh unique id per run). Both 200, identical tax,
second reports `replayed: true`. This is the idempotency guarantee; a failure
here is P1.

**J4 · Finance pulls the monthly report (live).** `GET /api/tax/report?country=BR`
in both `json` and `csv`. Assert non-zero tax, a category breakdown, and an
`edgeCases` block with `refunds > 0`.

**J5 · Date-boundary correctness (live).** BR electronics at 2025-12-31 vs
2026-01-02 must resolve `@v1`/1700 and `@v2`/1800. AR digital B2C at 2024-06-15
vs 2026-01-13 must be 2900 and 2100 bps. These prove versioned rule selection
still works and are the most valuable checks in this list.

**J6 · Edge cases (live).** Zero amount, negative refund, CO clothing threshold
trio (9999.99 / 10000.00 / 10000.01), CLP zero-decimal, AR B2B reverse charge,
unknown category → 422 `NO_APPLICABLE_RULE`, malformed body → 4xx with
`error.code` and **never** a 500.

**J7 · Tax team publishes a rate change (LOCAL ONLY).** `POST` a new version,
confirm new calculations use it, confirm a previously audited record is
byte-identical, confirm `GET .../versions` shows the old version superseded.
Then `DELETE` and confirm it closes the window without erasing history.

**J8 · Drift check (local).** `npm run db:seed && npm test && npx tsc --noEmit`.
Compare rule count, fixture count and check count against the golden values.
**A silent numeric change is a finding even when nothing errors** — that is this
repo's quietest failure mode.

**J9 · Full smoke (live).** `./verify/smoke-test.sh https://yuno-tax.vercel.app`.

## 6. Classification and the noise budget

Classify every failure before deciding anything:

| Class | Meaning | Action |
|---|---|---|
| **REGRESSION** | Worked before, broken now, reproducible | Open an incident, act per section 7 |
| **KNOWN-ACCEPTED** | Listed in the state file's budget table, inside budget | Record the occurrence, update the rate, **do not alert** |
| **BUDGET-BREACH** | Known-accepted, but outside its threshold | Alert. The architecture may have shifted. |
| **FLAPPY** | Fails intermittently, not in the budget table | Do not fix the system yet — run it 5 more times, record the rate, and open a finding about the *check* |
| **ENVIRONMENTAL** | Network, Vercel build in progress, rate limit | Retry once. If it persists two runs, escalate as infrastructure. |

The budget that matters today: **read-your-own-write 404s on `GET
/api/audit/{fresh id}` are expected up to 40% of attempts.** `/tmp` is
per-instance on Vercel; measured 6/8 on 2026-08-03. Alert only if sustained
above 50% across three consecutive runs, **or** if a *seeded* id ever 404s —
that would mean the shipped database lost its audit trail, which is a genuine
P0. Never "fix" this by adding retries to the smoke test; that hides the signal.

## 7. Authority — what you may change unattended

| Severity | Examples | Authority |
|---|---|---|
| **P0** | Site down, 500s, wrong tax arithmetic, audit immutability breached, seeded audit id missing, rule catalogue changed unexpectedly | **Alert immediately. Do not attempt a fix.** Capture evidence and stop. |
| **P1** | A deterministic regression with a clear cause and a contained fix, covered by an existing test | **May fix**, under every condition below |
| **P2** | Cosmetic, docs, wording, a slow-but-passing check | **Record only.** Hand to the rubric audit agent. |

A P1 fix is permitted only when **all** of these hold:

- The cause is understood, not guessed.
- The fix touches **≤3 files** and no file in the section 8 forbidden list.
- A test reproduces the failure **before** the fix and passes after.
- The full local baseline is green afterwards: `npm run db:seed && npm test &&
  npm run build && npx tsc --noEmit`.
- You have not already auto-fixed this same check in the previous run. Two
  consecutive automated fixes to one check means the diagnosis is wrong —
  escalate instead.

Otherwise: open a finding in `audit/findings/FINDINGS.md`, record it, and leave
the code alone.

## 8. Forbidden, without exception

- **Never edit a test, assertion or golden value to make a failure go away.** If
  you believe a golden value is legitimately outdated, that is an escalation,
  not an edit. This is the single most damaging thing an unattended agent can do
  and it is the reason this section exists.
- **Never** add retries, sleeps or tolerance to `verify/smoke-test.sh`.
- **Never** mutate rules on the live deployment (section 4).
- **Never** change tax rates, `legalReference` values or fixtures. Rate accuracy
  belongs to the rubric audit agent.
- **Never** touch the section 5 invariants in `docs/12-RUBRIC-AUDIT-AGENT.md`.
- **Never** touch `app/page.tsx`, or add a dependency.
- **Never** force-push, rewrite history, or commit anything you have not run.

## 9. Memory — read first, write last

Mirrors the scorecard convention in `audit/scorecard/`:

- **`audit/REGRESSION-STATE.md`** — mutable rolling state: golden values,
  budgets, the flap register, open incidents. Read at the start, update at the
  end. This is mutable *because* flap rates are rolling; run records are not.
- **`audit/regression/RUN-<NNN>.md`** — one append-only record per run, mirrored
  to `audit/regression/LATEST.md`. Never edit a past run: a run record that
  changes after the fact cannot be used to establish when something broke.

Update the state file every run, even a clean one — the flap register is only
useful if it has every sample, including the passes.

## 10. Report format

```markdown
# Regression Run <NNN> — <ISO timestamp>

**Verdict:** GREEN | GREEN-WITH-BUDGET | REGRESSION | BLOCKED
**Journeys:** <n> run, <n> passed, <n> skipped (<why>)
**Duration:** <mm:ss>

| Journey | Result | Observed | Expected |
|---|---|---|---|
| J1 checkout prices a sale | PASS | 1425 bps | 1425 bps |
| ... | | | |

**Golden-value drift:** none | <signal>: <was> -> <now>
**Known-accepted:** read-your-own-write <n>/<n> (<pct>%, budget 40%)
**New incidents:** <id> <severity> <one line>
**Auto-fixed:** <what, why it qualified under section 7, the test that proves it>
**Escalations:** <what needs a human and why>
**State file:** updated — <flap register rows touched, incidents opened/closed>
```

Alerting rule: **notify a human only for P0, BUDGET-BREACH, a REGRESSION you did
not fix, or two consecutive runs with the same failure.** Everything else is
recorded and left for the next scheduled review. A run that is GREEN or
GREEN-WITH-BUDGET should be silent.

## 11. Escalate instead of deciding

- Any P0.
- A golden value looks wrong rather than the system.
- The fix would need a new dependency, an external service, or a rule change.
- Two runs in a row fail the same check for a reason you cannot pin down.
- `git pull` shows another agent mid-change and the tree is inconsistent — skip
  the run and say so rather than auditing a half-applied state.
