# Overview

Loop Killer is a Claude Code plugin that ends a stop-hook re-prompt loop. When a
stop hook, for example an active `/goal`, keeps re-prompting the session and the
replies make no tool calls, Loop Killer runs `/goal clear` and says so.

## What it does

- Reads the conversation at the end of every main-session turn.
- Counts the trailing re-prompt turns whose replies made no tool call.
- Clears the active goal when those replies repeat themselves or when there are
  too many of them. [Detection](../reference/detection.md) lists the rules.
- Shows a toast, writes a log line, and appends a one-line notice to the turn's
  answer naming the rule that fired and whether `/goal clear` succeeded.

Subagent turns are ignored. After a goal is cleared, the next clear can happen
no sooner than 10 main-session turns later.

Loop Killer is version {{PRODUCT_VERSION}}, released as `{{RELEASE_TAG}}`. It is
MIT licensed.
