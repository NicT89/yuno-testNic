# Submission notes (paste into the form)

Tax rules are stored append-only and bitemporally: `validFrom`/`validTo` select the rate that was law on the transaction date, while `recordedAt`/`supersededAt` select what the system believed at calculation time, so publishing a new rate never rewrites a historical calculation. All money is integer minor units and all rates are integer basis points, with per-currency exponents (CLP has none), so charged tax amounts are never produced by floating-point arithmetic. Every calculation — including failures — writes one immutable audit row with both applied rule version ids and a full rules snapshot, and compliance reports aggregate that trail in SQL. Given the two-hour constraint and Vercel’s ephemeral filesystem, the reviewable path is a local `npm run db:seed && npm run dev` (or `npm run demo` once landed); the deployed instance copies SQLite to `/tmp` so audit writes work per warm instance, with Turso/Postgres as the production swap behind `lib/db.ts`.

## URLs to paste

| Field | Value |
|---|---|
| **Deliverable URL** | https://yuno-tax.vercel.app |
| **GitHub Repository URL** | https://github.com/NicT89/yuno-testNic |

Confirm the Deliverable URL still serves the latest deploy after Claude Code’s pending commits, and run `./verify/smoke-test.sh https://yuno-tax.vercel.app` before submitting — check 3 is the F-014 gate.
