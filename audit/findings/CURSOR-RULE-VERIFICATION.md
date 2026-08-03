# CURSOR — Tax catalogue verification

**When:** 2026-08-03T03:50Z  
**Agent:** cursor  
**Scope:** read-only review of `data/tax-rules.json` (29 versions) against public sources  
**Calibration:** brief allows plausible invented rates → `ARGUABLE` needs no finding. `WRONG` = a domain-literate reviewer would see an error.  
**Known precedent:** F-022 / T13-R — BR digital ICMS+ISS stack (STF ADI 1945/5659).

## Summary

| Verdict | Count |
|---|---|
| CONFIRMED | 18 |
| ARGUABLE | 7 |
| WRONG | 4 (incl. F-022 already open) |

New findings opened: **F-023**, **F-024**, **F-025**.

## Verification table

| rule id (key@v) | our rate | what sources say | verdict | source URL |
|---|---|---|---|---|
| BR:\*:ICMS@v1 | 17% | Interstate/default ICMS often cited ~17–18%; LC 87/1996 frames ICMS, rate is state-set | ARGUABLE | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm |
| BR:ELECTRONICS:ICMS@v1 | 17% to 2026-01-01 | Plausible historical illustrative rate; LC 87 does not fix 17% for electronics | ARGUABLE | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm |
| BR:ELECTRONICS:ICMS@v2 | 18% from 2026-01-01; cites **EC 132/2023 CBS/IBS** | EC 132 / LC 214 phase-in starts **test IBS/CBS in 2026**; it does **not** mandate a nationwide ICMS electronics bump 17→18 on 2026-01-01. Citing EC 132 for this ICMS change is false attribution | **WRONG** → F-025 | https://legislacao.fazenda.sp.gov.br/Paginas/RC33083_2026.aspx ; https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/tributario-ij/inclusao-do-ibs-e-da-cbs-na-base-de-calculo-do-icms |
| BR:FOOD:ICMS@v1 | 7% reduced | Food/cesta básica reductions exist but rates vary heavily by state/NCM; 7% is a common teaching simplification | ARGUABLE | (state RICMS schedules; brief-permitted) |
| BR:BOOKS:ICMS@v1 | 0% exempt; CF/88 art. 150, VI, d | Constitutional immunity for books/newspapers/periodicals is real | CONFIRMED | https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm |
| BR:MEDICINE:ICMS@v1 | 12% reduced; no legalReference | Medicine ICMS is state/NCM-specific; 12% is a plausible fiction | ARGUABLE | — |
| BR:DIGITAL_SERVICES:ICMS@v1 | 17% ICMS | STF ADI 1945/MT & 5659/MG (2021): software/digital generally **ISS, not ICMS**; stacking with ISS is constitutionally wrong | **WRONG** → F-022 | https://www.internationaltaxreview.com/ (ADI 1945/5659 coverage); `docs/09-T13-REVISED.md` |
| BR:DIGITAL_SERVICES:ISS@v1 | 5% ISS (LC 116 / SP) | ISS on digital/services is the correct family; 5% is a typical municipal rate | CONFIRMED (rate ARGUABLE as city-specific) | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm |
| BR:EDUCATION:ICMS@v1 | 0% exempt; no legalReference | Education often ISS territory / special regimes; blanket ICMS exempt is oversimplified | ARGUABLE | — |
| CO:\*:IVA@v1 | 19%; ET art. 468 | Colombia standard IVA 19% is correct | CONFIRMED | https://www.dian.gov.co/ |
| CO:FOOD:IVA@v1 | 5%; art. 468-1 | Reduced 5% basket exists for listed foods | CONFIRMED / ARGUABLE on breadth of "food" | https://www.rankia.co/blog/dian/3939697-iva-canasta-familiar-productos-tarifas |
| CO:BOOKS:IVA@v1 | 0%; art. 478 cultural | Books commonly excluded/exempt; article cite is directionally right | CONFIRMED | Estatuto Tributario cultural exclusions |
| CO:MEDICINE:IVA@v1 | 0%; no legalReference | Many medicines excluded; blanket 0% is a simplification | ARGUABLE | — |
| CO:CLOTHING:IVA@v1 | 19% with `thresholdMinor: 1000000` (notes claim COP 100,000 / 10M minor), `validTo: null` | Permanent “clothing under COP 100k is IVA-free” is **not** standing law. UVT clothing caps belonged to **Días sin IVA** (Ley 2155 art. 37–38), day-limited and discontinued after Ley 2277/2022. Notes also **mis-state** minor units (1,000,000 minor = COP 10,000 at exp 2, not COP 100,000) | **WRONG** → F-024 | https://www.rankia.co/blog/dian/3939697-iva-canasta-familiar-productos-tarifas ; https://leyes.co/se_expide_la_ley_de_inversion_social/38.htm |
| CO:DIGITAL_SERVICES:IVA@v1 | 19% from 2018-07-01; Ley 1819/2016 | Non-resident digital services IVA is real; mid-2018 timing is broadly right | CONFIRMED | Ley 1819/2016 digital-services IVA regime |
| AR:\*:IVA@v1 | 21%; Ley 23.349 | Standard alícuota general 21% | CONFIRMED | Ley 23.349 |
| AR:FOOD:IVA@v1 | 10.5%; no legalReference | 10.5% reduced IVA for listed foods exists | CONFIRMED / ARGUABLE on category breadth | — |
| AR:BOOKS:IVA@v1 | 0%; Ley 25.446 | Book law / cultural exemption is real | CONFIRMED | Ley 25.446 |
| AR:MEDICINE:IVA@v1 | 10.5%; no legalReference | Reduced rate for many medicines exists | ARGUABLE | — |
| AR:DIGITAL_SERVICES:IVA@v1 | 21% B2C; RG 4240/2018 | Digital-services IVA withholding regime is real | CONFIRMED | RG 4240/2018 |
| AR:DIGITAL_SERVICES:IVA:B2B@v1 | reverse charge 0% collected | B2B import-of-services / self-assessment pattern is real | CONFIRMED | RG 4240/2018 |
| AR:DIGITAL_SERVICES:PAIS@v1 | 8% stacks; `validTo: null`; Ley 27.541 | 8% on many digital/FX-card flows was real while PAIS lived, but **Impuesto PAIS ended ~22–23 Dec 2024** and was not extended. Open-ended `validTo: null` wrongly taxes post-repeal fixtures (2025–2026 txns) | **WRONG** → F-023 | https://globaltaxnews.ey.com/news/2025-0160-argentina-eliminates-the-impuesto-pais ; https://www.vatupdate.com/2025/01/08/argentina-eliminates-the-impuesto-pais/ |
| CL:\*:IVA@v1 | 19%; DL 825; notes “including books” | Chile general rate 19%; no general book VAT exemption for ordinary book sales | CONFIRMED | https://www.bcn.cl/leychile/navegar?idNorma=6369 ; https://www.sii.cl/normativa_legislacion/sobreventasyservicios.pdf |
| CL:DIGITAL_SERVICES:IVA@v1 | 19% from 2020-06-01; Ley 21.210 | Foreign digital services IVA regime from ~2020 is real | CONFIRMED | Ley 21.210 |
| PE:\*:IGV@v1 | 18% (16%+IPM 2%); DL 821 | Combined IGV 18% is standard | CONFIRMED | DL 821 |
| PE:FOOD:IGV@v1 | 0% Apéndice I | Unprocessed agri goods often unaffected; “food” blanket is broad | ARGUABLE | Apéndice I IGV |
| PE:BOOKS:IGV@v1 | 0%; Ley 31053 | Book law exemption is real | CONFIRMED | Ley 31053 |
| PE:MEDICINE:IGV@v1 | 0%; no legalReference | Some medicines exempt; blanket 0% simplified | ARGUABLE | — |
| PE:DIGITAL_SERVICES:IGV@v1 | 18% from **2024-12-01**; DL 1623 | DL 1623 collection mechanism for non-domiciled digital providers starts **1 Dec 2024** — date claim CONFIRMED. (Note: IGV liability conceptually pre-existed; DL 1623 is the effective collection regime.) | CONFIRMED | https://nodomiciliados.sunat.gob.pe/es/fiscalidad-internacional/tributacion-de-no-domiciliados/2-impuestos-indirectos/22-igv-servicios |

## Stacking mutual-exclusivity check

| Stack | Assessment |
|---|---|
| BR digital ICMS + ISS | **WRONG** — mutually exclusive on software/digital (F-022) |
| AR digital IVA + PAIS | Historically stacked while PAIS was in force; **post-2024-12-23 PAIS must not apply** (F-023). IVA remains. |

## Exact JSON patches recommended (Cursor will not apply)

### F-023 — close PAIS after repeal

```json
// In AR:DIGITAL_SERVICES:PAIS version 1, set:
"validTo": "2024-12-23"
// Keep rateBps 800 for the historical window. Optionally add notes:
"notes": "STACKS on IVA for B2C while Impuesto PAIS was in force. Closed 2024-12-23 when PAIS was not extended."
```

### F-024 — remove invented permanent clothing threshold

**Option A (preferred for accuracy):** drop threshold; clothing always 19%.

```json
"thresholdMinor": 0,
"notes": "Clothing carries standard 19% IVA. Días sin IVA UVT caps were day-limited (Ley 2155) and are not modelled as a standing threshold.",
"legalReference": "Estatuto Tributario art. 468 - general rate"
```

**Option B (keep demo threshold):** retarget notes to an explicit “illustrative threshold for the brief” and fix units, with `validTo` bounded to last real Día sin IVA year — still misleading; prefer A.

Also fix fixtures `txn_co_0004/5/6` expectations after the rule change.

### F-025 — stop attributing electronics 18% to EC 132

Either:
1. **Demo-honest:** change `legalReference` / `notes` to state the 17→18 split is an **illustrative** valid-time demo, not an EC 132 mandate; or
2. **Domain-honest:** remove v2 rate change and demo versioning with a different real/plausible pair (or keep 17% and version a non-rate field).

Minimum patch if keeping the demo split:

```json
"legalReference": "Illustrative valid-time demo (not mandated by EC 132/2023)",
"notes": "EC 132/2023 introduces CBS/IBS transition; it does not by itself raise ICMS electronics from 17% to 18% on 2026-01-01. This v2 exists so reviewers can see date-based selection."
```

### F-022 — already specified in `docs/09-T13-REVISED.md`

Replace digital ICMS line with PIS/COFINS-Importação 9.25%; keep ISS 5%.

## Could not fully check

- Live DB contents after Claude Code mid-edit (seed may be stale until Mac `npm run db:seed`).
- Whether Claude Code already applied T13-R on disk vs JSON still showing ICMS+ISS (JSON still stacked at review time).
