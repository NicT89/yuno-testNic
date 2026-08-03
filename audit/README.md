# audit/ — shared work log for multi-agent collaboration

Several agents work this repo at once: **Claude Code** (build), **Cursor**
(review and fixtures), and **Claude in Cowork** (planning and audit). None of
them share memory. This folder is the memory.

## The protocol, in four rules

1. **Read `audit/ACTIVE.md` before you touch anything.** It says what phase the
   work is in, which files are claimed by which agent, and what is blocked. If
   a file you need is claimed by another agent, do not edit it. Pick different
   work or write a `BLOCKED` entry and stop.

2. **Claim before you edit.** Add your name and the file globs you are about to
   touch to the ownership table in `ACTIVE.md`. Release the claim when you are
   done. A claim you forget to release is worse than no protocol at all.

3. **Log every meaningful action** as a new file in `audit/log/`. Never edit an
   existing log entry: this is an append-only trail, same principle as the tax
   audit table the product itself implements. Naming:

   ```
   audit/log/NNNN-<agent>-<short-slug>.md      e.g. 0003-claude-code-bitemporal-rules.md
   ```

   `NNNN` is a zero-padded sequence. Take the next unused number. If two agents
   collide on a number, the later writer bumps to the next free one.

4. **Findings go in the registry.** Anything that puts rubric points at risk is
   a numbered finding in `audit/findings/FINDINGS.md`. Add new ones with the
   next `F-NNN`. When you fix one, update its **Status** row in the registry
   *and* write a log entry that references the finding id. Never delete a
   finding; mark it `RESOLVED` or `WONTFIX` with a reason.

## Log entry format

Keep it short. Five fields, no prose padding.

```markdown
# NNNN — <agent> — <what happened>

**When:** 2026-08-03T01:55Z
**Agent:** claude-code | cursor | cowork
**Task:** T3 (docs/02-BUILD-PLAN.md)
**Findings touched:** F-002, F-011
**Files changed:** lib/audit.ts, lib/db.ts, app/api/audit/[transactionId]/route.ts

## What changed
Two or three sentences. What a reviewer would need to know.

## Verified how
The command you ran and what it printed. "Looks right" is not a verification.

## For the next agent
Anything they would otherwise discover the hard way. Assumptions you made,
things you deliberately left undone, traps you hit.
```

## When to write an entry

Write one when you: finish a task from `docs/02-BUILD-PLAN.md`, change a shared
contract (schema, types, API shape), find or fix a finding, hit a blocker, or
make a decision another agent could reasonably reverse by accident.

Do not write one for routine edits inside a task you already claimed.

## What this buys us

The product being built is a compliance engine whose entire value is an
immutable, replayable record of who decided what and when. Running the project
the same way is not decoration: if a reviewer asks why a rate is 17% or why the
schema has two time columns, the answer is a log entry, not a memory.
