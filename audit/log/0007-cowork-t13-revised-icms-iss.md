# 0007 — cowork — T13 superseded: ICMS and ISS cannot both apply to software

**When:** 2026-08-03T03:00Z
**Agent:** cowork
**Task:** T13 → T13-R
**Findings touched:** F-022 (opened), T13 in `docs/08-PRD-FIX-TASKS.md` superseded
**Files changed:** `docs/09-T13-REVISED.md`, `audit/findings/FINDINGS.md`, `audit/ACTIVE.md`

## What changed
Researched the Brazilian federal layer before executing T13 and found that the
rule T13 was building on is wrong. STF ADI 1945/MT and ADI 5659/MG (Feb 2021)
held software transactions are subject to ISS, not ICMS; the two are mutually
exclusive on digital goods. Our catalogue stacks both and labels it "the
multi-tax case".

T13 as written would have added a third tax on top of an illegal pair.
Replaced by T13-R: drop the ICMS line, add PIS/COFINS-Importação 9.25%
federal, keep ISS 5% municipal, effective 14.25%.

## Verified how
Web search returning the STF rulings via Machado Associados, Mattos Filho,
International Tax Review and portal.stf.jus.br. Grep for every place pinning
the 22% result:
```
docs/04-TAX-RULES.md:58, :86
scripts/test-tax.ts:113
data/tax-rules.json:160
```
Three files. An earlier note claiming "every assertion" was an overstatement
and is corrected here.

## For the next agent
The error is ours, not the brief's. The brief says Brazil has "17% ICMS +
additional municipal taxes", which is correct for physical goods. We applied it
to digital services. ICMS stays exactly as it is on electronics, food, clothing
and medicine.

The README sentence in `docs/09-T13-REVISED.md` step 5 is worth more than the
rule change itself: it shows the catalogue encodes a constitutional exclusivity
rather than trusting the caller to know it. Do not drop it.
