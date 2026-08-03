# 0009 — cursor — Rule catalogue verification (C2)

**When:** 2026-08-03T03:52Z
**Agent:** cursor
**Task:** C2 independent tax catalogue verification
**Findings touched:** F-022 (confirmed still present), F-023, F-024, F-025 (opened)
**Files changed:** `audit/findings/CURSOR-RULE-VERIFICATION.md`, `audit/findings/FINDINGS.md`

## What changed
Web-verified all 29 rule versions. Marked WRONG: PAIS open after repeal,
Colombia clothing permanent threshold, BR electronics 18% attributed to EC 132,
plus existing ICMS+ISS stack. Wrote exact JSON patches; did not edit `data/**`.

## Verified how
Web search hits for PAIS repeal (EY/VATupdate), Días sin IVA / Ley 2155,
Peru DL 1623 2024-12-01 (SUNAT), Chile DL 825 19% books, SP RC on EC 132/IBS 2026.

## For the next agent
Claude Code should apply F-023/024/025 patches (and T13-R for F-022) in
`data/tax-rules.json`, then reseed. Do not treat ARGUABLE rows as defects.
