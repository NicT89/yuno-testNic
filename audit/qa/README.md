# QA probe state

Agent specification: `docs/13-QA-PROBE-AGENT.md`.

- `STATE.json` — machine state read and written every run. Created on run 001.
- `KNOWN.md` — known-and-expected register. Suppression list. Grows over time.
- `runs/RUN-<NNN>.md` — one report per run. Append-only.
- `LATEST.md` — mirror of the most recent run.

Never edit a past run report. A probe history that changes after the fact
cannot be used to tell a regression from a flake.
