# 0014 — claude-code — Shipped to main, clean-clone verified, live smoke passed

**When:** 2026-08-03T04:45Z
**Agent:** claude-code
**Task:** Ship (commit/push, clean-clone test, deploy smoke test)
**Findings touched:** F-009 (executed), F-014 (closed), F-026 (verified live)
**Files changed:** `.gitignore`, `README.md`, `NOTES.md`, `audit/ACTIVE.md`,
`audit/findings/FINDINGS.md`, `reports/*.json`, plus the whole engine in commit `f342c0f`

## What changed

Commit `f342c0f` pushed to `main`: 43 files, the entire engine. Before it, every
route, repository, the demo and `scripts/schema.sql` existed only on one disk.
`data/yuno-tax.db` untracked per F-009; `.claude/` and `data/*.db-shm` added to
`.gitignore`.

`NOTES.md` rewritten — it still described the pre-refactor MX/US build and
claimed the database was opened read-only, which stopped being true at T3.

## Verified how

**Clean clone**, the test that catches "works on my machine":
```
git clone ... /tmp/verify-clone && npm install && npm run db:seed && npm test && npm run demo
  -> 30 rule versions, 57 fixtures calculated, 0 errors
  -> All 35 checks passed
  -> p50 0.173ms p95 0.246ms p99 2.039ms, five reports written
```
`scripts/schema.sql` and `data/transactions.json` both survived the clone; the
`.db` correctly did not, and `db:seed` rebuilt it.

**Live smoke**, `./verify/smoke-test.sh https://yuno-tax.vercel.app`:
```
first run (cold, right after deploy): 7 passed, 1 failed  -- check 3 404
second run (warm):                    8 passed, 0 failed  -- check 3 PASS, check 4 replayed=True
```

Diagnosed rather than re-run until green. The seeded trail is live and readable
on any instance (`txn_br_0001`, `txn_ar_0012`, `txn_co_0004` all 200), which is
the F-026 fix confirmed in production. A POST-then-GET loop scored 3/5 cold and
5/5 warm, so the failure is the known per-instance `/tmp` boundary, not a broken
copy.

## For the next agent

- **Do not "fix" the cold-start 404 with a retry loop in the smoke test.** It is
  a real architectural boundary and it is documented in `README.md` and
  `NOTES.md`. The fix is a shared store behind `lib/db.ts`.
- If you demo the live URL, warm it with one request first, or read a seeded
  transaction id.
- `data/tax-rules.json` now carries a `_meta` element as its first array entry
  (cowork). `scripts/seed-db.ts` filters it; anything else that iterates that
  file must do the same, or it will try to insert a rule with no `ruleKey`.
- Fixture ids: `txn_ar_0011` was already taken by the AR education case. The
  pre-expiry PAIS fixture added for F-023 is **`txn_ar_0012`**. The collision was
  silent — T11's idempotency short-circuit replayed the existing row instead of
  erroring — and only showed up as "57 calculated, 56 audit rows". Check counts,
  not exit codes.

---

## Addendum 2026-08-03T05:05Z — rubric audit against `docs/05-REVIEW-CHECKLIST.md`

Ran the checklist mechanically rather than by eye. Result: **one real gap**.

**`ARCHITECTURE.md` was stale** — the same failure NOTES.md had. It passed the
200-400 word check while describing the pre-refactor build: tables `tax_rules`
and `transactions` (neither exists), a single `effective_from`/`effective_to`
axis, regional rule matching, "the Mexico digital-services rule ships as v1 and
v2", "the DB is opened **read-only** at runtime", and "this demo does not accept
durable writes through the API". It never mentioned the audit trail at all —
20 of the 100 points. A reviewer reading it would have concluded the submission
does almost none of what it does. Rewritten to 400 words.

Everything else passed:

```
correctness blockers   no float money arithmetic, no parseFloat, CLP exponent 0
                       everywhere, no in-place rate UPDATE, no silent 0%, audit
                       written on the error path, aggregation in SQL
architecture           lib/calculator.ts + lib/rules.ts import only ./types and
                       ./money; no Date.now in the pure core; no `any` outside
                       the repo JSON boundary
coverage               70 country x category x customer-type combinations all
                       resolve to an explainable rule (checklist asks for 20)
byte-identity          stored audit record SHA d4d85ad07dd32ec3 before AND after
                       a 19% -> 25% rate change; a new calculation returns 25000
deliverables           30 rules (need 15+), 57 fixtures (need 50+),
                       ARCHITECTURE.md 400 words, reports/compliance-report-BR.json
```

Two notes for whoever reviews next:

- The checklist expects the committed report at `out/compliance-report-BR.json`.
  It is at `reports/` because F-008 moved it — `/out/` is gitignored by the
  Next.js default and silently dropped the deliverable. The checklist line is
  stale, not the repo.
- `lib/money.ts:97` uses `toFixed(exp)` inside `toMinor()`. That is the one place
  a float touches money, and it is deliberate: it is the input boundary that
  converts a caller's `amount: 199.99` into integer minor units before any
  arithmetic happens. Flagged here so a future audit does not re-raise it.
