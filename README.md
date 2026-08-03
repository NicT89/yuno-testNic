# Yuno Tax Calculation Service

API-first tax calculation service with **versioned tax rules** stored in
**SQLite**, deterministic inclusive/exclusive math, sample transaction fixtures,
and a country-level **compliance report**.

Deployed as a Next.js App Router project on Vercel (Node.js 22+ for built-in
`node:sqlite`).

## Quick start

```bash
npm install
npm run db:seed   # builds data/yuno-tax.db from JSON fixtures (also runs via pretest/prebuild/predev)
npm test          # business-logic assertions + sample MX report
npm run dev       # http://localhost:3000
```

Requires **Node.js 22+** (`node:sqlite`).

Open [http://localhost:3000](http://localhost:3000) for a short endpoint index,
or call the APIs directly.

## Project structure

```
app/
  api/
    health/route.ts           # liveness
    tax/calculate/route.ts    # POST calculate
    tax/rules/route.ts        # GET rules / version history
    tax/report/route.ts       # GET compliance report (json|text|csv)
    transactions/route.ts     # GET sample transactions
  page.tsx                    # lightweight docs UI
data/
  tax-rules.json              # editable seed source for rules
  transactions.json           # editable seed source for transactions
  yuno-tax.db                 # generated SQLite DB (runtime source of truth)
lib/
  db.ts                       # SQLite connection (read-only)
  types.ts                    # domain types
  rules.ts                    # rule resolution against SQLite
  calculator.ts               # tax math + business rules
  compliance.ts               # aggregation + text/csv formatting
  http.ts                     # shared API helpers
scripts/
  seed-db.ts                  # JSON → SQLite seeder
  test-tax.ts                 # assertion suite
ARCHITECTURE.md               # 200–400 word design write-up
NOTES.md                      # trade-offs & future improvements
```

## Storage model

| Layer | Role |
|-------|------|
| `data/*.json` | Human-editable seed fixtures (source for demos/tests) |
| `npm run db:seed` | Creates `data/yuno-tax.db` with `tax_rules` + `transactions` |
| Runtime APIs | Read **only** from SQLite via `lib/db.ts` |

## Amounts

All monetary values are **integer minor units** (cents) to avoid floating-point
drift.

| Display   | API `amount` |
|-----------|--------------|
| MXN 1,000.00 | `100000`  |
| USD 200.00   | `20000`   |

## API reference

Base URL locally: `http://localhost:3000`  
Base URL in production: your Vercel deploy URL

### `GET /api/health`

```bash
curl -s http://localhost:3000/api/health
```

### `POST /api/tax/calculate`

Calculate tax for one line item. Resolves the rule version effective on
`transactionDate`.

```bash
curl -s -X POST http://localhost:3000/api/tax/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "country": "MX",
    "category": "standard",
    "amount": 100000,
    "amountMode": "exclusive",
    "currency": "MXN",
    "transactionDate": "2025-03-15"
  }'
```

Example response:

```json
{
  "country": "MX",
  "region": null,
  "category": "standard",
  "currency": "MXN",
  "amountMode": "exclusive",
  "netAmount": 100000,
  "taxAmount": 16000,
  "grossAmount": 116000,
  "rate": 0.16,
  "taxName": "IVA",
  "appliedRule": {
    "id": "mx-iva-standard",
    "version": 1,
    "effectiveFrom": "2010-01-01",
    "effectiveTo": null
  },
  "exempt": false
}
```

**Tax-inclusive example** (peel IVA out of gross):

```bash
curl -s -X POST http://localhost:3000/api/tax/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "country": "MX",
    "category": "digital",
    "amount": 11600,
    "amountMode": "inclusive",
    "currency": "MXN",
    "transactionDate": "2025-06-01"
  }'
```

**US regional example**:

```bash
curl -s -X POST http://localhost:3000/api/tax/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "region": "CA",
    "category": "standard",
    "amount": 20000,
    "amountMode": "exclusive",
    "currency": "USD",
    "transactionDate": "2025-02-01"
  }'
```

### `GET /api/tax/rules`

```bash
# All Mexico rules (all versions)
curl -s "http://localhost:3000/api/tax/rules?country=MX"

# Version history for one rule id
curl -s "http://localhost:3000/api/tax/rules?id=mx-iva-digital"
```

### `GET /api/tax/report`

Aggregated compliance report for at least one country (Mexico fixtures included).

```bash
# JSON (default)
curl -s "http://localhost:3000/api/tax/report?country=MX"

# Human-readable text
curl -s "http://localhost:3000/api/tax/report?country=MX&format=text"

# CSV of taxed lines
curl -s "http://localhost:3000/api/tax/report?country=MX&format=csv"

# Optional period filter
curl -s "http://localhost:3000/api/tax/report?country=MX&from=2025-01-01&to=2025-12-31"
```

### `GET /api/transactions`

```bash
curl -s "http://localhost:3000/api/transactions?country=MX"
```

## Test data

| File | Purpose |
|------|---------|
| [`data/tax-rules.json`](data/tax-rules.json) | Versioned rules for MX, US (CA/NY), CO — seed input |
| [`data/transactions.json`](data/transactions.json) | 13 sample transactions — seed input |
| `data/yuno-tax.db` | SQLite DB generated by `npm run db:seed` |

## Tax calculation rules (summary)

1. Resolve rule by `country` + `category` + effective date; prefer regional over country-wide.
2. Prefer higher `version` if overlapping candidates remain.
3. **Exclusive**: `tax = round_half_up(net × rate)`, `gross = net + tax`.
4. **Inclusive**: `net = round_half_up(gross / (1 + rate))`, `tax = gross − net` (residual avoids 1¢ drift).
5. Rate `0` → exempt/zero-rated; tax is `0`.
6. Missing rule → HTTP `422` (never silently assume 0%).

## Deliverables

| Item | Location |
|------|----------|
| Working API | this repo + Vercel URL |
| Setup + example calls | this README |
| Architecture (200–400 words) | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Notes / trade-offs | [`NOTES.md`](NOTES.md) |
| Compliance report | `GET /api/tax/report?country=MX` |

## Disclaimer

Rates and exemptions are **illustrative simplifications** for a take-home
exercise. Not production tax, legal, or accounting advice.
