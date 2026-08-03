# Project notes

## What this is

A tax calculation and compliance engine for cross-border LATAM commerce
(BR/CO/AR/CL/PE), built against a 100-point rubric under a hard time budget.
`README.md` is the entry point; `ARCHITECTURE.md` is the design write-up.

## Trade-offs taken deliberately

| Choice | Why | What it costs |
|---|---|---|
| Bitemporal rules (two time axes) | The brief requires both "use the rate in force on the transaction date" and "old calculations keep their original rule version". One `effective_date` column cannot satisfy the second. | An extra pair of columns and a resolver that has to filter on both. |
| Append-only storage behind CRUD verbs | An integrator expects `PUT`/`DELETE`; a compliance store must never lose history. `PUT` appends vN+1, `DELETE` closes the validity window. | A "delete" that leaves rows behind, which is the point. |
| Both rule ids **and** a full rule snapshot on every audit row | The ids prove provenance; the snapshot lets an auditor verify the arithmetic without access to the rule table and without trusting that rules have not changed since. | Deliberate duplication, ~1KB per row. |
| Aggregation in SQL, including `json_each` over stored tax lines | A monthly filing for 450k transactions cannot be assembled in application memory. | Slightly denser queries in `lib/compliance.ts`. |
| No rules cache | Measured p99 is 1.9ms against a 50ms NFR — 25x headroom. | Nothing yet. The `ruleset_version`-keyed design is documented for when it is needed. |
| `node:sqlite` (Node 22 built-in) | No native compile step; works locally and on Vercel with zero dependencies added. | Experimental-API warning on stderr. |

## Known limitations

1. **Serverless write durability.** On Vercel the database is copied to the
   instance's `/tmp`, so a just-written audit row is not visible to a request
   served by a different instance. The seeded trail is present on every
   instance, so reads of seeded transactions and all reporting always work.
   Production fix: point `lib/db.ts` at Turso/libSQL or Postgres.
2. **Rates are a documented working set, not legal advice.** Every rule carries
   a `legalReference`, and rules that are illustrative rather than statutory say
   so explicitly in their `notes` — the Colombian clothing threshold and the
   2026 Brazilian ICMS revision are both labelled as invented.
3. **No authentication.** Out of scope for the exercise; the rule-write
   endpoints would need it before any real deployment.
4. **Single-currency per transaction.** No FX conversion; each country prices in
   its own currency.

## What I would do next

1. Durable shared storage (Turso/libSQL), which closes limitation 1 without
   changing anything above the repository layer.
2. Auth plus an approval workflow on rule writes — a rate change is a
   financially material action and currently anyone can publish one.
3. OpenAPI spec and contract tests running against the deployed URL in CI.
4. Structured logs keyed on `ruleVersionId` and a metric on the 422 rate: a
   spike means the catalogue has a gap in a market that is live.
