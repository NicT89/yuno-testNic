# Submission notes (paste into the form)

Tax rules are stored append-only and bitemporally: `validFrom`/`validTo` select the rate that was law on the transaction date, while `recordedAt`/`supersededAt` select what the system believed at calculation time, so publishing a new rate never rewrites a historical calculation. All money is integer minor units and all rates are integer basis points, with per-currency exponents (CLP has none), so charged tax amounts are never produced by floating-point arithmetic. Every calculation — including failures — writes one immutable audit row carrying both the applied rule version ids and a full rules snapshot, and compliance reports aggregate that trail in SQL rather than in application memory. The fastest way in is `npm install && npm run demo`, which seeds the database and walks the whole engine in about twenty seconds: a calculation matrix across all five countries, the edge cases, an idempotent retry, two date-based rule selections, and a live rate change that leaves the historical record byte-identical. The API is also deployed at https://yuno-test-nic.vercel.app. On Vercel the SQLite file is copied per instance, so a just-written audit row is not shared across concurrent instances; the seed replays all 57 fixtures at build time so reporting and every seeded transaction resolve on any instance, and Turso or Postgres behind `lib/db.ts` closes that gap in production without changing anything above it.

## URLs submitted

| Field | Value |
|---|---|
| **Deliverable URL** | https://github.com/NicT89/yuno-testNic |
| **GitHub Repository URL** | https://github.com/NicT89/yuno-testNic |

**The repository is the front door.** The deployed app was *not* submitted as
the Deliverable URL, so a reviewer arrives at the README and will only find the
live API if the README tells them. It does: the **Try it live** section sits
above the fold with the URL and three copy-paste `curl` commands.

Live deployment (linked from the README, not submitted as a URL field):

| Alias | Status |
|---|---|
| https://yuno-test-nic.vercel.app | smoke 8/8 |
| https://yuno-tax.vercel.app | smoke 8/8, same deployment |

## Before you consider it submitted

- Run `./verify/smoke-test.sh https://yuno-test-nic.vercel.app`. Check 3 is the
  F-014 gate. If it fails once, re-run: a cold instance can 404 on
  read-your-own-write, which is documented and expected.
- **Warm the deployment** with one request first. A reviewer whose very first
  action is a POST-then-GET can otherwise hit that cold-start 404, and it is the
  only bad first impression available.
- Confirm the repo is public and that GitHub renders the README's Try it live
  section correctly.
