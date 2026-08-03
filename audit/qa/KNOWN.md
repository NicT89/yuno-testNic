# Known and expected — suppress, do not report

Every entry needs: what it is, evidence it is deliberate, and the date confirmed.
The QA Probe Agent reads this before every run. Adding a confirmed-deliberate
behaviour here is the highest-value thing a run can do for future runs.

| ID | Behaviour | Why it is expected | Evidence | Confirmed |
|---|---|---|---|---|
| K-001 | `GET /api/audit/{id}` can 404 immediately after a `POST` on a cold instance, **for an id created in this run only** | `/tmp` is per-instance on Vercel; writes are durable per instance, not shared. Owner has accepted it: not an error | Measured 3/5 cold, 5/5 warm, then 6/8 on a warm instance. README + NOTES | 2026-08-03 |
| K-002 | No rules cache | p99 1.9ms against a 50ms NFR; a cache would add invalidation risk for no measurable gain | README performance section | 2026-08-03 |
| K-003 | `lib/money.ts` `toMinor()` uses `toFixed()` | The single deliberate float, at the input boundary before any arithmetic | Code comment in `lib/money.ts` | 2026-08-03 |
| K-004 | `app/page.tsx` eslint `<a>` vs `<Link>` error | No UI score; file is explicitly off-limits | `docs/00-CONTEXT.md` | 2026-08-03 |
| K-005 | `data/tax-rules.json` first element is `_meta`, not a rule | Carries the illustrative-data disclaimer; iterators must filter it | `docs/11-DATA-DISCLAIMER.md` | 2026-08-03 |
| K-006 | `docs/reference/` fails lint and type checks | Standalone Express prototype, excluded from `tsconfig.json`, not the submission | `docs/12` section 9 | 2026-08-03 |
| K-007 | Rates do not match real statutes | The brief permits invented rates; all are labelled illustrative | `docs/11-DATA-DISCLAIMER.md` | 2026-08-03 |

## Explicitly NOT covered by K-001

A 404 on a **seeded** transaction id — `txn_br_0001`, `txn_ar_0012`,
`txn_co_0004` — is **P0, never suppressed**. Those rows ship inside the bundled
database and are readable on every instance, warm or cold. If one 404s, the
deployed artefact has lost its audit trail, which is the F-026 class of defect:
the build seeded into a throwaway `/tmp` and shipped an empty log. It presents
as the same status code as K-001 and means the opposite thing.

Probe both on every run. Same endpoint, same code, opposite severity — that
distinction is what makes the K-001 budget safe to hold.
