# Architectural decisions

This service is a small **Next.js App Router** application whose public surface
is a set of Route Handlers under `/api/*`, deployed as serverless functions on
**Vercel**. I chose that stack because the brief asks for a working, documented
API with a Vercel deliverable URL, and App Router handlers give typed TypeScript
endpoints with almost no ceremony.

**Structure.** Domain logic lives in `lib/` (`db`, `rules`, `calculator`,
`compliance`) and is deliberately free of HTTP concerns. The `app/api` layer
only validates input and maps domain errors to status codes. That split keeps
the calculation rules unit-testable with a plain Node script (`npm test`)
without spinning up a server.

**How tax rules are stored and versioned.** Editable fixtures live in
`data/tax-rules.json` and `data/transactions.json`. `npm run db:seed` loads them
into a SQLite database (`data/yuno-tax.db`) with tables `tax_rules` and
`transactions`. Rules are an append-only list keyed by stable `id` plus
monotonic `version`, each with `effective_from` / `effective_to` windows.
Resolution filters in SQL by country, category, and date, then prefers a
regional match over a country-wide rule and the highest version. The Mexico
digital-services rule ships as v1 and v2 with adjacent date windows so reports
can show which version applied.

**Why SQLite (and why `node:sqlite`).** Under a ~2-hour constraint I wanted a
real SQL store without provisioning Postgres or Turso. Node 22’s built-in
`node:sqlite` avoids native addons (`better-sqlite3`) that complicate Vercel
builds. The DB is opened **read-only** at runtime and traced into serverless
bundles via `outputFileTracingIncludes`. JSON remains the seed source so
fixtures stay diffable in git; APIs never import JSON directly.

**Trade-offs.** Vercel’s filesystem is ephemeral, so this demo does not accept
durable writes through the API — reseed and redeploy to change data. US tax is
modelled as state base rates only (no district add-ons); clothing/food
exemptions are flat categories rather than amount thresholds. Rounding is
commercial half-up on integer minor units. With more time I would move to
Turso/libSQL for multi-instance writes, add threshold-aware exemptions,
OpenAPI, and a persisted calculation ledger keyed by `rule_id@version`.
