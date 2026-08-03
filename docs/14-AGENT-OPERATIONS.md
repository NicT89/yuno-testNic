# 14 — Automation agents: operations runbook

Two automation agents run against this repository. This file is the single
place that explains what they are, how to start and stop them, what they may
and may not touch, and where their memory lives.

**Read this if you are a human** deciding whether to run them, or wondering why
something in your inbox says what it says — sections 1, 3, 7, 8.
**Read this if you are an agent** trying to find your brief and your state
files — sections 2, 4, 5, 6.

---

## 1. The two agents, at a glance

| | **Rubric Audit Agent** | **QA Probe Agent** |
|---|---|---|
| Brief | `docs/12-RUBRIC-AUDIT-AGENT.md` | `docs/13-QA-PROBE-AGENT.md` |
| Question it answers | "How do we score higher?" | "Is it still working?" |
| Cadence | On demand, deliberate | Hourly, unattended (+ a daily heavier tier) |
| Runtime | Minutes to tens of minutes | Seconds hourly, minutes daily |
| Touches product code | **Yes**, within limits | **No, never** |
| Output | A numeric scorecard with a run-over-run delta | A pass/fail probe report |
| Success looks like | "Score moved from 87 to 91, here is the evidence" | "All green" — silence is the goal |
| Escalates to you when | It is blocked or needs a decision | P0, or a P1 unresolved for 3 runs |

They are deliberately asymmetric. The audit agent is allowed to change the
product because a human is watching. The probe agent is not, because nobody is.

## 2. Invocation prompts

Copy verbatim. Each firing should start a **fresh session** — both agents read
their state from disk, so they need no conversational memory.

### Rubric Audit Agent

```
You are the Rubric Audit Agent for this repository.

Read docs/12-RUBRIC-AUDIT-AGENT.md in full and execute one audit pass exactly
as specified. Read audit/scorecard/LATEST.md first for the previous pass's
score and where it told you to start; if it does not exist, this is pass 001.
Read audit/AGENT-FEEDBACK.md for techniques and dead ends already established.

Your objective is the 100-point rubric in section 4, nothing else. A change
that moves no criterion is out of scope. Respect the invariants in section 5
and the prioritisation bar in section 7.

Score yourself harshly, cap the pass at 5 changes, write
audit/scorecard/RUN-<NNN>.md, mirror it to LATEST.md, and report in the format
in section 11.
```

### QA Probe Agent

```
You are the QA Probe Agent for this repository.

Read docs/13-QA-PROBE-AGENT.md in full and execute one probe run exactly as
specified. Read audit/qa/STATE.json and audit/qa/KNOWN.md before probing
anything. If STATE.json does not exist, this is run 001: run the daily tier once
to establish a baseline and report it as a new baseline rather than reporting
every observation as a finding.

Determine your tier: daily if this is the first run after 06:00 local, otherwise
hourly.

You are judged on signal, not activity. A run reporting "all green" is a
successful run. Never manufacture a finding. Respect the noise budget in section
9 and the autonomy boundary in section 7.

Report in the format in section 10, write audit/qa/runs/RUN-<NNN>.md, mirror to
LATEST.md, and update STATE.json.
```

## 3. What lands in your inbox

Designed so that when an agent speaks, you believe it.

| Agent | Notifies you | Stays silent |
|---|---|---|
| Rubric Audit | Every pass — it is on-demand, you asked for it | — |
| QA Probe | P0; a P1 unresolved for 3 consecutive runs; a budget breach | All green; known-expected behaviour; flakes under 3 runs; anything P3 |

The probe agent has a hard noise budget: **at most 3 findings per run**, never
the same signature twice in 24h, and if everything passes the report is three
lines. If it exceeds that, the agent is the problem, not the service.

Known-expected behaviours live in `audit/qa/KNOWN.md` and are suppressed by
design. The most important one: a `GET /api/audit/{id}` 404 immediately after a
`POST` is **expected** (Vercel `/tmp` is per-instance) and will never page you.
A 404 on a *seeded* id such as `txn_br_0001` is **P0** and always will — same
endpoint, same status code, opposite meaning.

## 4. File map

```
docs/12-RUBRIC-AUDIT-AGENT.md   authoritative brief — rubric audit
docs/13-QA-PROBE-AGENT.md       authoritative brief — QA probe
docs/14-AGENT-OPERATIONS.md     this file

audit/AGENT-FEEDBACK.md         cross-agent: techniques, dead ends, repo traps
audit/ACTIVE.md                 file-ownership claims across all agents
audit/README.md                 the multi-agent protocol
audit/findings/FINDINGS.md      the findings registry (F-NNN)
audit/log/NNNN-<agent>-<slug>.md  append-only work log

audit/scorecard/RUN-<NNN>.md    rubric audit run records (append-only)
audit/scorecard/LATEST.md       mirror of the most recent pass

audit/qa/STATE.json             probe machine state, failure counts, signatures
audit/qa/KNOWN.md               known-and-expected register (suppression list)
audit/qa/runs/RUN-<NNN>.md      probe run records (append-only)
audit/qa/LATEST.md              mirror of the most recent run

docs/agents/SCORE-AUDIT-AGENT.md    tombstone — merged into docs/12
docs/13-REGRESSION-AGENT.md         tombstone — merged into docs/13
audit/REGRESSION-STATE.md           tombstone — merged into audit/qa/
```

## 5. The memory model, and why there are three kinds

Agents do not share memory between runs. Each kind of file answers a different
question, and mixing them is how memory files rot:

| Kind | Files | Mutable? | Answers |
|---|---|---|---|
| **Run records** | `scorecard/RUN-*`, `qa/runs/RUN-*` | Append-only | "What happened on run N?" A record that changes after the fact cannot establish when something broke. |
| **Rolling state** | `qa/STATE.json`, `qa/KNOWN.md`, `LATEST.md` | Mutable | "What is normal right now?" Flap rates and suppression lists have to roll. |
| **Working memory** | `audit/AGENT-FEEDBACK.md` | Mutable, curated | "How do I work on this codebase without relearning it?" Techniques, dead ends, traps. |

Every memory file in this repo carries a rule that entries must be dated and
evidenced, and that anything the current baseline contradicts gets fixed on
sight. That is not bureaucracy: this repo has already shipped two documents
(`NOTES.md`, `ARCHITECTURE.md`) that passed superficial checks while describing
a build that no longer existed. A stale memory file is worse than none, because
it is trusted.

## 6. Conventions

- **Append-only run records.** Never edit a past run.
- **Tombstones, not deletions.** When a spec is superseded, replace its contents
  with a pointer to the survivor and a note on what carried over, so the merge
  stays traceable. Three exist today.
- **Numbered docs.** `docs/NN-NAME.md`, next free number wins.
- **Claim before editing.** `audit/ACTIVE.md` holds the ownership table.
  Concurrent agents work this tree; `git pull` first, and if the tree is
  mid-change, stop rather than working on a half-applied state.
- **Findings are `F-NNN`** in `audit/findings/FINDINGS.md`, never deleted, only
  marked `RESOLVED`, `WONTFIX` or `SUPERSEDED` with a reason.

## 7. The safety model

Four boundaries do most of the work. Each exists because of a specific way an
unattended agent could damage a graded artefact.

**1. The probe agent may not touch product code.** `lib/**`, `app/**`,
`scripts/**` and `data/**` are off-limits to it entirely. It reports; it does
not repair.

**2. Rule mutation is local-only.** Neither agent may `POST`, `PUT` or `DELETE`
`/api/tax/rules` against production. Hourly rule writes would add ~24 versions
a day to the live catalogue and change the tax figures a reviewer sees. The
probe agent additionally confines itself to reserved `QA:PROBE:*` rule keys.

**3. Probe writes use fixed `qa_probe_*` transaction ids.** Because the service
is idempotent on a supplied `transaction_id`, re-running appends no new audit
rows after the first time — so hourly probing cannot inflate the compliance
report the reviewer reads, and it exercises the idempotency path for free.

**4. The corroboration rule.** An agent may only update an expected value when
it can cite an authorised cause — a commit, a finding, a feedback entry.
Without one, the expectation is right and the system is wrong. This closes the
one loophole through which an autonomous agent can make a real regression
disappear: from inside a single run, "the system changed" and "the expectation
was stale" look identical.

Neither agent may edit a test to make a failure pass, add retries to
`verify/smoke-test.sh`, change tax rates or `legalReference` values, add a
dependency, touch `app/page.tsx`, or force-push.

## 8. Decisions that stay with a human

- Anything requiring a new dependency or an external service — notably moving
  storage to Turso/libSQL or Postgres, which is the only real fix for the
  per-instance write boundary.
- Any change to a tax rate, a `legalReference`, or a fixture.
- Any change to the invariants in `docs/12` section 5.
- Whether agent changes land as direct commits or pull requests.
- When to stop the audit loop: `docs/12` section 8 says two consecutive passes
  finding nothing worth more than a point is the signal.

## 9. First run

Neither agent has run yet. Expect the first firing of each to be atypical:

- **Rubric Audit pass 001** has no `LATEST.md` to diff against, so it
  establishes the first scorecard. Treat its score as a baseline, not a verdict.
- **QA Probe run 001** creates `STATE.json`, runs the daily tier once, and
  reports a new baseline rather than treating every observation as a finding.
  Its most valuable early output is a better measurement of the cold-start
  read-your-own-write rate: the current budget of 40% rests on two small
  samples (3/5 and 6/8 on 2026-08-03). If the true rate is materially better,
  tighten the budget — one looser than reality hides regressions.

Run them one at a time until you trust them. They write overlapping files, and
`audit/ACTIVE.md` is the only thing coordinating them.
