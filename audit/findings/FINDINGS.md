# Findings registry

Every issue that puts rubric points at risk. Append new ones as `F-NNN`.
Update **Status** when you fix one, and write an `audit/log/` entry that names
the finding id. Never delete a row.

Status: `OPEN` · `IN PROGRESS` · `RESOLVED` · `WONTFIX` · `NEEDS DECISION`

| ID | Finding | Pts at risk | Detail | Task | Owner | Status |
|---|---|---|---|---|---|---|
| F-001 | Fixtures cover MX/US/CO, brief requires BR/CO/AR/CL/PE | 25 | `docs/01-GAP-ANALYSIS.md` G1 | T1 | claude-code | **RESOLVED** |
| F-002 | No persisted audit trail; `lib/db.ts` opens `readOnly: true` | 20 | G2 | T3 | claude-code | **RESOLVED** |
| F-003 | Single time axis on rules; cannot satisfy "historical calcs unchanged" | 20 | G3 | T2 | claude-code | **RESOLVED** |
| F-004 | Rates stored as float fractions (`rate: 0.16`) instead of basis points | accuracy | G4 | T4 | claude-code | **RESOLVED** |
| F-005 | No runtime rule-write endpoint; reviewer must edit JSON and reseed | rule mgmt | G5 | T5 | claude-code | **RESOLVED** |
| F-006 | `TaxCategory` conflates tax treatment with product category | accuracy | G6 | T2/T4 | claude-code | **RESOLVED** |
| F-007 | Missing edge cases: zero, refund, threshold boundaries, CLP rounding, 422 | accuracy | G7 | T4/T6 | claude-code | **RESOLVED** |
| F-008 | `/out/` gitignored, silently drops the required compliance-report deliverable | 10 | `docs/06-SUBMISSION.md` Trap 1 | T7 | cowork | **RESOLVED** |
| F-009 | `data/yuno-tax.db` committed and can go stale against the JSON fixtures | correctness | Trap 2 | T9 | — | **RESOLVED** |
| F-010 | Vercel cannot host the audit-trail write path on SQLite | 20 | Trap 3 | T9 | — | **RESOLVED** |
| F-011 | Idempotency is an explicit Requirement 1 clause, absent from the build plan | accuracy | `docs/06-SUBMISSION.md` | T3/T8 | claude-code | **RESOLVED** |
| F-012 | Fixtures need timestamp variety and small/medium/large amount bands | test data | `docs/06-SUBMISSION.md` | T6 | cowork | **RESOLVED** |
| F-013 | Compliance report must carry an `edgeCases` block (explicit in Requirement 2) | 20 | `docs/06-SUBMISSION.md` | T5 | claude-code | **RESOLVED** |
| F-014 | Vercel lambda filesystem is read-only; audit writes fail on the deployed URL | 20 | `audit/findings/FINDINGS.md` F-014 | T10 | claude-code | **RESOLVED** |
| F-015 | Retry with a caller-supplied `transaction_id` returns 500 (UNIQUE constraint). PRD requires no duplicate side effects | correctness | `docs/07-PRD-DELTA.md` | **T11** | claude-code | **RESOLVED** |
| F-016 | Audit lookup returns one record; PRD says "complete audit history" per transaction | low | `docs/07-PRD-DELTA.md` | **T16** | claude-code | **RESOLVED** (documented) |
| F-017 | Rules API exposes Create/Read only; PRD asks for CRUD | 20 | `docs/07-PRD-DELTA.md` | **T12** | claude-code | **RESOLVED** |
| F-018 | Performance NFR (<50ms, caching, 100k/day) not addressed or measured | code quality | `docs/07-PRD-DELTA.md` | **T15** | claude-code | **RESOLVED** |
| F-019 | Brazilian stacking is state+municipal; PRD specifies federal + state + municipal | accuracy | `docs/07-PRD-DELTA.md` | **T13** | claude-code | **SUPERSEDED** by F-022 |
| F-020 | `countries.rounding_mode` is seeded but never read by the calculator | code quality | `docs/07-PRD-DELTA.md` | **T14** | claude-code | **RESOLVED** |
| F-021 | README opens with architecture, not the business outcome the PRD leads with | docs | `docs/07-PRD-DELTA.md` | **T16** | claude-code | **RESOLVED** |
| F-022 | `BR:DIGITAL_SERVICES` stacks ICMS + ISS, which STF ADI 1945/5659 (2021) holds to be mutually exclusive on software | **25** | `docs/09-T13-REVISED.md` | **T13-R** | claude-code | **RESOLVED** |
| F-023 | `AR:DIGITAL_SERVICES:PAIS` has `validTo: null` but Impuesto PAIS ended ~2024-12-22/23 | **25** | `docs/11-DATA-DISCLAIMER.md` | catalogue | cursor | **RESOLVED by labelling** |
| F-024 | `CO:CLOTHING:IVA` permanent COP threshold is invented (Días sin IVA were day-limited); notes misstate minor units | **25** | `docs/11-DATA-DISCLAIMER.md` | catalogue | cursor | **RESOLVED by labelling** |
| F-025 | `BR:ELECTRONICS:ICMS` v2 18% cites EC 132/2023; reform does not mandate that ICMS bump on 2026-01-01 | accuracy | `docs/11-DATA-DISCLAIMER.md` | catalogue / demo honesty | cursor | **RESOLVED by labelling** |
| F-026 | Vercel sets VERCEL=1 at BUILD time, so the seed wrote its audit rows to the build container /tmp and shipped an empty audit trail | 20 | `lib/db.ts` `getDbPath()` | T10 | claude-code | **RESOLVED** |
| F-027 | `docs/reference/` looks like a second submission; `docs/_archive/` is scaffolding noise | docs | `audit/log/0015-cowork-final-repo-audit.md` | hygiene | cursor | **RESOLVED** |
| F-028 | Equivalent non-UTC transaction timestamps select different valid-time rule versions | 25 | `lib/validation.ts:147` stored the caller's offset string without normalization | audit pass 001 | cursor | **RESOLVED** |
| F-029 | An uncovered zero-value transaction silently returns 200/0% instead of `NO_APPLICABLE_RULE` | 25 | `lib/calculator.ts:82` short-circuited before checking rule coverage | audit pass 001 | cursor | **RESOLVED** |
| F-030 | A discount larger than a sale is misclassified as a refund; unsafe amounts can overflow exact integer-rate multiplication | 25 | live edge probe against `/api/tax/calculate` | audit pass 001 | cursor | **RESOLVED** |
| F-031 | Rule append-only trigger allows in-place mutation of treatment, threshold, scope and other version fields | 20 | rollback probe accepted `UPDATE ... SET treatment='exempt'` | audit pass 001 | cursor | **RESOLVED** |
| F-032 | Validation and malformed-JSON failures bypass the immutable audit trail | 20 | invalid local request left audit count unchanged at 57 | audit pass 001 | cursor | **RESOLVED** |
| F-033 | Six catalogue rows have neither `legalReference` nor explanatory notes despite reviewer-facing claims; demo says nine categories but shows seven | 10 | `data/tax-rules.json`; `scripts/demo.ts:52` | audit pass 002 | cursor | **RESOLVED** |
| F-034 | README promises snake_case requests and responses, but calculation responses mix snake_case envelope fields with camelCase domain fields | 15 | `README.md:116`; live `/api/tax/calculate` response | audit pass 002 | cursor | **RESOLVED** |
| F-035 | A rejected request reusing a successful `transaction_id` is not audited; the route returns 400 while the immutable row remains the earlier success | 20 | `lib/tax-service.ts:55`; direct local valid-then-invalid probe | audit pass 002 | cursor | **RESOLVED** |
| F-036 | A corrected request cannot reuse the `transaction_id` from a validation failure and receives 500 `INVALID_REQUEST` | 15 | `lib/tax-service.ts:146`; direct local invalid-then-valid probe | audit pass 002 | cursor | **RESOLVED** |
| F-037 | Zero-amount audit provenance names resolved rules while the same row's stored output names none | 20 | `lib/calculator.ts:89`; direct local response/audit comparison | audit pass 002 | cursor | **RESOLVED** |
| F-038 | Reviewer-linked docs retain stale 29-rule/56-fixture and statutory-rate claims; README mentions but does not link the committed report | 1 | `docs/04-TAX-RULES.md:3-8`; `docs/06-SUBMISSION.md:78-79`; `README.md:85` | next audit pass | cursor | **OPEN** |

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

### F-023 — OPEN — PAIS still open-ended after repeal · 25 pts · catalogue

`AR:DIGITAL_SERVICES:PAIS` uses `rateBps: 800` and `validTo: null`. Impuesto
PAIS was not extended and ended ~22–23 December 2024 (EY / VATupdate). Any
fixture dated 2025+ that stacks PAIS is wrong to a domain reviewer.

**Patch:** set `"validTo": "2024-12-23"` on that rule version. Exact JSON in
`audit/findings/CURSOR-RULE-VERIFICATION.md`.

### F-024 — OPEN — Colombia clothing threshold is not standing law · 25 pts · catalogue

`CO:CLOTHING:IVA` sets `thresholdMinor: 1000000` with `validTo: null` and notes
claiming COP 100,000 exemption. UVT clothing caps were part of **Días sin IVA**
(Ley 2155 arts. 37–38), limited to decreed days and discontinued after Ley
2277/2022. Notes also mis-convert minor units (1,000,000 minor = COP 10,000 at
exponent 2, not COP 100,000).

**Patch:** set `thresholdMinor: 0` and rewrite notes, or bound validity to an
explicit illustrative demo with honest labeling. See
`audit/findings/CURSOR-RULE-VERIFICATION.md`. Update `txn_co_0004/5/6` after.

### F-025 — OPEN — Electronics 18% falsely attributed to EC 132 · accuracy · catalogue

`BR:ELECTRONICS:ICMS` v2 cites "EC 132/2023 transition (CBS/IBS phase-in)" for
an 18% ICMS rate from 2026-01-01. EC 132 / LC 214 introduce test IBS/CBS in
2026; they do not mandate a nationwide ICMS electronics increase of 1pp on that
date. Keeping a valid-time demo split is fine if labeled illustrative; citing
EC 132 as the legal cause is not.

**Patch:** rewrite `legalReference`/`notes`, or remove the invented bump. See
`audit/findings/CURSOR-RULE-VERIFICATION.md`.

---

### F-001…F-007, F-011, F-013 — RESOLVED 2026-08-03T03:30Z by `claude-code`

Closed by the T1–T5 core build; see `audit/log/0011-claude-code-t1-t5-core-build.md`.
Catalogue swapped to BR/CO/AR/CL/PE with a `legalReference` on every rule (F-001);
`readOnly` removed and `lib/audit.ts` added, one row per request including
failures (F-002); `recordedAt`/`supersededAt` added beside `validFrom`/`validTo`
with resolution on both axes (F-003); `rate: number` replaced by integer
`rateBps` throughout, CLP exponent 0 (F-004); `POST /api/tax/rules` added
(F-005); `TaxCategory` split into `productCategory` + `treatment` (F-006); zero,
refund, threshold-boundary, CLP rounding, discount-base and 422 cases all
covered by tests (F-007); the compliance report carries the `edgeCases` block
(F-013). Verified: `npm test` 35 checks, `npm run demo` end to end.

### F-012 — RESOLVED (reseed executed) 2026-08-03T03:30Z by `claude-code`

The blocker is cleared. `npm run db:seed` on the Mac: **57 fixtures calculated,
0 audited as errors**. The finding predicted "roughly 55 calculated and 1 error";
`txn_pe_0005` is not an error — a 2024-06 Peruvian digital sale falls through to
the `PE:*:IGV` wildcard, which is the intended fallback. Fixture count is 57
rather than 56 after `txn_ar_0012` was added for F-023.

### F-014 — RESOLVED 2026-08-03T04:10Z by `claude-code`, pending live verification

`lib/db.ts` copies the bundled database to the instance's `/tmp` on first use
when `process.env.VERCEL` is set, and opens it read-write. The companion
mitigation is in place: `scripts/seed-db.ts` replays all 57 fixtures through the
real service at seed time, so every instance boots with a populated audit trail.
**See F-026 — that mitigation was silently broken until now.** Final sign-off is
smoke check 3 against the deployed URL.

### F-026 — RESOLVED 2026-08-03T04:10Z by `claude-code`

Found while planning the deploy, not reported by any reviewer. `getDbPath()`
diverted to `/tmp` whenever `VERCEL` was set — and Vercel sets `VERCEL=1` during
the **build**, not just at runtime. So `prebuild → db:seed → calculate()` wrote
all 57 fixture audit rows into the build container's `/tmp` and discarded them,
shipping a lambda with a full rule catalogue and an **empty audit trail**: the
exact F-014 failure the `/tmp` copy was designed to prevent, and invisible
locally because `VERCEL` is unset on a dev machine.

Reproduced and fixed:

```
VERCEL=1 npm run db:seed
  before: data/yuno-tax.db audit rows: 0    (/tmp/yuno-tax.db had all 56)
  after:  data/yuno-tax.db audit rows: 56
```

Fix: `useSeededDatabase()` in `lib/db.ts` pins the path to the shipped artefact,
called once by `scripts/seed-db.ts` before the replay loop. It reads no
environment variable, so it does not reintroduce the Next file-tracing warning
that caused `YUNO_DB_PATH` to be removed earlier.

### F-015, F-017, F-018, F-020, F-021, F-016 — RESOLVED 2026-08-03T04:00Z by `claude-code`

T11–T16; see `audit/log/0012-claude-code-t11-t16.md`.

### F-019 — SUPERSEDED by F-022 2026-08-03T03:50Z by `claude-code`

Adding federal PIS/COFINS *on top of* the existing ICMS line would have stacked
three taxes on a base where ICMS is constitutionally inapplicable, compounding
the F-022 error rather than fixing it. Implemented T13-R instead.

### F-022 — RESOLVED 2026-08-03T03:50Z by `claude-code`, with a deviation

Implemented per `docs/09-T13-REVISED.md` **except** step 1. Deleting
`BR:DIGITAL_SERVICES:ICMS` outright does not work: the `BR:*:ICMS` country
wildcard then matches `digital_services` and charges 17%, reinstating exactly
the combination the STF forbade. Caught by a failing test, not by review.

The rule is retained at `rateBps: 0`, `treatment: "exempt"`, cited to ADI 1945 /
ADI 5659, so the exclusivity is encoded in the catalogue rather than depending on
the absence of a row. BR digital services returns three lines — PIS/COFINS 9.25%
federal, ICMS 0% state, ISS 5% municipal — for **1425 bps effective**.

### F-023, F-024, F-025 — RESOLVED by labelling 2026-08-03T04:30Z by `cursor`

Per `docs/11-DATA-DISCLAIMER.md`: keep rates/mechanisms, label invented citations.
No rate numbers changed in this pass.

- **F-023:** `legalReference` prefixed `Illustrative:` (historical PAIS window).
  `validTo: "2024-12-23"` already present from the prior catalogue pass — retained
  as the optional second date-selection demo the disclaimer doc allows.
- **F-024:** `legalReference` set to
  `Illustrative: day-limited VAT relief, modelled here as a permanent threshold
  to exercise threshold logic`. Threshold mechanism kept for `txn_co_0004/5/6`.
- **F-025:** `legalReference` set to
  `Illustrative: modelled rate increase, used to demonstrate effective-dated
  versioning`. Version pair kept.

Also applied the four disclaimer placements: README section, `data/tax-rules.json`
`_meta` (seed skips it), Illustrative prefixes on invented refs (STF ADI ICMS
exclusion **not** prefixed), and `disclaimer` on health + compliance JSON + `/`.

### F-023, F-024, F-025 — RESOLVED 2026-08-03T04:20Z by `claude-code` (superseded note)

Prior pass closed PAIS `validTo`, corrected clothing threshold units in notes,
and rewrote the EC 132 citation. Cursor’s docs/11 labelling pass above is the
canonical resolution text for submission.

### F-014 — RESOLVED 2026-08-03T04:45Z by `claude-code`, with a measured caveat

Smoke test against `https://yuno-tax.vercel.app`: **8 passed, 0 failed**,
including check 3 (POST a calculation, GET its audit record) and check 4
reporting `replayed=True`.

The F-026 fix is confirmed live — the seeded trail ships and is readable on any
instance:

```
GET /api/audit/txn_br_0001  -> 200 tax=1700  rules=["BR:ELECTRONICS:ICMS@v1"]
GET /api/audit/txn_ar_0012  -> 200 tax=289710 rules=["...PAIS@v1","...IVA@v1"]  (29%, pre-repeal)
GET /api/audit/txn_co_0004  -> 200 tax=0      rules=["CO:CLOTHING:IVA@v1"]
```

**Caveat, measured not assumed.** The first smoke run immediately after the
deploy failed check 3, and a POST-then-GET loop succeeded 3 of 5 times while
instances were cold, 5 of 5 once warm. Cause is the documented one: `/tmp` is
per-instance, so a read routed to a different instance than the write does not
see the row. Reads of seeded transactions never fail, and reporting never fails,
because the seed ships in the bundle. Recorded in `README.md` and `NOTES.md`
rather than papered over. The production fix is Turso/libSQL or Postgres behind
`lib/db.ts`, which changes nothing above the repository layer.

### F-026 — BLOCKING — Production URL returns 404 · submission Deliverable URL

`https://yuno-test-nic.vercel.app/`, `/api/health` and `/api/audit/txn_br_0001`
all return 404. Not a protection wall, not a build-error page. This is the URL
going in the submission form's Deliverable URL field.

`.vercel/project.json` shows the project exists
(`prj_AQScbk5JEJIdCv3dx7aQXSiFdeIK`, team `team_iZtrUMgQy7fcyShR98St3elu`), and
`origin/main` now contains every source file, so the earlier cause (untracked
`lib/` and `app/api/audit/`) is fixed. Something else is wrong.

Diagnose in this order:

1. **No production deployment.** A CLI link creates the project but `vercel`
   alone deploys a preview. Run `vercel ls` then `vercel --prod`.
2. **Git integration not connected.** If the project was linked by CLI only,
   `git push` triggers nothing. Connect the GitHub repo in project settings.
3. **Node version — the most likely runtime cause.** `lib/db.ts` imports
   `node:sqlite`, which is only available without a flag on recent Node 22.x.
   Local is v22.22.3 and works. If the Vercel project is pinned to Node 20, or
   to a 22.x older than the unflagging, every API route throws on import.
   Check Project Settings → Node.js Version and set 22.x. `package.json`
   already declares `"engines": { "node": ">=22" }`.
4. **Build failure.** `vercel inspect <deployment-url> --logs`, or the
   Deployments tab. Watch for `prebuild` (`db:seed`) failing, which would leave
   `data/yuno-tax.db` absent and break `outputFileTracingIncludes`.

Once it responds, run `./verify/smoke-test.sh https://yuno-test-nic.vercel.app`.
Check 3 (POST a calculation, then GET its audit record) is the one that proves
the `/tmp` copy in `lib/db.ts` actually works on serverless. If that check
fails, Requirement 2 is broken in public and the repo URL should be the
Deliverable URL instead.

### F-027 — RESOLVED — Repo carries a second implementation and two junk files

`docs/reference/` is 30 committed files: a complete, different (Express) build
of the same brief, with its own `README.md`, `ARCHITECTURE.md`, `CLAUDE.md` and
`package.json`. `docs/reference/README.md` opens with the same title as the real
one. `tsconfig.json` already excludes `docs/`, so it cannot break the build, but
a reviewer browsing the repo can reasonably wonder which is the submission.

Also committed: `docs/_archive/_writetest.txt` (29 bytes, the output of `date`
from a filesystem check) and `docs/_archive/reference-impl.tar.gz` (44 KB
binary). Both are scaffolding noise in a graded repository.

Fix, about two minutes:

```bash
git rm -r --cached docs/_archive && echo "docs/_archive/" >> .gitignore
# then add a banner as the first line of docs/reference/README.md:
# > NOT THE SUBMISSION. This is a standalone Express reference build used to
# > prototype the domain logic. The submitted service is the Next.js app at the
# > repository root. See ../../README.md.
git add -A && git commit -m "Remove build scaffolding; label the reference build" && git push
```

Keeping `docs/reference/` is defensible and arguably shows process. Keeping it
unlabelled is not.

### F-014 — RESOLVED live on deliverable URL 2026-08-03T05:10Z by `cursor`

`./verify/smoke-test.sh https://yuno-test-nic.vercel.app` → **8 passed, 0 failed**,
including check 3. Status column no longer says “pending live smoke”.

### F-026 (404 narrative) — RESOLVED 2026-08-03T04:30Z by `cursor` deploy

Cause was Framework Preset **Other** / output `public` on project `yuno-test-nic`.
Fixed with `vercel.json` (`framework: nextjs`) + `vercel --prod`. Root and
`/api/health` return 200. Distinct from the earlier F-026 `/tmp` seed bug, which
remains RESOLVED under the same id in the status table.

### F-027 — RESOLVED 2026-08-03T05:10Z by `cursor`

Banner added to `docs/reference/README.md`. `docs/_archive/` removed from git
and ignored. Reference build retained as labelled process artifact.

### F-028–F-032 — RESOLVED 2026-08-03T14:10Z by `cursor`

The first rubric pass executed all required calculation edges against the live
API instead of relying on the existing suite. It reproduced five defects:

- `2025-12-31T23:00:00-03:00` selected Brazil electronics v1 while its UTC
  equivalent selected v2. Validation now canonicalizes valid timestamps.
- A zero-value transaction before every rule window returned 200/0%. Rule
  coverage is now checked before the zero-amount short circuit.
- A discount larger than the sale became a one-unit refund. Validation now
  rejects over-discounts and bounds amounts to exact basis-point multiplication.
- The rule trigger protected only selected columns. It now permits exactly one
  transition: a null `superseded_at` may be stamped once while every immutable
  field remains byte-for-byte unchanged.
- Route-level validation failures never reached `calculate()`, so no audit row
  was written. They now enter the same immutable table with the raw body,
  conservative indexed placeholders and an `INVALID_REQUEST` error.

Verified after the patches: all 35 checks, clean build/typecheck, 70/70 API
matrix, 20 edge probes, five persisted `INVALID_REQUEST` rows, full demo and
live smoke 8/8.

### F-033 — OPEN 2026-08-03T14:10Z by `cursor`

`BR:MEDICINE:ICMS`, `BR:EDUCATION:ICMS`, `CO:MEDICINE:IVA`,
`AR:FOOD:IVA`, `AR:MEDICINE:IVA` and `PE:MEDICINE:IGV` have both
`legalReference: null` and `notes: null`. The test titled “every seeded rule
carries a legal reference or an explanatory note” deliberately allows six
undocumented rows, so it proves a weaker statement than it prints. The demo
also labels seven distinct displayed categories as nine. Fix both in the next
pass; this pass reached the five-change cap.

### F-034 — OPEN 2026-08-03T14:10Z by `cursor`

README says requests and responses use snake_case at the boundary, but a live
calculation returns `transaction_id` beside `baseAmountMinor`, `taxLines` and
`effectiveRateBps`. The required values are present and documented, so this is
an API-consistency deduction rather than a correctness failure. Decide in the
next pass whether to translate the full response or narrow the README claim;
do not silently break existing examples.

### F-033–F-037 — RESOLVED 2026-08-04T14:18Z by `cursor`

- **F-033:** all 30 rule versions now carry an honest citation or explicit
  illustrative label. The catalogue test requires zero omissions. The demo
  matrix now actually displays all seven seeded categories and labels them as
  seven.
- **F-034:** successful and error JSON responses recursively translate domain
  keys to snake_case at the HTTP boundary, including null-prototype rows
  returned by `node:sqlite`. `replayed` now names either idempotency mechanism
  accurately. The compatibility smoke accepts the already-deployed camelCase
  response until this branch is deployed.
- **F-035/F-036:** pre-calculation rejections always receive a fresh generated
  audit identity and return its URL. They can no longer disappear behind an
  existing success or reserve the caller's transaction id against a corrected
  retry.
- **F-037:** a covered zero amount returns zero-valued tax lines naming every
  matched rule version, so response breakdown, stored output and audit
  provenance agree.

Verified with 70/70 country/category/customer combinations, all 20 prescribed
edges, dedicated valid-then-invalid and invalid-then-corrected probes, 35/35
tests, clean build/typecheck, local smoke 8/8 and live smoke 8/8.

### F-038 — OPEN 2026-08-04T14:18Z by `cursor`

The scored root docs are accurate, but linked process/catalogue docs still say
29 rules and 56 fixtures, and `docs/04-TAX-RULES.md` calls the working set
statutory despite the root disclaimer. The README mentions `reports/` without a
direct markdown link to a committed report. Deferred because pass 002 reached
the five-finding cap; this is the highest-value bounded start for pass 003.

