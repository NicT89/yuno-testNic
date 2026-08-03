# Architectural decisions

**Structure.** Three layers, dependencies pointing inward only: `app/api/**`
(thin HTTP handlers) → `lib/{tax-service,rules-repo,audit,compliance}` (the IO
layer) → `lib/{calculator,rules,money}` (pure). The inner three import no
database, no HTTP and no clock — time is passed in as an argument. That is why
the accuracy suite runs without a server and why any historical calculation can
be replayed exactly.

**How rules are stored and versioned.** `tax_rule_versions` is append-only and
**bitemporal**. `validFrom`/`validTo` records when a rate was the law and is
selected by the transaction date. `recordedAt`/`supersededAt` records when *we*
believed it and is selected by an as-of instant. Both axes are required: the
first answers "charge the rate in force when the sale happened", the second
answers "a calculation from last month must not change because we corrected a
rate today". Collapsing them into one `effective_date` column — the obvious
shortcut — makes the second unsatisfiable.

Changing a rate inserts a new version and stamps `supersededAt` on the previous
one. The API presents CRUD verbs, but `PUT` appends vN+1 and `DELETE` closes a
validity window — nothing is updated in place or removed, and SQLite triggers
reject any other mutation, so the guarantee is enforced by the database rather
than by convention.

Resolution selects one winning rule **per tax type**, ranked by specificity: an
exact category beats the country wildcard, an exact customer type beats the
wildcard. That is what makes multi-tax stacking work, and it is why Brazilian
digital services carry an explicit 0% ICMS rule — the STF exclusivity is encoded
in the catalogue instead of depending on the absence of a row.

**Audit trail.** Every request writes exactly one row, including failures,
storing the inputs verbatim, the output, the applied rule version ids **and** a
full snapshot of those rules. The duplication is deliberate: the ids prove
provenance against the rule table, the snapshot lets an auditor verify the
arithmetic without access to it.

**Money** is integer minor units and integer basis points throughout; CLP has
exponent 0 and rounding mode is per country.

**Trade-offs.** `node:sqlite` gives a real SQL store with no native addon. On
Vercel the database is copied to the instance's `/tmp`,
so writes are durable per instance but not shared; the seed replays all 57
fixtures at build time so every instance boots with a populated audit trail.
Production swaps in Turso or Postgres behind `lib/db.ts` — nothing above that
file changes.
