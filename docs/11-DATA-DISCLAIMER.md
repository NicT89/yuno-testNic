# 11 — Data disclaimer: what is real and what is illustrative

Resolves F-023, F-024, F-025 by labelling rather than by research.

## The brief permits invented rates

> "Support the following countries with realistic tax rules (**research or
> invent plausible rates**)"

And the rubric measures "correct tax amounts returned for various
country/category combinations", which is about the engine applying its own
rules correctly, not statutory fidelity. Chasing real statutes buys no points.

## The one thing that is not optional

An invented rate labelled as invented is fine. A `legalReference` citing a real
law that does not say what we claim reads as a false statement rather than a
placeholder. That is the only exposure, and labelling closes it.

## The frame to use everywhere

**The rates are illustrative. The tax mechanics they model are real.**

Do not blanket-declare the whole catalogue fictional. Several structural
decisions are researched and correct, and they are the strongest domain signal
in the submission:

- ICMS and ISS are constitutionally mutually exclusive on software
  (STF ADI 1945/MT and ADI 5659/MG, 2021). The catalogue encodes that.
- CLP has no minor unit, so Chilean totals must round to whole pesos.
- Reduced rates, exemptions, thresholds, reverse charge and multi-level
  stacking are all real mechanics that a tax engine must support.

## Where the disclaimer goes — four places

### 1. `README.md`, its own section near the top, after the business framing

```markdown
## About the tax data

The tax rates, thresholds and effective dates in this repository are
**illustrative and were invented or approximated for demonstration purposes**.
They are not tax advice and should not be used to file anything. The brief
explicitly permits invented rates, and the engineering problem here is rule
resolution, versioning and auditability rather than statutory research.

What *is* modelled faithfully is the mechanics: standard, reduced, exempt,
zero-rated and reverse-charge treatments; multi-level stacking across federal,
state and municipal authorities; minimum thresholds; per-currency rounding
(CLP has no minor unit); and effective-dated rule versions.

One structural rule is researched rather than invented, because getting it
wrong would be a real error rather than a placeholder: ICMS and ISS are
mutually exclusive on software in Brazil following STF ADI 1945/MT and ADI
5659/MG (2021), so the catalogue never stacks them.

`legalReference` fields marked *Illustrative* are placeholders showing where a
real citation would live in production. The point of the design is that finance
can correct any rate through the API without a deploy and without rewriting
history, so replacing this catalogue with a maintained one is a data task, not
an engineering one.
```

### 2. `data/tax-rules.json` — a `_meta` object as the first element

```json
{
  "_meta": {
    "disclaimer": "ILLUSTRATIVE DATA. Rates, thresholds and effective dates were invented or approximated for demonstration. Not tax advice. The tax MECHANICS modelled here (treatments, stacking, thresholds, currency rounding, effective-dated versioning) are real; the numbers are not.",
    "exception": "BR:DIGITAL_SERVICES ICMS exclusion is researched, not invented: STF ADI 1945/MT and ADI 5659/MG (2021).",
    "generated": "seed data for TiendaMax tax engine"
  }
}
```

`asSeedTransaction`-style guards already skip malformed rows, but confirm the
rule loader tolerates a `_meta` entry, or nest the array under a `rules` key.

### 3. Every invented `legalReference` gets an `Illustrative:` prefix

```
"legalReference": "Illustrative: Estatuto Tributario art. 468 (general rate)"
"legalReference": "Illustrative: day-limited VAT relief, modelled here as a permanent threshold to exercise threshold logic"
"legalReference": "STF ADI 1945/MT and ADI 5659/MG (2021)"   <- no prefix, researched
```

This closes F-023, F-024 and F-025 without changing a single rate.

### 4. `GET /` and the compliance report

Add `"disclaimer": "Illustrative tax data. Not tax advice."` to the service
index response and to the top of the generated compliance report JSON. A report
that looks like a filing should say what it is.

## Revised finding statuses

| Finding | Was | Now |
|---|---|---|
| F-023 Impuesto PAIS `validTo: null` | accuracy risk | **WONTFIX by rate.** Prefix the reference with `Illustrative:`. Optional upside: set `validTo` to a plausible expiry anyway, which adds a second date-based selection demo for free. |
| F-024 Colombia clothing threshold invented | accuracy risk | **RESOLVED by labelling.** Keep the rule: `txn_co_0004/5/6` are the threshold boundary tests. Reword the reference so it does not assert a real relief measure. |
| F-025 BR ICMS 18% cites EC 132/2023 | accuracy risk | **RESOLVED by labelling.** Keep the version pair, it is the best date-selection demo. Reword to "Illustrative: modelled rate increase, used to demonstrate effective-dated versioning." |

Cost: about ten minutes of string edits, no logic change, no test changes.
