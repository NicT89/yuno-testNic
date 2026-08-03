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
