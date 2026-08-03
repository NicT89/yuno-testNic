# Project notes

## Context

Take-home style tax calculation service demonstrating:

- Documented HTTP API (calculate, rules, compliance report, sample transactions)
- Clear separation between rule resolution, tax math, and reporting
- Versioned rules with effective dating, persisted in **SQLite**
- At least one country compliance report (Mexico; also US and Colombia fixtures)

## SQLite on Vercel — trade-off

| Choice | Why |
|--------|-----|
| `node:sqlite` (Node 22) | No native compile step; works locally and on Vercel Fluid/Node |
| Seeded `.db` file shipped with deploy | Simple demo; APIs are read-mostly |
| JSON → seed script | Keeps fixtures reviewable in PRs |
| Read-only open | Matches serverless reality (no durable local writes) |

**Limitation:** concurrent serverless instances cannot share mutable local SQLite
state. For production writes, use Turso/libSQL (or Postgres) and keep the same
schema.

## What I would improve with more time

1. **Durable remote SQLite (Turso)** or Postgres for multi-region writes and admin rule publishing.
2. **Persisted ledger** of calculated results keyed by `rule_id@version`.
3. **Richer US sales tax** — district rates, nexus, clothing dollar thresholds.
4. **OpenAPI + contract tests** against the deployed Vercel URL in CI.
5. **Observability** — structured logs with `ruleId@version`, metrics for `422` rates.

## Known simplifications

- Rates are illustrative, not sourced from a live tax engine.
- No authentication on the API (public demo).
- No runtime write APIs — change JSON and reseed/redeploy.
- Colombia / Mexico rules omit local surtaxes and withholding.
