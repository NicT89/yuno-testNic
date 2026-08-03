# TiendaMax Tax Compliance Engine

TiendaMax sells across Brazil, Colombia, Argentina, Chile and Peru. Today its
finance team reconciles cross-border tax by hand — **60+ hours a week** — and a
single misapplied Brazilian rate has already cost **$47,000** in underreporting
penalties. Changing a tax rate means a code change and a deploy, so expansion
into a new market waits on an engineering sprint.

This service is the layer that removes all three problems. It sits between
checkout and Yuno's payment orchestration, prices every transaction against a
versioned rule catalogue, and writes an immutable record of exactly which rule
version produced which number.

| Before | After |
|---|---|
| 60+ hours/week manual reconciliation | Reports aggregate in SQL, on demand |
| $47,000 underreporting penalty | Every calculation is replayable and cited to a legal reference |
| Rate change = sprint + deploy | Rate change = one API call, no downtime |
| New market = engineering project | New market = rows in a rule catalogue |

The engine refuses to guess. If no rule covers a transaction it returns **422**,
never a silent 0% — because a silently untaxed sale is the failure that produces
the penalty.

## Try it live

**https://yuno-test-nic.vercel.app** — deployed and serving the full API.

```bash
# Brazil, cross-border digital services: federal PIS/COFINS 9.25% + municipal ISS 5%
curl -s -X POST https://yuno-test-nic.vercel.app/api/tax/calculate \
  -H 'Content-Type: application/json' \
  -d '{"country_code":"BR","product_category":"digital_services","amount":100.00}'

# The audit trail that ships with the build — these resolve on any instance
curl -s https://yuno-test-nic.vercel.app/api/audit/txn_br_0001
curl -s "https://yuno-test-nic.vercel.app/api/tax/report?country=BR"
```

Two notes so nothing surprises you. The first request may cold-start, so give it
a moment. And reading back an audit record you created seconds earlier can 404
on a cold instance, because the SQLite file is copied per-instance on Vercel —
the seeded transactions above always resolve. That boundary is set out in full
under [SQLite on Vercel](#sqlite-on-vercel--trade-off), and `npm run demo`
exercises the whole engine locally without it.

## About the tax data

The tax rates, thresholds and effective dates in this repository are
**illustrative and were invented or approximated for demonstration purposes**.
They are not tax advice and should not be used to file anything. The brief
explicitly permits invented rates, and the engineering problem here is rule
resolution, versioning and auditability rather than statutory research.

What *is* modelled faithfully is the mechanics: standard, reduced, exempt,
zero-rated and reverse-charge treatments; multi-level stacking across federal,
state and municipal authorities; minimum thresholds; per-currency rounding
(CLP has no minor unit); and effective-dated rule versions.

One structural rule is researched rather than invented, because getting it
wrong would be a real error rather than a placeholder: ICMS and ISS are
mutually exclusive on software in Brazil following STF ADI 1945/MT and ADI
5659/MG (2021), so the catalogue never stacks them.

`legalReference` fields marked *Illustrative* are placeholders showing where a
real citation would live in production. The point of the design is that finance
can correct any rate through the API without a deploy and without rewriting
history, so replacing this catalogue with a maintained one is a data task, not
an engineering one.

## Quick start

```bash
npm install
npm run demo
```

Two commands from a clean clone. `npm run demo` seeds the database first, so
there is no separate setup step (`npm run db:seed` also runs standalone, and
automatically before `dev`, `build` and `test`).

`npm run demo` is the 20-second tour: a calculation matrix across all five
countries, every edge case, an idempotent retry, date-based rule selection
across Brazil's 2026 ICMS change, a live rate change that leaves history
untouched, latency percentiles, and `reports/compliance-report-<CC>.json` for
each country.

```bash
npm run dev    # API on http://localhost:3000
npm test       # 34 accuracy, versioning and immutability checks
```

Requires **Node.js 22+** for the built-in `node:sqlite`. `db:seed` runs
automatically before `dev`, `build` and `test`, so the database is never stale.
`data/tax-rules.json` and `data/transactions.json` are the reviewable source of
truth; `data/yuno-tax.db` is a generated artifact and is not committed.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/tax/calculate` | Price one transaction; writes one audit record |
| `GET` | `/api/tax/rules` | Rules, filterable on either time axis |
| `POST` | `/api/tax/rules` | Publish a new rule version |
| `GET` | `/api/tax/rules/{ruleKey}` | The version currently in force |
| `PUT` | `/api/tax/rules/{ruleKey}` | "Update": append vN+1, supersede vN |
| `DELETE` | `/api/tax/rules/{ruleKey}` | "Delete": close the validity window |
| `GET` | `/api/tax/rules/{ruleKey}/versions` | Full lineage of one rule |
| `GET` | `/api/audit` | Browse the immutable calculation log |
| `GET` | `/api/audit/{transactionId}` | One complete, self-contained record |
| `GET` | `/api/audit/{transactionId}/replay` | Recompute against historical vs current rules |
| `GET` | `/api/tax/report` | Compliance report, `format=json\|csv` |
| `GET` | `/api/transactions` | The seed fixtures |
| `GET` | `/api/health` | Liveness |

Requests and responses are snake_case at the boundary; the engine is camelCase
inside. Errors share one envelope: `{ "error": { "code", "message" } }`.

### Calculate

```bash
curl -s -X POST http://localhost:3000/api/tax/calculate \
  -H 'Content-Type: application/json' \
  -d '{
    "country_code": "BR",
    "product_category": "digital_services",
    "amount": 100.00,
    "customer_type": "individual",
    "transaction_date": "2026-06-01T12:00:00.000Z"
  }'
```

Returns the tax lines, a plain-English breakdown of every decision, the rule
version ids applied, and an `audit_url`. Amounts are integer **minor units**
(`amount_minor`) or decimal major units (`amount`); both are accepted, minor
units are authoritative.

**Idempotency.** The calculation is a pure function of (canonical inputs,
transaction date, ruleset version). Supplying a `transaction_id` — or an
`Idempotency-Key` header — makes the *write* idempotent: a retry returns the
stored record with `replayed: true` and never appends a second audit row.
Anonymous calls always append, because a compliance log must not drop events.

### Change a rate without a deploy

```bash
# Publish 21% over the top of Colombia's 19% IVA
curl -s -X POST http://localhost:3000/api/tax/rules \
  -H 'Content-Type: application/json' \
  -d '{
    "rule_key": "CO:*:IVA", "country_code": "CO", "product_category": "*",
    "tax_type": "IVA", "rate_bps": 2100, "valid_from": "2017-01-01",
    "change_note": "Reforma tributaria"
  }'

# New calculations use 21%; the record written a moment ago still says 19%
curl -s "http://localhost:3000/api/audit/{transactionId}"
curl -s "http://localhost:3000/api/tax/rules/CO%3A*%3AIVA/versions"
```

**The API presents CRUD. Storage is append-only:** every write creates a new
immutable version, and nothing is ever updated in place or removed. `PUT`
inserts vN+1 and stamps `supersededAt` on vN; `DELETE` closes a rule's validity
window rather than erasing it. SQLite triggers reject anything else, so the
guarantee is enforced by the database, not by convention.

### Audit and reporting

```bash
curl -s http://localhost:3000/api/audit/txn_br_0001
curl -s http://localhost:3000/api/audit/txn_br_0001/replay
curl -s "http://localhost:3000/api/tax/report?country=BR"
curl -s "http://localhost:3000/api/tax/report?country=BR&format=csv"
```

`GET /api/audit/:id` returns a single immutable record per transaction id;
recalculating a historical transaction is a read-only operation exposed at
`/replay`, so a transaction never accumulates conflicting audit rows.

Each record stores the inputs verbatim, the output, the ruleset version, the
applied rule version ids **and** a full snapshot of those rules. The duplication
is deliberate: the ids prove provenance against the rule table, the snapshot
makes the row verifiable by an auditor with no access to that table and no way
to know whether the rules have since changed.

## Tax rules

Five countries, 30 rule versions, every one carrying a `legalReference`. Full
catalogue and rationale: [`docs/04-TAX-RULES.md`](docs/04-TAX-RULES.md).

| Country | Currency | Standard | Notable |
|---|---|---|---|
| Brazil | BRL | ICMS 17%, **18% from 2026-01-01** on electronics | Federal PIS/COFINS + municipal ISS stack on digital services |
| Colombia | COP | IVA 19% | Clothing under COP 10,000 exempt (illustrative threshold) |
| Argentina | ARS | IVA 21% | IVA + PAIS 8% stacked on B2C digital until PAIS lapsed 2024-12-23; **reverse charge** for B2B |
| Chile | CLP | IVA 19% | **Zero-decimal currency** — rounding happens at whole pesos |
| Peru | PEN | IGV 18% | Digital-services rule valid only from 2024-12-01 |

Brazil applies ISS (municipal) plus PIS/COFINS-Importação (federal) to
cross-border digital services, and ICMS (state) to physical goods. ICMS and ISS
are mutually exclusive on software following STF ADI 1945 and ADI 5659 (2021),
so the engine never stacks them — the rule catalogue encodes that exclusivity as
an explicit 0% ICMS rule rather than relying on the caller to know it, and
rather than letting the country-wide ICMS wildcard fall through.

Rules resolve on **two independent time axes**: `validFrom`/`validTo` is
selected by the transaction date ("what was the law?"), `recordedAt`/
`supersededAt` by an as-of instant ("what did we believe?"). Collapsing them
into one `effective_date` column is the common shortcut, and it makes
"historical calculations must not change" impossible to satisfy.

## Performance

`npm run demo` benchmarks 1,000 calculations end to end — rule resolution,
calculation and the audit write:

```
p50 0.18 ms   p95 0.26 ms   p99 1.92 ms   ~4,700 calc/s single-threaded
```

Against a 50ms NFR that is roughly 25x of headroom at p99, **so no cache is
built**. A rules cache is cheap to add later — a process-local `Map` keyed on
`ruleset_version`, which is monotonic and therefore self-invalidating with no
TTL and no staleness window — but shipping it now would be complexity bought
against a measurement that says it is unnecessary.

At 100,000 calculations/day the audit trail grows ~36M rows/year. It is indexed
on `(input_country_code, transaction_date)`, which is the access path every
report uses; aggregation happens in SQL — including the per-tax-type split, via
`json_each` over the stored tax lines — rather than in a JavaScript loop, so
report cost scales with the result set and not with table size. Archival is
monthly partitioning by `transaction_date`.

## Architecture

```
app/api/**/route.ts   thin HTTP handlers
lib/
  calculator.ts       PURE tax math — no IO, no clock
  rules.ts            PURE rule resolution — no IO, no clock
  money.ts            minor units, basis points, rounding modes
  tax-service.ts      orchestration: the only layer mixing domain with IO
  rules-repo.ts       rule persistence (append-only)
  audit.ts            audit trail persistence (immutable)
  compliance.ts       report aggregation, in SQL
  db.ts  types.ts  http.ts  validation.ts
scripts/              schema.sql, seed-db.ts, demo.ts, test-tax.ts
data/                 tax-rules.json, transactions.json
```

Dependencies point inward only: `app → {tax-service, rules-repo, audit,
compliance} → {calculator, rules, money}`. The inner three import nothing from
the outer layers, which is why the accuracy suite runs without a database.

Money is never a float: amounts are integer minor units, rates are integer basis
points (1900 = 19.00%). CLP has exponent 0. Rounding mode is per country, read
from `countries.rounding_mode`.

Longer write-up: [`ARCHITECTURE.md`](ARCHITECTURE.md). Trade-offs and known
limits: [`NOTES.md`](NOTES.md).

## SQLite on Vercel — trade-off

| Choice | Why |
|---|---|
| `node:sqlite` (Node 22) | No native compile step; works locally and on Vercel Fluid/Node |
| Seeded `.db` built at deploy time | `prebuild` runs the seed, so the file cannot drift from the JSON |
| JSON → seed script | Keeps the reviewable fixtures in version control, not a binary |
| Opened read-write | The audit trail is a write path; Requirement 2 depends on it |

On Vercel the database is copied to the instance's `/tmp` on first use, so
writes are durable for the life of that instance but **not shared across
concurrent instances**. The seed replays all 57 fixture transactions through the
real calculator at build time, so every instance boots with a populated audit
trail: `GET /api/audit/txn_br_0001`, the compliance report and every rule
endpoint work on any instance, warm or cold.

The honest caveat: a calculation you POST and then immediately read back can
404 if the read lands on a different instance. Measured on the live deployment,
that affected 2 of 5 attempts immediately after a deploy while instances were
cold, and 0 of 5 once warm. Reads of *seeded* transactions never fail. Production
would point the repository layer at Turso/libSQL or Postgres and the window
disappears; nothing above `lib/db.ts` changes.

Naming that constraint is more honest than a deployment that quietly loses data.

## Disclaimer

Rates and exemptions are a documented working set for a take-home exercise, each
carrying a legal reference so it can be traced and corrected. They are not
production tax, legal or accounting advice.
