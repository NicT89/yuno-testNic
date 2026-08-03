# Regression runs

One file per Hourly Regression Agent run: `RUN-001.md`, `RUN-002.md`, ...
`LATEST.md` mirrors the most recent run so the next one can diff against it.

Append-only. Never edit a past run: a run record that changes after the fact
cannot be used to establish when something broke.

Rolling state that legitimately mutates — golden values, known-accepted
budgets, the flap register, open incidents — lives in
`audit/REGRESSION-STATE.md`, not here.

Agent specification: `docs/13-REGRESSION-AGENT.md`.
