# Architectural decisions

*(the 200-400 word write-up called for in the deliverables)*

**Structure.** The service is a hexagon with the tax math at the centre.
`src/domain/` is pure: it has no imports from the database, the HTTP layer, or
the system clock, and it holds every rule about money, rounding, rule
resolution, and stacking. `src/db/` owns all SQL. `src/service/` is the only
place the two meet. `src/api/` is thin Express handlers plus Zod validation.
The dependency arrow points inward only, which is why 19 accuracy tests run in
15 milliseconds with no server and no database.

**How tax rules are stored and versioned.** `tax_rule_versions` is append-only
and bitemporal, with two independent time axes. *Valid time*
(`valid_from`/`valid_to`) answers "when was this rate the law?" and is selected
by the transaction date. *System time* (`recorded_at`/`superseded_at`) answers
"when did we believe it?" and is selected by an as-of instant. Editing a rate
inserts a new version and stamps `superseded_at` on the previous row; nothing an
existing audit record points at is ever mutated. Collapsing both axes into a
single `effective_date` column is the obvious shortcut and it makes the
requirement that historical calculations remain unchanged impossible to
guarantee. Each audit row stores both the applied rule version ids and a full
JSON snapshot of those rules, so a record is self-contained for an auditor and
exactly replayable by the engine. SQLite triggers reject `UPDATE` and `DELETE`
on the audit table, so immutability is enforced by the database rather than by
convention.

**Money.** All arithmetic is in integer minor units with rates in basis points.
Floating-point money drifts, and per-currency exponents matter: CLP has no minor
unit, so Chilean totals must round to whole pesos.

**Trade-offs for the two-hour budget.** SQLite over Postgres, because the
reviewer should need two commands and no credentials; the repository layer is
the only code that knows SQL, so the swap is one file. No auth, no caching (the
rule table is dozens of rows, and `ruleset_version` is a ready-made cache key
when it is needed), and no container. Rates are a documented, cited working set
rather than legal advice: the design goal is that finance can correct any of
them through the API without a deploy and without rewriting history.
