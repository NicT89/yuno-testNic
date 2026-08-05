# 04 — Tax rule catalogue (BR / CO / AR / CL / PE)

30 rule versions. Machine-readable source of truth:
[`data/tax-rules.json`](../data/tax-rules.json).

Rates, thresholds and effective dates are an illustrative working set; some
were invented or approximated for this exercise. Each rule carries either a
traceable `legalReference` or an explicit illustrative note. They are not legal
advice: the design goal is that finance can correct any rate through the API
without a deploy and without rewriting history.

## Summary

| Country | Currency (exp) | Standard | Reduced | Exempt | Special |
|---|---|---|---|---|---|
| Brazil | BRL (2) | ICMS 17%, **18% from 2026-01-01** on electronics | food 7%, medicine 12% | books, education | **Stacks** federal PIS/COFINS-Importacao 9.25% + municipal ISS 5% on digital services |
| Colombia | COP (2) | IVA 19% | food 5% | books, medicine | Clothing under COP 10,000.00 exempt (**illustrative threshold**) |
| Argentina | ARS (2) | IVA 21% | food 10.5%, medicine 10.5% | books | **Stacks** IVA + PAIS 8% on B2C digital; **reverse charge** for B2B digital |
| Chile | CLP (**0**) | IVA 19% on everything | none | none | Zero-decimal currency; Chile taxes books too |
| Peru | PEN (2) | IGV 18% | none | food, books, medicine | Digital-services rule valid only from 2024-12-01 |

## Rule key convention

```
<COUNTRY>:<CATEGORY>:<TAX_TYPE>[:<QUALIFIER>]      stable identity
<rule_key>@v<n>                                    one immutable version
```

`*` in the category slot is the country-wide wildcard. An exact category beats
the wildcard; an exact `customerType` beats `*`. Resolution picks one winning
rule **per tax type**, which is how stacking works.

Examples: `BR:ELECTRONICS:ICMS@v2`, `CO:*:IVA@v1`,
`AR:DIGITAL_SERVICES:IVA:B2B@v1`.

## Versioned pairs seeded for the demo

These exist so date-based rule selection is provable the moment the seed
finishes, without the reviewer having to change anything.

| Rule | v1 | v2 |
|---|---|---|
| `BR:ELECTRONICS:ICMS` | 17%, valid 2020-01-01 to 2026-01-01 | 18%, valid from 2026-01-01 (illustrative state-level revision, **not** mandated by EC 132/2023) |

A transaction dated 2025-12-31 resolves to v1 at 17%. The same inputs dated
2026-01-02 resolve to v2 at 18%. Same `rule_key`, different valid window,
no code change.

`PE:DIGITAL_SERVICES:IGV` is valid only from 2024-12-01 (DL 1623). A 2024-06
transaction in that category falls through to the `PE:*:IGV` wildcard instead,
which exercises the fallback path.

## Multi-tax stacking

Two modelled cases:

- **Brazil digital services:** federal PIS/COFINS-Importacao 9.25% (priority 5) +
  municipal ISS 5% (priority 20) = 14.25% effective. `Lei 10.865/2004` and
  `LC 116/2003`. An explicit 0% ICMS exemption records that STF ADI 1945 and
  ADI 5659 (2021) held software subject to ISS rather than ICMS; the explicit
  row prevents the country wildcard from charging ICMS. ICMS still applies to
  Brazilian physical goods. The legal structure is researched; the working
  rates remain illustrative.
- **Argentina B2C digital services:** IVA 21% (priority 100) + Impuesto PAIS 8%
  (priority 20) = 29% effective, **for transactions dated before 2024-12-23**.
  `RG 4240/2018` and `Ley 27.541`. PAIS was not extended past December 2024, so
  the rule is closed in VALID TIME and a 2026 sale resolves IVA alone. That
  makes it the second date-based selection demo alongside Brazilian electronics.

Rules carry `priority` for stack order and `compoundOnPrevious` for taxes
levied on (base + accumulated tax) rather than on the base alone.

## Treatments

`standard` and `reduced` charge `rateBps`. `exempt` and `zero_rated` collect
nothing (the difference is whether the transaction stays in scope for
reporting). `reverse_charge` collects nothing because liability shifts to the
registered business buyer, which is the Argentina B2B case.

## Thresholds

`thresholdMinor` means the rule does not apply below that amount. Colombia
clothing under COP 10,000.00 is the seeded example, and it is an **illustrative
threshold, not standing law**: the real UVT clothing caps applied only during
day-limited 'Dias sin IVA' events (Ley 2155/2021), discontinued after Ley
2277/2022. It is retained because it exercises the boundary logic. Threshold comparison uses
the absolute value so refunds mirror the original sale exactly.

## Verified submission output

From the submitted `npm run demo`, confirmed by the passing suite and committed
country reports under [`reports/`](../reports/):

```
BR  electronics       100.00 BRL   tax  18.00   18.00%  ICMS 18.00%
BR  food              100.00 BRL   tax   7.00    7.00%  ICMS 7.00%
BR  books             100.00 BRL   tax   0.00    0.00%  ICMS 0.00%
BR  digital_services  100.00 BRL   tax  14.25   14.25%  PIS_COFINS_IMPORT 9.25% + ISS 5.00%
CO  electronics       100.00 COP   tax  19.00   19.00%  IVA 19.00%
CO  food              100.00 COP   tax   5.00    5.00%  IVA 5.00%
AR  food              100.00 ARS   tax  10.50   10.50%  IVA 10.50%
AR  digital_services  100.00 ARS   tax  29.00   29.00%  PAIS 8.00% + IVA 21.00%   (dated pre-2024-12-23)
AR  digital_services  100.00 ARS   tax  21.00   21.00%  IVA 21.00%                (dated after PAIS lapsed)
AR  digital_services (business)     tax   0.00    0.00%  reverse charge
CL  books             100000 CLP   tax  19000   19.00%  IVA 19.00%
PE  electronics       100.00 PEN   tax  18.00   18.00%  IGV 18.00%
PE  books             100.00 PEN   tax   0.00    0.00%  IGV 0.00%
```
