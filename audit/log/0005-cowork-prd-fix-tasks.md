# 0005 — cowork — PRD fix tasks T11–T16 written and assigned

**When:** 2026-08-03T02:35Z
**Agent:** cowork
**Task:** planning
**Findings touched:** F-015 → T11, F-017 → T12, F-019 → T13, F-020 → T14, F-018 → T15, F-021 + F-016 → T16
**Files changed:** `docs/08-PRD-FIX-TASKS.md`, `audit/findings/FINDINGS.md`, `audit/ACTIVE.md`

## What changed
Turned the seven PRD-delta findings into six executable tasks with files,
code sketches, acceptance criteria and README wording. Assigned all six to
claude-code and recorded the task id against each finding in the registry.

## Verified how
Nothing executed. This entry exists so the next agent knows the tasks came from
`docs/07-PRD-DELTA.md` and not from the original brief, and knows they are
additive rather than foundational.

## For the next agent
Ordering matters. T11–T16 are additive; starting them before T1–T5 and T10 are
green trades 20-point work for 2-point work. T11 is the only one that is a
defect rather than an enhancement — fold it into T3 while you are already in
`lib/audit.ts`.

Do not let T12 tempt anyone into an in-place rule UPDATE. The verb surface is
CRUD; the storage stays append-only. That distinction is the point of the task.
