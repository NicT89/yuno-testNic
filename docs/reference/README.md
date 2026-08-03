# TiendaMax Multi-Country Tax Compliance Engine

A backend tax calculation and compliance service for LATAM cross-border commerce.
Sits between a checkout system and a payment orchestration layer, returns the
correct tax for every transaction, and keeps an immutable audit trail that a tax
authority could read.

Supports **Brazil, Colombia, Argentina, Chile and Peru** across 9 product
categories, with multi-tax stacking, B2B reverse charge, per-currency rounding,
and date-versioned tax rules.

---

## Quick start

```bash
npm install
npm run seed     # 29 rule versions + 56 fixture transactions
npm start        # http://localhost:3000
```

Or see everything at once:

```bash
npm run demo     # ~20 seconds, proves all three core requirements
npm test         # 19 unit tests on the pure calculation core
```

`npm run demo` seeds the database, prints a 25-combination calculation matrix,
walks the edge cases, demonstrates date-based rule selection, publishes a new
tax rate and shows the historical audit record is unchanged, then writes
compliance reports for all five countries to `./out/`.

No Docker, no external services, no credentials. SQLite file, two commands.

---

## The three core requirements, and where they live

| Requirement | Implementation | Proof |
|---|---|---|
| 1. Tax calculation API | `src/domain/calculator.ts` (pure), `POST /api/v1/tax/calculate` | `npm test`, demo step 2-4 |
| 2. Compliance audit trail | `src/db/auditRepo.ts`, `GET /api/v1/audit/:id`, `GET /api/v1/reports/compliance` | demo step 7, `out/compliance-report-*.json` |
| 3. Tax rule management | `src/db/rulesRepo.ts` (append-only, bitemporal), `POST /api/v1/rules` | demo step 5-6 |

---

## API

### `POST /api/v1/tax/calculate`

```bash
curl -s -X POST localhost:3000/api/v1/tax/calculate \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 199.99,
    "country_code": "BR",
    "product_category": "digital_services",
    "customer_type": "individual",
    "transaction_date": "2026-06-01T00:00:00Z"
  }'
```

```jsonc
{
  "transaction_id": "txn_1e14bfa1-...",
  "status": "calculated",
  "currency": "BRL",
  "baseAmountMinor": 19999,      // integers are authoritative
  "taxAmountMinor": 4400,
  "totalAmountMinor": 24399,
  "amounts": { "base": "199.99", "tax": "44.00", "total": "243.99" },
  "effectiveRatePercent": "22.00%",
  "taxLines": [
    { "ruleVersionId": "BR:DIGITAL_SERVICES:ICMS@v1", "taxType": "ICMS",
      "taxScope": "state", "ratePercent": "17.00%", "taxAmount": "34.00",
      "explanation": "ICMS at 17.00% for digital_services in BR" },
    { "ruleVersionId": "BR:DIGITAL_SERVICES:ISS@v1", "taxType": "ISS",
      "taxScope": "municipal", "ratePercent": "5.00%", "taxAmount": "10.00",
      "explanation": "ISS at 5.00% ... (LC 116/2003)" }
  ],
  "breakdown": {
    "summary": "BR / digital_services / individual: ICMS 17.00% + ISS 5.00% = 22.00% effective",
    "steps": [
      "Gross amount 199.99 BRL (no discount applied)",
      "ICMS (BR:DIGITAL_SERVICES:ICMS@v1, state): 17.00% of 199.99 = 34.00",
      "ISS (BR:DIGITAL_SERVICES:ISS@v1, municipal): 5.00% of 199.99 = 10.00",
      "Total tax 44.00; total payable 243.99 BRL."
    ],
    "appliedRuleVersionIds": ["BR:DIGITAL_SERVICES:ICMS@v1", "BR:DIGITAL_SERVICES:ISS@v1"]
  },
  "audit_url": "/api/v1/audit/txn_1e14bfa1-..."
}
```

Accepts `amount` (major units) **or** `amount_minor` (integer). Optional:
`discount`, `currency`, `price_includes_tax`, `transaction_id`, and an
`Idempotency-Key` header.

### Full endpoint list

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/tax/calculate` | Calculate tax for a transaction |
| POST | `/api/v1/tax/decompose` | Split a tax-inclusive price into base + tax |
| GET | `/api/v1/audit/:transactionId` | One audit record, fully self-contained |
| GET | `/api/v1/audit?country=&from=&to=&limit=` | Search the audit trail |
| GET | `/api/v1/audit/:transactionId/replay` | Re-run a historical calculation |
| GET | `/api/v1/rules?country=&on_date=&as_of=&include_superseded=` | List rules |
| GET | `/api/v1/rules/:ruleKey/versions` | Full version lineage of one rule |
| POST | `/api/v1/rules` | Publish a new rule version |
| GET | `/api/v1/reports/compliance?country=&from=&to=&format=json\|csv` | Compliance report |
| GET | `/health` | Liveness |

### Worked examples

```bash
# Date-based rule selection: same inputs, different date, different rate
curl -s -X POST localhost:3000/api/v1/tax/calculate -H 'Content-Type: application/json' \
  -d '{"amount":1000,"country_code":"BR","product_category":"electronics","transaction_date":"2025-12-31T00:00:00Z"}' \
  | grep -o '"ruleVersionId":"[^"]*"'      # -> BR:ELECTRONICS:ICMS@v1  (17%)

curl -s -X POST localhost:3000/api/v1/tax/calculate -H 'Content-Type: application/json' \
  -d '{"amount":1000,"country_code":"BR","product_category":"electronics","transaction_date":"2026-01-02T00:00:00Z"}' \
  | grep -o '"ruleVersionId":"[^"]*"'      # -> BR:ELECTRONICS:ICMS@v2  (18%)

# Change a rate, then confirm history is untouched
curl -s -X POST localhost:3000/api/v1/rules -H 'Content-Type: application/json' -d '{
  "rule_key":"CL:*:IVA","country_code":"CL","product_category":"*",
  "tax_type":"IVA","rate_bps":2100,"valid_from":"2017-01-01",
  "change_note":"Chile raises IVA to 21%"}'

curl -s localhost:3000/api/v1/rules/CL:*:IVA/versions          # v1 @19%, v2 @21%
curl -s localhost:3000/api/v1/audit/txn_cl_0001                # still 19%, unchanged
curl -s localhost:3000/api/v1/audit/txn_cl_0001/replay         # historical vs current, side by side

# Compliance report
curl -s "localhost:3000/api/v1/reports/compliance?country=BR&from=2024-01-01&to=2027-01-01"
curl -s "localhost:3000/api/v1/reports/compliance?country=BR&from=2024-01-01&to=2027-01-01&format=csv"

# B2B reverse charge (Argentina): same amount, zero collected
curl -s -X POST localhost:3000/api/v1/tax/calculate -H 'Content-Type: application/json' \
  -d '{"amount":10000,"country_code":"AR","product_category":"digital_services","customer_type":"business"}'
```

---

## Tax rules implemented

29 rule versions across 5 countries. Rates reflect LATAM digital-commerce
practice for 2025-2026 and each carries a `legal_reference` for the auditor.

| Country | Standard | Reduced | Exempt | Notes |
|---|---|---|---|---|
| Brazil (BRL) | ICMS 17% (18% from 2026-01-01 on electronics) | food 7%, medicine 12% | books, education | **Stacks** ICMS + municipal ISS 5% on digital services |
| Colombia (COP) | IVA 19% | food 5% | books, medicine | Clothing under COP 100,000 is exempt (threshold) |
| Argentina (ARS) | IVA 21% | food 10.5%, medicine 10.5% | books | **Stacks** IVA + PAIS 8% on B2C digital; **reverse charge** for B2B |
| Chile (CLP) | IVA 19% flat | none | none | Zero-decimal currency; Chile taxes books too |
| Peru (PEN) | IGV 18% | none | food, books, medicine | Digital-services rule only valid from 2024-12-01 |

Test data: `src/seed/rules.ts` (29 rules) and `src/seed/transactions.ts`
(56 transactions, each annotated with what it exercises). Load with `npm run seed`.

---

## Design decisions worth knowing before reading the code

### Money never touches a float

All arithmetic is in **integer minor units**, all rates in **basis points**
(1900 = 19.00%). `19% of COP 1,234,567` in floating point drifts by fractions of
a cent; across 15,000 transactions a day that drift is exactly what got TiendaMax
flagged. `CLP` has exponent 0, so Chilean amounts round to whole pesos, which no
float-based implementation gets right by accident.

### Rules are append-only and bitemporal

`tax_rule_versions` has **two independent time axes**:

- **valid time** (`valid_from` / `valid_to`): when the rule was the law. Selected by the **transaction date**.
- **system time** (`recorded_at` / `superseded_at`): when *we* believed it. Selected by an **as-of instant**.

"Update the Brazilian rate" inserts a new row and stamps `superseded_at` on the
old one. Nothing an audit record points at ever changes. Collapsing these into a
single `effective_date` column is the obvious shortcut, and it makes
"historical calculations remain unchanged" impossible to guarantee.

Database triggers enforce this: `UPDATE` and `DELETE` on the audit table are
rejected by SQLite itself, not merely by application convention. The demo proves
it by trying and failing.

### Audit records are self-contained

Every audit row stores both the rule version **ids** (provenance) and a full
**JSON snapshot** of the rules used (self-containment). Denormalisation is
deliberate: an auditor should be able to read one row and reconstruct the
calculation without joining anything. Same reason Stripe snapshots line items
onto an invoice.

### Idempotency, stated precisely

The calculation is a pure function of `(canonical inputs, transaction_date,
ruleset_version)`, so identical inputs always produce identical output, and each
audit row carries a `calculation_fingerprint` (SHA-256) proving it.

Every request still writes its own audit row, including failures. A compliance
log that silently drops events is a broken compliance log. If a caller wants
true request de-duplication, they send an `Idempotency-Key` header and get the
stored record back, the way a payments API would.

### No rule on file is an error, not 0%

If no rule matches, the service returns `422 NO_APPLICABLE_RULE` rather than
assuming zero. Silently returning 0% is precisely how a merchant under-remits.

---

## Project structure

```
src/
  domain/          PURE. No IO, no clock, no database.
    money.ts         minor units, basis points, rounding modes
    types.ts         domain types
    ruleResolver.ts  bitemporal + specificity rule selection
    calculator.ts    the tax engine
  db/              All SQL lives here.
    schema.sql       schema + append-only triggers, heavily commented
    rulesRepo.ts     rule versioning
    auditRepo.ts     audit trail + compliance reporting (aggregation in SQL)
  service/
    taxService.ts    the only layer that mixes domain with IO
  api/
    server.ts        express app + single error contract
    validation.ts    zod request schemas
    routes/          calculations, audit, rules, reports
  seed/            29 rules, 56 annotated transactions
  scripts/demo.ts  the 20-second walkthrough
tests/             table-driven accuracy + versioning tests
```

The dependency arrow only ever points inward: `api -> service -> db -> domain`.
`domain/` imports nothing from the other layers, which is why the whole tax
engine is testable without a server or a database running.

---

## Trade-offs made under a 2-hour budget

- **SQLite, not Postgres/Supabase.** Zero setup for the reviewer and no
  credentials to share. The repository layer is the only thing that knows SQL,
  so swapping to Postgres is one file. Note that SQLite is not viable on
  serverless (read-only filesystem), so a Vercel deployment would use Postgres
  or Turso; nothing above the repo layer changes.
- **No auth.** Out of scope for the brief. In production this sits behind the
  orchestration layer's service mesh.
- **No caching layer.** At 15,000 transactions/day the rule table is a few dozen
  rows and SQLite reads are sub-millisecond. Caching here would be complexity
  without a measurable win, and rule-update propagation is a real cost. The
  right place for it is a process-local cache keyed on `ruleset_version`, which
  self-invalidates because the version is monotonic.
- **Rates are a defensible working set, not legal advice.** They are sourced
  from published statutory rates and each rule carries a citation, but the
  design goal is that finance can correct any of them through the API without a
  deploy and without rewriting history.
- **Compliance report aggregates in SQL**, not in application memory, because a
  monthly filing over 450,000 rows cannot be assembled in a Node process.

## What I would do next

Rule effective-date scheduling (publish a future rate change ahead of time,
already supported by the schema but not exposed on the write endpoint),
per-country rounding-mode configuration wired through from the `countries`
table, OpenAPI generation from the existing Zod schemas, and a `GET
/api/v1/rules/diff?from=&to=` endpoint so finance can review a rate change
before it goes live.
