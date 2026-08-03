# Scorecards

One file per Score Audit Agent run: `RUN-001.md`, `RUN-002.md`, ...
`LATEST.md` mirrors the most recent run so the next one can diff against it.

Scorecards are append-only. Never edit a past run: a scorecard that changes
after the fact cannot be used to measure whether the work improved anything.

Agent specification: `docs/agents/SCORE-AUDIT-AGENT.md`.
