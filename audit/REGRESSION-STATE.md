# REGRESSION-STATE — memory between hourly regression runs

**Read this first. Update it last.** Same contract as
`audit/AGENT-FEEDBACK.md`, different job: that file remembers how to *improve*
the score, this one remembers what *normal* looks like so a run can tell a real
regression from noise.

Keep under ~200 lines. Detail goes in `audit/log/`.

---

## Golden values — the fingerprint of a healthy build

Numeric drift is the quietest failure mode this repo has. Compare against these
every run; a mismatch is a finding even if nothing errored.

| Signal | Expected | How |
|---|---|---|
| Rule versions seeded | 30 | `npm run db:seed` |
| Fixtures calculated / errors | 57 / 0 | `npm run db:seed` |
| Test checks | 35 passed | `npm test` |
| BR digital_services effective rate | **1425 bps** (PIS_COFINS 9.25 + ICMS 0 + ISS 5) | live POST |
| BR electronics @2025-12-31 | `BR:ELECTRONICS:ICMS@v1`, 1700 bps | live POST |
| BR electronics @2026-01-02 | `BR:ELECTRONICS:ICMS@v2`, 1800 bps | live POST |
| AR digital B2C @2024-06-15 | 2900 bps (IVA+PAIS) | live POST |
| AR digital B2C @2026-01-13 | 2100 bps (IVA only, PAIS lapsed) | live POST |
| AR digital B2B | 0 bps, reverse charge | live POST |
| CL books 100000 CLP | 19000 tax, zero-decimal | live POST |
| CO clothing 9999.99 / 10000.00 | 0 / 190000 minor (threshold COP 10,000.00) | live POST |
| Unknown category | HTTP 422 `NO_APPLICABLE_RULE` | live POST |
| Malformed body | HTTP 4xx with `error.code`, never 500 | live POST |
| `GET /` | 200 | live GET |
| Smoke suite | 8 passed, 0 failed | `./verify/smoke-test.sh <url>` |

## Known-accepted — budgeted, do not page inside the budget

| Behaviour | Budget | Page when | Why accepted |
|---|---|---|---|
| Read-your-own-write `GET /api/audit/{fresh id}` returns 404 | **up to 40% of attempts** | sustained >50% over 3 consecutive runs, **or** any 404 on a *seeded* id (`txn_br_0001`, `txn_ar_0012`, `txn_co_0004`) | `/tmp` is per-instance on Vercel. Measured 3/5 then 6/8 on 2026-08-03 (~25-40% failure). Architectural; only a shared store fixes it. Owner has accepted it: **not an error**. **Never "fix" this by adding retries to the smoke test.** |
| `app/page.tsx` eslint `<a>` vs `<Link>` | permanent | never | No UI score; file off-limits. |
| `ExperimentalWarning: SQLite` on stderr | permanent | never | `node:sqlite` is experimental in Node 22. |

## Check register — flap tracking

`flap rate` = failures ÷ runs over the last 24 runs. A check that flaps but is
not in the budget table above is itself a finding: either the check is wrong or
the system is unstable.

| Check | Runs | Fails | Flap | Last failure | Status |
|---|---|---|---|---|---|
| _(seed on first run)_ | 0 | 0 | — | — | — |

## Open incidents

| ID | Opened | Severity | One line | Status |
|---|---|---|---|---|
| _(none)_ | | | | |

## Closed incidents (most recent 5)

| ID | Closed | What it was | Fix |
|---|---|---|---|
| _(none yet)_ | | | |

## Start here next

First run: populate the check register, confirm every golden value above, and
record the read-your-own-write success rate over 10 attempts so the budget rests
on a real baseline rather than the two small samples taken on 2026-08-03
(3/5 and 6/8). If the observed rate is materially better than 40%, tighten the
budget — a budget looser than reality hides regressions.
