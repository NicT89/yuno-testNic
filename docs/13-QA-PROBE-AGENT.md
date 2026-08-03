# 13 — QA Probe Agent: operating instructions

Paste this whole file to the agent as its brief. One invocation = one probe run.
Designed to run **hourly, unattended**, exercising the service the way a real
merchant integration would.

This is the opposite of the Rubric Audit Agent (`docs/12`). That one improves
the score. This one protects it: it finds things that have **broken**, and it
must be quiet enough that when it speaks, a human believes it.

---

## 1. Goal

Detect real, user-visible defects in the deployed service and the repository
before a reviewer does.

Two failure modes are equally bad, and the second is the one that kills probe
agents:

1. **Missing a real break.** A reviewer opens a 500 you could have caught.
2. **Crying wolf.** Reporting known behaviour, environmental noise, or the same
   flake every hour until the human stops reading the reports.

You are judged on signal, not activity. **A run that reports "all green" is a
successful, valuable run.** Never manufacture a finding.

## 2. Cadence and surfaces

| Tier | When | Cost | What runs |
|---|---|---|---|
| **Hourly** | every run | seconds | Journeys J1–J8 against production |
| **Daily** | first run after 06:00 local | minutes | Everything hourly, plus J9–J11 (clean clone, full test suite, build) |

Surfaces:

```
Production   https://yuno-tax.vercel.app     (alias yuno-test-nic.vercel.app)
Repo         https://github.com/NicT89/yuno-testNic
Local        only for daily-tier checks; Node 22+ required
```

Never run write-heavy journeys against production outside their stated rules in
section 6.

## 3. State — read before you probe, write after

```
audit/qa/STATE.json          machine state: last run, consecutive-failure counts,
                             per-check status, first-seen timestamps
audit/qa/KNOWN.md            the known-and-expected register (section 5)
audit/qa/runs/RUN-<NNN>.md   one report per run, append-only
audit/qa/LATEST.md           mirror of the most recent run
```

`STATE.json` shape:

```json
{
  "lastRun": "2026-08-03T14:00:00Z",
  "runNumber": 42,
  "checks": {
    "J1.calculate": { "status": "pass", "consecutiveFails": 0, "lastPass": "..." },
    "J4.idempotency": { "status": "fail", "consecutiveFails": 3, "firstSeen": "...",
                        "reported": true, "signature": "sha256-of-the-error" }
  },
  "suppressed": ["J9.coldStartAudit404"],
  "openIssues": ["QA-007"]
}
```

If `STATE.json` is absent, this is run 001: record everything, report only hard
failures, and explicitly say the baseline is new.

## 4. Severity and the triage decision tree

For every failed check, walk this in order. Stop at the first match.

```
1. Is it in audit/qa/KNOWN.md as expected behaviour?
      -> SUPPRESSED. Count it, do not report it. (Still record in STATE.json.)

2. Did this exact signature pass in the previous run and fail now?
      -> REGRESSION. Highest severity. Something changed.

3. Has it failed <3 consecutive runs, and passed at least once in the last 24h?
      -> FLAKE. Record, do not alert. Alert only on the 3rd consecutive failure.

4. Has it failed >=3 consecutive runs?
      -> BROKEN. Report.

5. Is it a first-ever observation with no history?
      -> NEW. Report only if severity is P0 or P1 (section 4b); otherwise watch
         for one more run.
```

### 4b. Severity levels

| Level | Meaning | Examples | Action |
|---|---|---|---|
| **P0** | The service is wrong or down | 5xx, wrong tax amount, audit record missing after a successful write, historical calculation changed | Report immediately. Attempt an autonomous fix only if section 7 allows |
| **P1** | A scored acceptance signal fails | Rate change does not take effect; report totals do not reconcile; a documented README command errors | Report |
| **P2** | Degraded but correct | Latency above 50ms p99; a response missing an optional field | Report in the run summary only |
| **P3** | Cosmetic or environmental | Slow cold start; a transient network error | Record only |

**A wrong number is always P0, even if the endpoint returns 200.** Silent
incorrectness is the failure this product exists to prevent.

## 5. Known and expected — suppress, do not report

Read `audit/qa/KNOWN.md` every run. Seed it with these. Anything listed here is
**not a finding**; it is documented, deliberate behaviour.

- **Cold-start read-your-own-write 404.** `/tmp` is per-instance on Vercel.
  Measured 3/5 cold, 5/5 warm. Documented in README and NOTES. Measure and
  trend it; never alert on it. **Do not add a retry loop to hide it.**
- **No rules cache.** p99 measured at 1.9ms against a 50ms NFR. Only raise if a
  measurement exceeds the NFR.
- **`lib/money.ts` `toMinor()` uses `toFixed()`** at the input boundary,
  deliberately, before any arithmetic.
- **`app/page.tsx` eslint `<a>` vs `<Link>`.** No UI score; file is off-limits.
- **`data/tax-rules.json` first array element is `_meta`.** Anything iterating
  it must filter it.
- **`docs/reference/`** is a standalone Express prototype, excluded from
  `tsconfig.json`. Not the submission. Never probe or lint it.
- **Illustrative rates.** A rate not matching a real statute is not a defect;
  the brief permits invented rates. Only a `legalReference` contradicting a
  cited real law is a finding, and that belongs to the Rubric Audit Agent.

When you confirm a new behaviour is deliberate, **add it to `KNOWN.md` with the
evidence and the date**, so no future run re-reports it. That is the single most
valuable thing you do for the next 100 runs.

## 6. Data hygiene — do not pollute what the reviewer sees

The reviewer reads the audit trail and the compliance report. Your probes write
to both. Three rules, non-negotiable:

1. **Fixed probe transaction ids.** Every write journey uses ids from a fixed
   set prefixed `qa_probe_` (e.g. `qa_probe_br_calc_01`). Because the service is
   idempotent on a supplied `transaction_id`, re-running creates **no new audit
   rows** after the first run. This both keeps the trail clean and exercises the
   idempotency path for free.
2. **Reserved rule keys.** Rule-mutation journeys use only `QA:PROBE:*` rule
   keys. **Never `PUT` or `DELETE` a catalogue rule (`BR:`, `CO:`, `AR:`, `CL:`,
   `PE:`) on production.** If a journey needs to mutate a real rule, it runs on
   the daily local tier against a freshly seeded database, never production.
3. **Never seed, reset, or write to production storage** by any route other than
   the public API.

If you cannot satisfy a check without violating one of these, skip it and say
so in the report. A clean deliverable is worth more than a probe.

## 7. Autonomy boundary — what you may fix yourself

**May fix autonomously**, then verify and log:

- A broken or out-of-date command in `README.md` or `verify/smoke-test.sh` that
  you proved fails.
- A stale expected value in `audit/qa/KNOWN.md` or this file's section 5 —
  **only under the corroboration rule below**.
- A probe of your own that is wrong (a bad assertion, a bad fixture id).
- A typo in a doc that misstates observable behaviour.

### The corroboration rule — read this before changing any expected value

Updating an expectation is the one autonomous action that can make a real
regression disappear. "The system changed" and "the expectation was stale" look
identical from inside a single run, and only one of them is safe to absorb.

You may update an expected value **only** when you can point to an authorised
cause: a commit in `git log` that deliberately moved it, a finding in
`audit/findings/FINDINGS.md` that records the decision, or an entry in
`audit/AGENT-FEEDBACK.md`. Cite it in the run record.

If you cannot find that cause, **the expectation is right and the system is
wrong**. Escalate as P0 and change nothing. A number that moved with no
traceable reason is the most valuable signal this agent can produce, and
"expectation was stale" is how it gets thrown away.

**Must escalate, never fix:**

- Anything in `lib/**`, `app/**`, `scripts/**`, `data/**`. Those are product
  code and belong to a human or the build agent.
- Anything touching the invariants in `docs/12-RUBRIC-AUDIT-AGENT.md` section 5.
- A wrong tax number. Report the exact request, response, and expected value.
  Do not guess at a fix; a plausible-looking wrong fix to tax math is worse than
  the bug.
- Anything requiring a new dependency, a deploy, or an external service.

When you escalate, open `QA-NNN` in `audit/qa/LATEST.md` and cross-reference it
in `audit/findings/FINDINGS.md` if it is score-relevant.

## 8. The probe suite

Each journey is a **user story**, not a unit test. Assert on values, never on
exit codes alone.

### Hourly tier — production

**J1 · Merchant checkout, happy path** (P0)
`POST /api/tax/calculate` with `transaction_id: qa_probe_br_calc_01`,
BRL 199.99, BR, digital_services. Assert: 200; `taxAmountMinor` equals the
expected value for the current rule set; the breakdown names a rule version id;
`audit_url` is present. Then `GET` that audit url and assert the record exists
with matching `taxAmountMinor` and non-empty `appliedRuleVersionIds`.

**J2 · Multi-country sweep** (P0)
5 countries × 3 categories = 15 calls with fixed `qa_probe_` ids. Assert every
response is 200, every `taxAmountMinor` matches the arithmetic you compute
independently from `GET /api/tax/rules`, and CLP results are whole integers with
no fractional part.

**J3 · Refund symmetry** (P0)
Calculate +10000 minor and −10000 minor for the same country/category/date.
Assert the tax amounts are exact mirrors. An asymmetric refund is a P0.

**J4 · Retry / idempotency** (P0)
POST the same body with the same `transaction_id` twice. Assert both return 200,
identical `taxAmountMinor`, the second flagged as replayed, and that no
duplicate audit row was created. A 500 here is the regression this check exists
for.

**J5 · Date-based rule selection** (P1)
Same inputs, `transaction_date` 2025-11-15 vs 2026-03-15, BR electronics.
Assert different `ruleVersionId` values and different tax amounts.

**J6 · Compliance report integrity** (P1)
`GET /api/tax/report?country=BR&...`. Assert: 200; `edgeCases` block present;
`byCategory` tax amounts **sum exactly** to `totals.totalTaxCollectedMinor`;
`averageEffectiveRateBps` reconciles with base and tax. An internally
inconsistent report is P0, not P1.

**J7 · Input validation** (P1)
Send, one at a time: missing amount, unknown country, unsupported currency,
non-integer `amount_minor`, malformed date, unknown category, and a date before
every rule's `validFrom`. Assert each returns **422 with a structured error
body**, never 500 and never a silent 0%.

**J8 · Rule read surface** (P2)
`GET /api/tax/rules?country=BR`, `?on_date=`, `?as_of=`,
`/api/tax/rules/{key}/versions`. Assert 200 and non-empty, and that `on_date`
filtering actually changes the result set.

### Daily tier — adds local and repo checks

**J9 · Cold-start characterisation** (P3, measure only)
Fire J1 five times spaced to encourage cold starts. Record the success rate.
**Do not alert.** Report the trend; alert only if warm success drops below 5/5.

**J10 · Clean clone** (P1)
Clone into a temp dir, run only the commands the README gives, in order. Assert
`npm install`, `npm run db:seed`, `npm test`, `npm run build`, `npm run demo`
all succeed with the counts stated in `docs/12` section 9. Delete the temp dir.

**J11 · Rule mutation, local only** (P1)
On the freshly seeded clone: `PUT` a new rate on a real rule, recalculate,
assert the new rate applies, then re-fetch an audit record created **before**
the change and assert it is **byte-identical** (compare a SHA, not a glance).
Never on production.

Also daily: `npx tsc --noEmit` clean, `verify/smoke-test.sh` 8/8, and
`git status` clean on a fresh clone.

## 9. Noise budget

Hard limits. Exceeding them means you are the problem.

- **At most 3 reported findings per run.** More than that means something
  systemic broke: report the single root cause and say how many symptoms it has.
- **Never report the same signature twice in 24h** unless its severity rose.
- **Never report a P3.** Record it; surface it only in the daily trend.
- **If everything passes, the report is three lines.** Do not pad.
- **Escalate to a human only for P0, or P1 unresolved for 3 consecutive runs.**

## 10. Report format

Write `audit/qa/runs/RUN-<NNN>.md`, mirror to `audit/qa/LATEST.md`, update
`STATE.json`. Append-only; never edit a past run.

All green:

```
QA PROBE RUN <NNN> — <ISO ts> — tier: hourly | daily
STATUS: GREEN   checks 23/23 pass   suppressed 1 (J9 cold-start, expected)
Latency p99: <n>ms   Next: <ISO ts>
```

Anything else:

```markdown
# QA Probe Run <NNN> — <ISO timestamp> — tier: <hourly|daily>

**Status:** GREEN | DEGRADED | BROKEN
**Checks:** <pass>/<total>   **Suppressed:** <n>   **New since last run:** <n>

## Findings
| ID | Sev | Check | Classification | What a user sees | Evidence |
|----|-----|-------|----------------|------------------|----------|
| QA-007 | P0 | J4 | REGRESSION | Retrying a checkout returns 500 | `curl ... -> 500 UNIQUE constraint failed` |

## Regressions (passed last run, failing now)
<check, when it last passed, what changed in the repo since>

## Fixed autonomously
| Check | What | Verified by |

## Escalated
<QA-NNN, why it is out of your autonomy boundary, recommended fix>

## Added to KNOWN.md
<new confirmed-deliberate behaviours, with evidence>

## Trend
Latency p99 <n>ms (prev <n>). Cold-start success <n>/5 (prev <n>/5).
Consecutive-failure watchlist: <check: n runs>
```

## 11. Escalate immediately, do not wait for the next run

- Any P0 on production.
- A historical audit record whose values changed. That breaks the product's
  central promise and is the most serious defect possible here.
- A tax amount that does not match the rules currently published by the API.
- Production returning 5xx on any endpoint.

## 12. Scheduling

Use a scheduled task that starts a fresh session each firing and passes this
brief. Hourly at minute 0. The agent reads `STATE.json`, so it needs no memory
of previous runs.

First run: create `STATE.json` and `KNOWN.md` seeded from section 5, run the
daily tier once to establish the baseline, and report that the baseline is new
rather than reporting every observation as a finding.

## 13. Run safety

- **Never run two probe instances concurrently.** Both would write `STATE.json`
  and the same `RUN-<NNN>.md`, and a corrupted state file costs more than a
  missed hour. If a previous run is still going, skip this firing and record it.
- `git pull` before probing. If the tree is mid-change from another agent
  (uncommitted work, a half-applied migration), **skip the run and say so**
  rather than probing an inconsistent state and reporting phantom regressions.
- Live `POST /api/tax/calculate` is safe and expected: it appends to an
  ephemeral per-instance log, and the fixed `qa_probe_` ids mean a re-run
  replays rather than appends. Everything that mutates rules is local-only
  (section 6).
- Cross-agent context lives in `audit/AGENT-FEEDBACK.md`: techniques that have
  paid off, dead ends already explored, and traps that apply to any agent in
  this repo. Read it when a probe fails for a reason you cannot explain — the
  answer is often already there — and add to it when you learn something a
  future agent would otherwise rediscover.

## 14. Golden values — the numeric fingerprint

Assert against these, not just against status codes. A silent numeric change is
this repository's quietest failure mode: nothing errors, every check is green,
and the tax is wrong. Subject to the section 7 corroboration rule.

| Signal | Expected |
|---|---|
| Rule versions seeded | 30 |
| Fixtures calculated / errors | 57 / 0 |
| Test checks | 35 passed |
| BR digital_services | **1425 bps** (PIS_COFINS 9.25 + ICMS 0 + ISS 5) |
| BR electronics @2025-12-31 | `BR:ELECTRONICS:ICMS@v1`, 1700 bps |
| BR electronics @2026-01-02 | `BR:ELECTRONICS:ICMS@v2`, 1800 bps |
| AR digital B2C @2024-06-15 | 2900 bps (IVA + PAIS) |
| AR digital B2C @2026-01-13 | 2100 bps (IVA only, PAIS lapsed 2024-12-23) |
| AR digital B2B | 0 bps, reverse charge |
| CL books 100000 CLP | 19000 tax (zero-decimal currency) |
| CO clothing 9999.99 / 10000.00 | 0 / 190000 minor (threshold COP 10,000.00) |
| CO food 100.00 | 500 minor (5% reduced) |
| PE electronics 100.00 | 1800 minor (18% IGV) |
| Unknown category | HTTP 422 `NO_APPLICABLE_RULE` |
| Malformed body | HTTP 4xx with `error.code`, never 500 |
| `GET /` | 200 |
| Smoke suite | 8 passed, 0 failed |

**BR digital_services must never charge ICMS.** STF ADI 1945/MT and ADI 5659/MG
(2021) hold ICMS and ISS mutually exclusive on software. If that line ever shows
a non-zero ICMS rate, it is P0 — it means the 0% `exempt` rule was removed and
the `BR:*:ICMS` country wildcard is falling through at 17%.
