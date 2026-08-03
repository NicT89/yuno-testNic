# 0013 — claude-code — Catalogue accuracy fixes and the Vercel seed defect

**When:** 2026-08-03T04:20Z
**Agent:** claude-code
**Task:** F-023/024/025 remediation, F-026 (new), findings registry sweep
**Findings touched:** F-023, F-024, F-025, **F-026 (opened and resolved)**, plus a status sweep of F-001…F-022
**Files changed:** `lib/db.ts`, `scripts/{seed-db.ts,demo.ts,test-tax.ts}`,
`data/{tax-rules.json,transactions.json}`, `docs/04-TAX-RULES.md`, `README.md`,
`audit/findings/FINDINGS.md`, `audit/ACTIVE.md`

## What changed

**F-026, found while planning the deploy.** `getDbPath()` in `lib/db.ts`
diverted to `/tmp` whenever `process.env.VERCEL` was set. Vercel sets `VERCEL=1`
during the **build** as well as at runtime, so `prebuild → db:seed →
calculate()` wrote all 56 fixture audit rows into the build container's `/tmp`
and threw them away — shipping a lambda with a complete rule catalogue and an
empty audit trail. That is precisely the F-014 failure the `/tmp` copy exists to
prevent, and it is what smoke check 3 tests. Invisible on a dev machine because
`VERCEL` is unset there. Fixed with `useSeededDatabase()`, called once by the
seed script; it reads no environment variable, so it does not reintroduce the
file-tracing warning that got `YUNO_DB_PATH` removed.

**F-023/024/025**, all three confirmed real. Approach: *keep the mechanism, fix
the citation*. Detail in the registry resolutions. The one thing worth repeating
here: F-024 had a **second error underneath the one Cursor reported** —
`thresholdMinor: 1000000` at exponent 2 is COP 10,000.00, while the rule note,
all three boundary fixtures and two lines of `docs/04-TAX-RULES.md` claimed COP
100,000. Nic chose to keep the value and correct the prose, so the fixture
amounts (9999.99 / 10000.00 / 10000.01) were already bracketing it correctly.

**Registry sweep.** 24 status cells rewritten. The registry claimed 20 findings
were OPEN that the code had already closed, including F-001 and F-017.

## Verified how

F-026, reproduced then fixed:
```
VERCEL=1 npm run db:seed
  before fix: data/yuno-tax.db audit rows: 0   (/tmp/yuno-tax.db: 56)
  after fix:  data/yuno-tax.db audit rows: 56
```

F-023, both directions, and now asserted in `npm test`:
```
AR B2C digital 2024-06-15 -> PAIS 8.00% + IVA 21.00% = 29.00%
AR B2C digital 2026-01-13 -> IVA 21.00%              = 21.00%
```

`npm test` → 35 checks. `npm run demo` → both date-selection demos print, 57
fixtures seeded, five reports written.
`grep -rn "COP 100,000\|EC 132/2023 transition" data/ docs/04-TAX-RULES.md README.md` → no hits.

## For the next agent

- **Ownership overlap, flagged not resolved.** `audit/**` is cowork's claim and
  Cursor claims `FINDINGS.md` append-only, but the protocol says the fixer flips
  the status and Nic asked for the sweep. I rewrote status cells in the table and
  appended to Resolutions; I did not delete or reword anyone else's finding text.
- `data/transactions.json` is now **57** fixtures, not 56. Anything asserting 56
  needs updating.
- The AR stack is no longer permanent. Any future fixture or doc that wants to
  show IVA+PAIS must be dated before 2024-12-23.
- F-014 is marked resolved *pending smoke check 3* against the live URL. If that
  check 404s, reopen it — do not trust the local result, because F-026 proves
  local and Vercel behaviour diverge here.
