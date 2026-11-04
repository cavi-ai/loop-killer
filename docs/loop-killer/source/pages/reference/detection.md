# Detection

At the end of every main-session turn that ended with an answer, the plugin
reads the conversation in its Messages API form and takes the trailing run of
re-prompt turns with no tool work.

## Re-prompt turns

- A re-prompt is a user message with a text block that begins with
  `Stop hook feedback:`, `Stop hook` (optionally preceded by `[`), or
  `Hook re-prompted`, ignoring case.
- The assistant message that answers it counts when it made no tool call; its
  text is its text blocks, thinking left out.
- The run ends at the first pair that is not a re-prompt and its answer, or
  whose answer used a tool.

## When the goal is cleared

The goal is cleared when the run holds either:

- 3 or more replies that are similar to one another, or
- 6 or more replies, whatever they say.

Two replies are similar when the words they share make up at least 60% of all
the distinct words in the two replies (word-set Jaccard overlap). Words are
lowercase runs of three or more letters or digits in any script. Two replies
with no words are similar only when their text is the same. Every consecutive
pair in the run must be similar.

| Threshold | Value | Meaning |
| --- | --- | --- |
| `SAME_REPLY_TURNS` | 3 | Trailing re-prompt turns with similar replies and no tool work |
| `IDLE_TURNS` | 6 | Trailing re-prompt turns with no tool work, any replies |
| `SIMILAR` | 0.6 | Minimum word overlap between consecutive replies |

Subagent turns, and turns that the person interrupted or an error ended, are
ignored. A later loop is cleared as soon as it reaches a threshold. The
thresholds are constants in `hooks/register.ts`.

## When it fires

The plugin runs `/goal clear`, shows a toast, writes a log line, and appends a
one-line notice to the turn's answer. The notice names the rule that fired and
whether `/goal clear` succeeded.
