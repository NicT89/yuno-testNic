# AGENT-FEEDBACK — the memory between audit passes

**Read this before you do anything. Update it before you finish.**

Audit agents do not share memory. `audit/log/` is the append-only record of what
happened; **this file is the curated state of what is currently known**. The log
grows forever and nobody re-reads it; this file stays small enough to be read in
full at the start of every pass.

## How to use it

1. **First action of a pass:** read this file end to end. It tells you what is
   settled, what is already verified clean, and where the last pass thought you
   should start.
2. **Sample-verify it.** This file is itself a claim store, and this repository
   has already been burned twice by stale claim stores (`NOTES.md` and
   `ARCHITECTURE.md` both passed superficial checks while describing a build
   that no longer existed). Each pass, pick **at least two** entries from
   "Verified clean" and re-run their commands. If one no longer holds, that is a
   regression and your top-priority finding — fix it, and correct the entry.
3. **Last action of a pass:** update every section below. Move things you
   settled into "Settled". Add what you verified. Replace "Start here next"
   with something a fresh agent could act on immediately.

## Maintenance rules

- Every factual entry carries **a date and the command that established it**. An
  entry without a command is an opinion; delete it.
- If an entry is contradicted by the current baseline, **fix the entry** in the
  same pass. Never leave a known-false line here.
- Keep this file under ~200 lines. When "Pass history" exceeds 10 rows, collapse
  the oldest into a single summary line. Detail lives in `audit/log/`.
- Do not paste findings text here. Reference the id: `F-0NN`.

---

## Pass history

| # | Date | Agent | Outcome | Points moved | One line |
|---|---|---|---|---|---|
| 0 | 2026-08-03 | claude-code | shipped | baseline established | T1–T16, F-001…F-026 closed, live smoke 8/8 |

## Settled — do not re-raise

Each of these was decided deliberately. Reopen only with new evidence, and say
what the evidence is.

| Thing | Decision | Why | Date |
|---|---|---|---|
| Rules cache | **Not built** | p99 1.9ms vs a 50ms NFR. `npm run demo` prints it. A cache buys nothing measurable and costs review attention. | 2026-08-03 |
| Cold-start read-your-own-write 404 | **Documented, not fixed** | `/tmp` is per-instance on Vercel. Measured 3/5 cold, 5/5 warm. Only a shared store fixes it, which is out of scope. **Do not add a retry loop to the smoke test.** | 2026-08-03 |
| `toFixed(exp)` in `lib/money.ts` `toMinor()` | **Correct as-is** | The one place a float touches money, deliberately, at the input boundary before any arithmetic. | 2026-08-03 |
| Committed report path `reports/` not `out/` | **`reports/` is right** | `/out/` is a Next.js gitignore default that silently dropped the deliverable (F-008). `docs/05-REVIEW-CHECKLIST.md` line 46 is stale, not the repo. | 2026-08-03 |
| `app/page.tsx` eslint `<a>` vs `<Link>` | **Leave it** | No UI score; file is off-limits per CLAUDE.md. Owner confirmed not mission critical. | 2026-08-03 |
| `_meta` first element in `data/tax-rules.json` | **Keep, filter it** | Carries the illustrative-data disclaimer. `scripts/seed-db.ts` filters it; anything else iterating that file must too. | 2026-08-03 |
| Illustrative rates | **Acceptable** | The brief permits invented rates. Rules that are invented say so in `notes`. What is not acceptable is citing a real law that says something different. | 2026-08-03 |

## Verified clean

Re-run at least two of these per pass. Update the date when you do.

| Area | Last verified | Command | Expected |
|---|---|---|---|
| Baseline | 2026-08-03 | `npm run db:seed && npm test` | 30 rules, 57 fixtures, 0 errors, 35 checks pass |
| Build + types | 2026-08-03 | `npm run build && npx tsc --noEmit` | compiled, clean |
| Live deployment | 2026-08-03 | `./verify/smoke-test.sh https://yuno-tax.vercel.app` | 8 passed, 0 failed |
| Pure-core purity | 2026-08-03 | `grep -nE "^import" lib/calculator.ts lib/rules.ts` | only `./types`, `./money` |
| No float money math | 2026-08-03 | `grep -rnE '\* 0\.\|parseFloat\|rate \*' lib/ app/ scripts/` | no hits |
| Rubric coverage | 2026-08-03 | 70-combination sweep (see `audit/log/0014` addendum) | all resolve to an explainable rule |
| Byte-identity of audit records | 2026-08-03 | SHA of stored record before/after a live rate change | identical (`d4d85ad0…`) |
| Deliverables | 2026-08-03 | word count + file existence checks | 30 rules, 57 fixtures, ARCHITECTURE.md 400 words, report committed |

## Open leads — ranked, not yet acted on

| Lead | Criterion | Pts at risk | Why not done | Effort |
|---|---|---|---|---|
| Nothing currently above the bar | — | — | Pass 0 closed every finding it raised | — |

## Techniques that paid off

- **Verify claims, never read them.** Every defect found in pass 0 that
  review-by-reading missed came from executing something that would fail if a
  claim were false: `ARCHITECTURE.md` passed a word count while describing a
  different build; a duplicate fixture id surfaced only as "57 calculated, 56
  audit rows"; the Vercel `/tmp` bug was correct locally and broken in
  production because `VERCEL=1` is set at build time too.
- **Compare counts and hashes, not exit codes.** Three separate defects exited 0.
- **Before deleting a rule, check what falls through to a wildcard.** Deleting
  `BR:DIGITAL_SERVICES:ICMS` silently reinstated 17% ICMS via `BR:*:ICMS` —
  caught by a failing test, not by review.
- **Keep the mechanism, fix the citation.** The remedy for every domain-accuracy
  finding so far (F-023/024/025). Deleting a rule usually costs a demo.

## Dead ends — do not repeat

- `YUNO_DB_PATH` environment override in `lib/db.ts`: made Next's file tracer
  warn that the whole project was being traced. Use the non-env
  `pinToSeededDatabase()` instead.
- Reseeding under a running dev server: the cached `DatabaseSync` handle keeps
  serving the deleted file. Restart the server after a manual reseed.

## Start here next

Pass 0 left nothing above the bar. A fresh pass should:

1. Re-run the full baseline and at least two "Verified clean" rows.
2. Do the section 6 step 2 exercise cold — run `npm run demo` and hit the live
   URL as a first-time reviewer, and write down anything unconvincing in the
   first 60 seconds. That angle has had the least coverage so far.
3. Re-read `data/tax-rules.json` against `legalReference` accuracy. Three
   findings came from that sweep and it has only been done once.
