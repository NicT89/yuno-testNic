# 00 — Context and locked decisions

Read this first. Every other doc in `docs/` assumes it.

## What we are building

A backend tax calculation and compliance engine for **TiendaMax**, a
cross-border e-commerce platform, integrated between checkout and Yuno's
payment orchestration layer. Graded take-home, hard 2-hour budget, scored
against a published 100-point rubric.

**There is no UI requirement and no UI score.** Do not spend time on
`app/page.tsx`. Everything is judged through the HTTP API, the source, the
seed data, and the docs.

## Scoring rubric — this is the real spec

| Criterion | Pts | Owning files (this repo) |
|---|---|---|
| Tax calculation accuracy + edge cases | **25** | `lib/calculator.ts`, `lib/rules.ts`, `lib/money.ts` |
| API design & usability | **15** | `app/api/**/route.ts`, `lib/http.ts`, `README.md` |
| Audit trail + compliance reporting | **20** | `lib/audit.ts`, `lib/compliance.ts`, `app/api/audit/**`, `app/api/tax/report/route.ts` |
| Tax rule management + versioning | **20** | `lib/rules.ts`, `scripts/schema.sql`, `app/api/tax/rules/route.ts` |
| Code quality & architecture | **10** | layer separation, naming, business-logic comments |
| Documentation & deliverables | **10** | `README.md`, `ARCHITECTURE.md`, `data/*.json` |

**Stretch goals are worth ZERO points.** Only build the ones that bleed into
scored criteria: multi-tax stacking (named inside Requirement 1 for Brazil),
currency rounding (determines whether tax amounts are *correct*), and
customer-type handling (cheap, adds an accuracy dimension). Skip caching.

## Locked decisions (do not relitigate)

1. **Countries: BR, CO, AR, CL, PE.** Not Mexico, not the US. The brief names
   five and the reviewer will test those five.
2. **Money is integer minor units. Rates are integer basis points** (1900 =
   19.00%). No floating-point rates like `0.19`. CLP has exponent 0.
3. **Tax math lives in pure functions with zero IO.** `lib/calculator.ts` and
   `lib/rules.ts` must not import `node:sqlite` or anything from `app/`.
4. **SQLite, read-write, not read-only.** The audit trail is a write path and
   Requirement 2 is 20 points. See `docs/01-GAP-ANALYSIS.md` item G2.
5. **Rules are append-only and bitemporal.** Two independent time axes. See
   `docs/03-SCHEMA.sql`.
6. **Audit rows store both rule version ids and a full rule snapshot.**
   Duplication is deliberate.
7. **No applicable rule returns 422, never a silent 0%.**
8. **No Docker, no auth, no caching layer, no UI work.**

## Cut list, in order, if we run out of time

Cut from the bottom up. Never cut anything above the line.

```
  KEEP  seed data + README + generated compliance report   (10 pts, ~15 min)
  KEEP  audit persistence + GET by transaction id          (20 pts)
  KEEP  bitemporal rule versioning + POST /rules           (20 pts)
  KEEP  five correct countries + edge cases                (25 pts)
--------------------------- cut line ---------------------------
  CUT 4  B2B reverse charge
  CUT 3  runtime rule-write endpoint (fall back to seed-file edits)
  CUT 2  multi-tax stacking beyond Brazil
  CUT 1  tax-inclusive decompose endpoint
```

## Reference implementation

`docs/reference/` holds a complete, tested, working Express + SQLite build of
this exact brief (19 passing unit tests, 29 rule versions, 56 fixture
transactions). It is **reference only** — do not deploy it. Port the ideas into
this Next.js repo. File-by-file mapping is in `docs/02-BUILD-PLAN.md`.
