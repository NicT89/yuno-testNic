# AGENT-FEEDBACK — cross-agent working memory

Shared by **every** agent in this repo. The other memory files are role-specific
and answer "where did I get to?":

| File | Owner | Answers |
|---|---|---|
| `audit/scorecard/LATEST.md` | Rubric Audit Agent (`docs/12`) | what the score is and where to push next |
| `audit/qa/STATE.json` + `KNOWN.md` | QA Probe Agent (`docs/13`) | what normal looks like and what is already known-expected |
| **this file** | everyone | **how to work on this codebase without relearning it** |

This one is not a status file. It holds techniques that paid off, dead ends
already explored, and traps that cost someone an hour. Read it when you are
stuck or when a result surprises you — the answer is often already here. Add to
it whenever you learn something a future agent would otherwise rediscover.

Referenced by `docs/12` and `docs/13` section 13, so it will not go orphaned.

## Rules

- Every entry states **what happened** and **what to do instead**. An entry
  without an action is a diary entry; delete it.
- Date every entry. Delete anything the current baseline contradicts.
- Keep under ~150 lines. This is a briefing, not an archive — detail lives in
  `audit/log/`.
- Do not duplicate status here. Scores go in the scorecard, known-expected
  behaviours go in `KNOWN.md`.

---

## Techniques that paid off

**Verify claims, never read them.** *(2026-08-03)* Every defect found in the
build pass that review-by-reading missed came from executing something that
would fail if a claim were false. `ARCHITECTURE.md` passed a 200-400 word check
while describing a completely different, older build. `NOTES.md` claimed the
database was opened read-only, which stopped being true three tasks earlier.
→ For any claim in a doc, comment or `notes` field, run something that fails if
it is wrong.

**Compare counts and hashes, not exit codes.** *(2026-08-03)* Three separate
defects exited 0. A duplicate fixture id surfaced only as a mismatch between "57
calculated" and 56 audit rows — the idempotency path had silently replayed it
instead of erroring. → Assert on numbers, not on success.

**Date-only bounds are not timestamp bounds.** *(2026-08-05)* Comparing
`transaction_date <= '2026-03-15'` excluded every transaction later that same
day, and the resulting empty report then threw while formatting a null currency.
→ Normalize date-only `from` to start-of-day and `to` to end-of-day, reject
reversed ranges, and always retain the jurisdiction currency for empty filings.

**Local green does not mean deployed green.** *(2026-08-03)* F-026: `getDbPath()`
diverted to `/tmp` whenever `VERCEL` was set, and Vercel sets `VERCEL=1` at
**build** time too, so the seed wrote 57 audit rows into the build container and
shipped an empty trail. Invisible locally because `VERCEL` is unset on a dev
machine. → Test environment-conditional code with the environment variable set:
`VERCEL=1 npm run db:seed`, then count rows in the artefact.

**Before deleting a rule, check what falls through.** *(2026-08-03)* Deleting
`BR:DIGITAL_SERVICES:ICMS` to satisfy the STF ruling silently reinstated 17%
ICMS via the `BR:*:ICMS` country wildcard — the exact combination the ruling
forbids. Caught by a failing test, not by review. → Resolution is
specificity-ranked with wildcard fallback; removing a specific rule promotes the
general one.

**Keep the mechanism, fix the citation.** *(2026-08-03)* The remedy for every
domain-accuracy finding so far (F-023/024/025). Each rule was load-bearing for a
demo, so deleting it cost points. Relabelling it honestly as illustrative cost
nothing. → An invented rate is fine under the brief; a real citation that says
something else is not.

**Cross edge cases; do not test them only in isolation.** *(2026-08-03)* Zero
amount and no-rule each passed alone, but together an uncovered transaction
returned 200/0% because the zero short circuit ran first. Offset timestamps also
passed generic ISO validation while selecting the wrong date window through
lexical comparison. → Combine degenerate amounts with missing coverage, and
canonicalize every accepted external timestamp before bitemporal comparison.

**Attack every column protected by an immutability claim.** *(2026-08-03)* The
rule trigger rejected rate updates, so the suite passed, but accepted in-place
changes to `treatment`, thresholds, scope and notes. → Define the one permitted
state transition (null `superseded_at` to one timestamp) and reject any UPDATE
whose full old/new row differs elsewhere.

**Do not give pre-validation failures the business transaction id.**
*(2026-08-04)* A rejected body stored under the caller's `transaction_id`
either hid behind an existing success or reserved that id so a corrected retry
returned 500. → Give every pre-calculation rejection a generated audit identity,
keep the requested id in the raw payload, and return the generated audit URL.

**SQLite result rows may have a null prototype.** *(2026-08-04)* The first
recursive response serializer handled plain domain objects but skipped nested
`node:sqlite` rows, leaving report keys camelCase. → Transform enumerable keys
on JSON-shaped objects regardless of prototype; verify recursively across every
endpoint, not just the calculation response.

## Dead ends — do not repeat

**`YUNO_DB_PATH` environment override in `lib/db.ts`.** *(2026-08-03)* Made
Next's file tracer warn that the whole project was being traced. → Use the
non-env `pinToSeededDatabase()` instead. Any dynamic path read from `process.env`
in a file reachable from a route handler will re-trigger it.

**Naming a helper `useSomething`.** *(2026-08-03)* `useSeededDatabase()` tripped
`react-hooks/rules-of-hooks` in lint, because this is a Next project and the
`use` prefix is reserved by convention. → Renamed to `pinToSeededDatabase()`.

**Reseeding under a running dev server.** *(2026-08-03)* The cached
`DatabaseSync` handle keeps serving the deleted file, so the server returns
stale data and you debug a ghost. → Restart the server after any manual reseed.
`predev` covers the normal flow.

**`pkill -f "next start"`** does not match the running process (it is
`next-server`). *(2026-08-03)* → Use `lsof -ti:3000 | xargs kill -9`.

## Traps specific to this repo

- `data/tax-rules.json` has a `_meta` object as its **first array element**.
  Anything iterating it must filter on the presence of `ruleKey`.
- Fixture ids are not contiguous. `txn_ar_0011` was already the AR education
  case; the pre-expiry PAIS fixture is `txn_ar_0012`. Check before assigning.
- `docs/reference/` is a standalone Express prototype excluded from
  `tsconfig.json`. It fails lint and type checks by design. Never probe or fix
  it.
- Concurrent agents edit this tree. `git pull` first, check `audit/ACTIVE.md`
  for claims, and if the tree is mid-change, stop rather than working on a
  half-applied state.

## Open questions for a human

*(none currently)*
