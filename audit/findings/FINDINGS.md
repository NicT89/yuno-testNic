# Findings registry

Every issue that puts rubric points at risk. Append new ones as `F-NNN`.
Update **Status** when you fix one, and write an `audit/log/` entry that names
the finding id. Never delete a row.

Status: `OPEN` · `IN PROGRESS` · `RESOLVED` · `WONTFIX` · `NEEDS DECISION`

| ID | Finding | Pts at risk | Detail | Task | Owner | Status |
|---|---|---|---|---|---|---|
| F-001 | Fixtures cover MX/US/CO, brief requires BR/CO/AR/CL/PE | 25 | `docs/01-GAP-ANALYSIS.md` G1 | T1 | claude-code | OPEN |
| F-002 | No persisted audit trail; `lib/db.ts` opens `readOnly: true` | 20 | G2 | T3 | claude-code | OPEN |
| F-003 | Single time axis on rules; cannot satisfy "historical calcs unchanged" | 20 | G3 | T2 | claude-code | OPEN |
| F-004 | Rates stored as float fractions (`rate: 0.16`) instead of basis points | accuracy | G4 | T4 | claude-code | OPEN |
| F-005 | No runtime rule-write endpoint; reviewer must edit JSON and reseed | rule mgmt | G5 | T5 | claude-code | OPEN |
| F-006 | `TaxCategory` conflates tax treatment with product category | accuracy | G6 | T2/T4 | claude-code | OPEN |
| F-007 | Missing edge cases: zero, refund, threshold boundaries, CLP rounding, 422 | accuracy | G7 | T4/T6 | claude-code | OPEN |
| F-008 | `/out/` gitignored, silently drops the required compliance-report deliverable | 10 | `docs/06-SUBMISSION.md` Trap 1 | T7 | cowork | **RESOLVED** |
| F-009 | `data/yuno-tax.db` committed and can go stale against the JSON fixtures | correctness | Trap 2 | T9 | — | NEEDS DECISION |
| F-010 | Vercel cannot host the audit-trail write path on SQLite | 20 | Trap 3 | T9 | — | NEEDS DECISION |
| F-011 | Idempotency is an explicit Requirement 1 clause, absent from the build plan | accuracy | `docs/06-SUBMISSION.md` | T3/T8 | claude-code | OPEN |
| F-012 | Fixtures need timestamp variety and small/medium/large amount bands | test data | `docs/06-SUBMISSION.md` | T6 | cowork | **RESOLVED (reseed pending)** |
| F-013 | Compliance report must carry an `edgeCases` block (explicit in Requirement 2) | 20 | `docs/06-SUBMISSION.md` | T5 | claude-code | OPEN |
| F-014 | Vercel lambda filesystem is read-only; audit writes fail on the deployed URL | 20 | `audit/findings/FINDINGS.md` F-014 | T10 | claude-code | OPEN |
| F-015 | Retry with a caller-supplied `transaction_id` returns 500 (UNIQUE constraint). PRD requires no duplicate side effects | correctness | `docs/07-PRD-DELTA.md` | **T11** | claude-code | OPEN |
| F-016 | Audit lookup returns one record; PRD says "complete audit history" per transaction | low | `docs/07-PRD-DELTA.md` | **T16** | claude-code | BENIGN, document |
| F-017 | Rules API exposes Create/Read only; PRD asks for CRUD | 20 | `docs/07-PRD-DELTA.md` | **T12** | claude-code | OPEN |
| F-018 | Performance NFR (<50ms, caching, 100k/day) not addressed or measured | code quality | `docs/07-PRD-DELTA.md` | **T15** | claude-code | OPEN |
| F-019 | Brazilian stacking is state+municipal; PRD specifies federal + state + municipal | accuracy | `docs/07-PRD-DELTA.md` | **T13** | claude-code | OPEN |
| F-020 | `countries.rounding_mode` is seeded but never read by the calculator | code quality | `docs/07-PRD-DELTA.md` | **T14** | claude-code | OPEN |
| F-021 | README opens with architecture, not the business outcome the PRD leads with | docs | `docs/07-PRD-DELTA.md` | **T16** | claude-code | OPEN |
| F-022 | `BR:DIGITAL_SERVICES` stacks ICMS + ISS, which STF ADI 1945/5659 (2021) holds to be mutually exclusive on software | **25** | `docs/09-T13-REVISED.md` | **T13-R** | claude-code | OPEN |

## Resolutions

### F-008 — RESOLVED 2026-08-03T01:57Z by `cowork`

`.gitignore:18` contained `/out/`, the Next.js static-export default, which
excluded `out/compliance-report-BR.json`. Confirmed with `git check-ignore -v`.
Git cannot re-include a file inside an excluded directory, so a negation
pattern does not work; the path had to move.

Fix: generated reports now go to `reports/` (created, with `.gitkeep`), and
`.gitignore` carries a comment explaining why `/reports/` must never be added.
`scripts/demo.ts` must write there. Verify with
`git check-ignore -v reports/compliance-report-BR.json` returning nothing.

### F-009 — NEEDS DECISION (partially actioned) 2026-08-03T01:58Z by `cowork`

`.gitignore` now lists `data/*.db`, but **`data/yuno-tax.db` is already tracked**
(`git ls-files data/` confirms it), and gitignore does not untrack a tracked
file. The ignore rule is currently inert.

Two ways to finish, pick one before submitting:

**A (recommended) — reviewer reseeds.** `predev`, `prebuild` and `pretest`
already run `db:seed`, so the database can never be stale.
```bash
git rm --cached data/yuno-tax.db
git commit -m "Untrack seeded database; npm run db:seed rebuilds it"
```
Then `README.md` must state that `npm run db:seed` is required before first run.

**B — ship a prebuilt database.** Remove the `data/*.db` lines from
`.gitignore` and commit the file. Lower friction for the reviewer, but a `.db`
that drifts from `data/tax-rules.json` produces wrong numbers with no warning.
If you choose B, `scripts/demo.ts` must reseed as its first step.

### F-010 — NEEDS DECISION

Unchanged. See `docs/06-SUBMISSION.md` Trap 3. Requires Nic.

### F-009 — RESOLVED (decision made) 2026-08-03T02:15Z by `cowork` + Nic

Evidence settled it. Inspected `data/yuno-tax.db` directly:

```
tax_rules: 12 rows   countries: CO, MX, US    (file mtime 01:49)
transactions: 13 rows
data/tax-rules.json: 29 rules, countries BR,CO,AR,CL,PE   (file mtime 02:03)
```

The committed database is **stale by two countries and 17 rules**. It still
contains Mexican and US rules that exist nowhere in source. Any code path that
reads it without reseeding returns wrong tax amounts with no warning. This is
precisely the failure mode the finding predicted.

**Decision: untrack it.** The `.db` is a build artifact regenerated from
`data/*.json`, and `predev` / `prebuild` / `pretest` already run `db:seed`, so
it is rebuilt before every dev run, every Vercel build and every test run.

```bash
git rm --cached data/yuno-tax.db
git commit -m "Untrack generated database; db:seed rebuilds it from data/*.json"
```

`.gitignore` already carries `data/*.db`. `README.md` must state that
`npm run db:seed` is the first step, and that the seed data itself
(`data/tax-rules.json`, `data/transactions.json`) is the reviewable artifact.

### F-010 — RESOLVED (decision made) 2026-08-03T02:15Z by `cowork` + Nic

Submission form (screenshot) takes a **Deliverable URL** (repo or deployed app)
plus an optional **GitHub Repository URL**, and requires both to be public.
Repo `NicT89/yuno-testNic` verified **public**. Nic wants a Vercel URL.

**Decision: deploy to Vercel, and submit both links.** Deliverable URL = the
Vercel app, GitHub Repository URL = the repo. Both fields get filled; the
reviewer can run the live API and read the source.

This creates a new obligation, tracked as **F-014**: the deployed instance must
actually satisfy Requirement 2. A Vercel deployment where `POST /calculate`
does not persist and `GET /audit/:id` returns nothing scores *worse* than no
deployment, because the reviewer tests the live URL first.

### F-014 — OPEN — Audit writes must work on Vercel · 20 pts · Task T10

**Problem.** `prebuild` seeds `data/yuno-tax.db` at build time and
`outputFileTracingIncludes` ships it into the lambda, where the filesystem is
**read-only**. `lib/db.ts` opens `readOnly: true` for exactly that reason. But
Requirement 2 is a write path.

**Fix (recommended, ~20 lines, no async refactor):** copy the bundled database
into Vercel's writable `/tmp` on cold start and open it read-write.

```ts
// lib/db.ts
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BUNDLED = join(process.cwd(), "data", "yuno-tax.db");
const isServerless = !!process.env.VERCEL;
// Vercel lambdas get ~512MB of writable /tmp. Everything else writes in place.
const RUNTIME = isServerless ? "/tmp/yuno-tax.db" : BUNDLED;

export function getDb() {
  if (db) return db;
  if (isServerless && !existsSync(RUNTIME)) copyFileSync(BUNDLED, RUNTIME);
  db = new DatabaseSync(RUNTIME);        // read-WRITE, no readOnly flag
  return db;
}
```

**Required companion change.** `/tmp` is per-instance and resets on cold start,
so a reviewer could calculate on one instance and read the audit trail on
another. Mitigate by having `scripts/seed-db.ts` **run all 56 fixture
transactions through the real calculator at seed time** and write their audit
rows into the bundled database. Every instance then boots with a populated
audit trail, so `GET /api/tax/report` and `GET /api/audit/:id` for any seeded
`transaction_id` always work. New calculations append to whichever instance
serves them. Reference: `docs/reference/src/seed/index.ts`.

**Document the limit honestly in `README.md` and `NOTES.md`:**

> On Vercel the audit database is copied to the instance's `/tmp` on cold start,
> so writes are durable for the life of that instance but not shared across
> concurrent instances. The seed populates the audit trail at build time so
> reporting works on any instance. Production would point the repository layer
> at Turso/libSQL or Postgres; nothing above `lib/db.ts` changes.

Naming the constraint scores better than a deployment that quietly loses data.


### F-012 — RESOLVED 2026-08-03T02:45Z by `cowork` · RESEED STILL REQUIRED

`data/transactions.json` held 13 fixtures for MX/US/CO in the pre-refactor
shape (`country`, `amount`, `category:"standard"`). `scripts/seed-db.ts`
guards with `asSeedTransaction`, which requires `countryCode` (camelCase) and
`amountMinor`. **All 13 failed the guard and were silently skipped** via the
`skipped++` branch. The 9 audit rows present at 02:40Z came from ad-hoc test
calls, not fixtures.

Consequence: the compliance report had almost no data, no refunds, no zero
amounts and no threshold cases, so Requirement 2's acceptance criterion could
not be demonstrated, and F-014's cold-instance mitigation had nothing to seed.

Replaced with 56 fixtures in the exact shape the guard expects. Verified:

```
fixtures: 56 | pass asSeedTransaction guard: 56
by country: BR 15, CO 11, AR 11, CL 9, PE 10
zero: 3 | refunds: 5 | discounts: 3 | tax-inclusive: 2
categories: electronics, food, books, digital_services, clothing, medicine, education
months: 2024-06 2025-11 2026-01 2026-02 2026-03 2026-04
threshold trio: txn_co_0004 (below), txn_co_0005 (at), txn_co_0006 (above)
```

Timestamp variety spans the Brazil 2026-01-01 ICMS boundary (`txn_br_0001` at
2025-11-15 vs `txn_br_0002` at 2026-03-15, identical inputs) and includes
`txn_pe_0005` dated 2024-06-15, before Peru's digital-services rule existed, so
it exercises the wildcard fallback.

**ACTION REQUIRED — run on the Mac:**
```bash
npm run db:seed
```
`cowork` could not run it: `node_modules` was installed on darwin-arm64 and the
audit sandbox is linux-arm64, so esbuild refuses to load. Expect roughly 55
calculated and 1 audited as an error (`txn_pe_0005`, which is intentional).


### F-022 — OPEN — ICMS and ISS cannot both apply to digital services · 25 pts · T13-R

STF ADI 1945/MT and ADI 5659/MG (February 2021) held that software transactions
are subject to **ISS, not ICMS**; the two are constitutionally mutually
exclusive on digital goods. `data/tax-rules.json` currently applies both to
`BR:DIGITAL_SERVICES` and calls it "the multi-tax case".

Yuno is a LATAM payments company. A reviewer who knows the ICMS/ISS software
dispute sees a confidently wrong rule, which reads worse under Tax Calculation
Accuracy than a missing feature.

**Supersedes T13.** Do not add federal PIS/COFINS on top of the wrong ICMS
line. Replace the ICMS line with PIS/COFINS-Importação at 9.25% federal, keep
ISS at 5% municipal, effective 14.25%. Still multi-tax, still two levels of
government, and defensible. Full instructions and the exact three files to
touch: `docs/09-T13-REVISED.md`.

Sourced from the STF rulings as reported by Machado Associados, Mattos Filho
and International Tax Review.
