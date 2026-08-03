# 09 — T13 revised: the Brazil digital-services rule is legally wrong

Supersedes T13 in `docs/08-PRD-FIX-TASKS.md`. Opens **F-022**.

## What the research turned up

In February 2021 the Brazilian Supreme Federal Court (STF) decided ADI 1945/MT
and ADI 5659/MG and held that transactions involving software — standardised or
custom, downloaded or SaaS — are subject to **ISS (municipal service tax)** and
**not ICMS (state goods tax)**. The two are constitutionally mutually exclusive
on digital goods. That is settled law, not a grey area.

Our current catalogue stacks both:

```json
"BR:DIGITAL_SERVICES:ICMS"  rateBps 1700   // state
"BR:DIGITAL_SERVICES:ISS"   rateBps  500   // municipal
notes: "STACKS on top of ICMS. This is the multi-tax case: 17% + 5% = 22%."
```

That is the one combination Brazilian law specifically forbids. Yuno is a LATAM
payments company; the odds that a reviewer knows the ICMS-versus-ISS software
dispute are not low. A confidently wrong tax rule reads worse under "Tax
Calculation Accuracy" (25 pts) than a missing feature does.

**This is our error, not the PRD's.** The original brief only says Brazil has
"17% ICMS + additional municipal taxes", which is fine for *physical goods*. We
applied it to digital services.

## Revised recommendation: fix two taxes, do not add a third

Adding federal PIS/COFINS on top of a wrong ICMS line compounds the problem.
Replace the ICMS line instead.

**Cross-border digital services into Brazil (`BR:DIGITAL_SERVICES`):**

| Layer | Tax | Rate | Basis |
|---|---|---|---|
| Federal | PIS/COFINS-Importação | 9.25% (1.65% + 7.6%) | Levied on imports of services |
| Municipal | ISS | 5% | LC 116/2003, São Paulo rate |
| — | **effective** | **14.25%** | |

This still demonstrates multi-tax stacking, still spans two levels of
government (federal + municipal, exactly the brief's stretch-goal example), and
is defensible if anyone asks. It removes a rule that is affirmatively wrong.

Keep ICMS where it belongs: physical goods (`BR:*`, electronics, food,
clothing, medicine). Nothing there changes.

## Do this

1. **Delete** `BR:DIGITAL_SERVICES:ICMS` from `data/tax-rules.json`.
2. **Add** `BR:DIGITAL_SERVICES:PIS_COFINS_IMPORT`, `rateBps` 925,
   `taxScope` "federal", `priority` 5, `legalReference`
   "Lei 10.865/2004 — PIS/COFINS-Importação on imported services (1.65% + 7.6%)".
   Allow `federal` in `tax_scope` in `scripts/schema.sql` and the validation schema.
3. **Keep** `BR:DIGITAL_SERVICES:ISS` at 5%, priority 20. Rewrite its `notes`:
   "Stacks with federal PIS/COFINS-Importação. ICMS deliberately does NOT apply
   to digital services: STF ADI 1945 and ADI 5659 (2021) held that software is
   subject to ISS, not ICMS."
4. Update the three files that pin 22% (full list below) to 14.25%.
5. Add a README line. This is the highest-value sentence in the document:
   > Brazil applies ISS (municipal) plus PIS/COFINS-Importação (federal) to
   > cross-border digital services, and ICMS (state) to physical goods. ICMS and
   > ISS are mutually exclusive on software following STF ADI 1945 and ADI 5659
   > (2021), so the engine never stacks them — the rule catalogue encodes that
   > exclusivity rather than relying on the caller to know it.

## Exactly what changes — three files, no more

Verified by grep at 03:00Z:

```
docs/04-TAX-RULES.md:58     "= 22% effective. LC 87/1996 and LC 116/2003"
docs/04-TAX-RULES.md:86     "BR digital_services ... 22.00% ICMS 17.00% + ISS 5.00%"
scripts/test-tax.ts:113     "Brazil multi-tax: ICMS 17% + ISS 5% stacked = 22%"
data/tax-rules.json:160     notes "...17% + 5% = 22% effective."
```

Plus whatever `npm run demo` prints, which regenerates. Fixtures `txn_br_0007`
and `txn_br_0008` change value but need no edit: their `note` fields say
"MULTI-TAX", not a number.

Roughly five minutes. The earlier warning about "every assertion" was wrong.

## Confidence

**High** on the ICMS/ISS exclusivity: the STF ruling is well documented and
widely reported. **Medium** on 9.25% being the right consumer-facing federal
line for this specific transaction shape — PIS/COFINS-Importação is genuinely
9.25% on imported services, but in practice the incidence and who remits varies
by contract structure. That is acceptable: the brief explicitly permits
plausible invented rates, every rule carries a `legalReference`, and the README
already states the catalogue is a documented working set rather than legal
advice. Being wrong in a *cited, arguable* way is a different class of error
from stacking two taxes the constitution says cannot coexist.
