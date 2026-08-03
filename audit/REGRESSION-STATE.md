# REGRESSION-STATE — SUPERSEDED

QA Probe Agent state now lives in:

- `audit/qa/STATE.json` — machine state, consecutive-failure counts, signatures
- `audit/qa/KNOWN.md` — the known-and-expected register
- `audit/qa/runs/RUN-<NNN>.md` + `LATEST.md` — append-only run records

The golden-value table from this file was merged into
`docs/13-QA-PROBE-AGENT.md` section 14.

Do not use this file. It is kept only so the merge is traceable.
