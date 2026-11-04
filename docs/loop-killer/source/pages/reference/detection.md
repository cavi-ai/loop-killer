# Detection

At the end of every main-session turn the plugin reads the conversation and
takes the trailing run of re-prompt turns with no tool work.

## Re-prompt turns

- Claude Code keeps a stop hook's re-prompt out of the conversation a plugin
  reads, so an assistant reply that directly follows another assistant reply
  answered a re-prompt.
- A user message that begins with `Stop hook feedback:`, `Stop hook` (optionally
  preceded by `[`), or `Hook re-prompted`, ignoring case, is a re-prompt too.
- A reply to a re-prompt counts when it made no tool call.
- The run ends at the first reply that used a tool or answered any other
  message.

## When the goal is cleared

The goal is cleared when the run holds either:

- 3 or more replies that are similar to one another, or
- 6 or more replies, whatever they say.

Two replies are similar when the words they share make up at least 60% of all
the distinct words in the two replies (word-set Jaccard overlap). Words are
lowercase runs of three or more ASCII letters or digits. Every consecutive pair
in the run must be similar.

| Threshold | Value | Meaning |
| --- | --- | --- |
| `SAME_REPLY_TURNS` | 3 | Trailing re-prompt turns with similar replies and no tool work |
| `IDLE_TURNS` | 6 | Trailing re-prompt turns with no tool work, any replies |
| `SIMILAR` | 0.6 | Minimum word overlap between consecutive replies |

After a clear, the next one can happen no sooner than 10 main-session turns
later. Subagent turns are ignored and not counted. The thresholds are constants
in `hooks/register.ts`.

## When it fires

The plugin runs `/goal clear`, shows a toast, writes a log line, and appends a
one-line notice to the turn's answer. The notice names the rule that fired and
whether `/goal clear` succeeded.
