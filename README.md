# loop-killer

Claude Code plugin that ends a stop-hook re-prompt loop. When a stop hook (for
example an active `/goal`) keeps re-prompting the session and the replies make no
tool calls, loop-killer runs `/goal clear` and says so.

## How detection works

At the end of every main-session turn the plugin reads the conversation and takes
the trailing run of re-prompt turns with no tool work:

- A re-prompt turn is a user message that begins with `Stop hook feedback:`,
  `Stop hook` (optionally preceded by `[`), or `Hook re-prompted`, ignoring case.
- The assistant reply to it counts when it made no tool call.
- The run ends at the first pair that is not a re-prompt or whose reply used a tool.

The goal is cleared when the run holds either:

- 3 or more replies that are similar to one another, or
- 6 or more replies, whatever they say.

Two replies are similar when the words they share make up at least 60% of all the
distinct words in the two replies (word-set Jaccard overlap). Words are lowercase
runs of three or more ASCII letters or digits. Every consecutive pair in the run
must be similar.

| Threshold | Value | Meaning |
| --- | --- | --- |
| `SAME_REPLY_TURNS` | 3 | Trailing re-prompt turns with similar replies and no tool work |
| `IDLE_TURNS` | 6 | Trailing re-prompt turns with no tool work, any replies |
| `SIMILAR` | 0.6 | Minimum word overlap between consecutive replies |

After a kill, the next one can happen no sooner than 10 main-session turns later.
Subagent turns are ignored and not counted. The thresholds are constants in
`hooks/register.ts`.

When it fires, the plugin runs `/goal clear`, shows a toast, writes a log line, and
appends a one-line notice to the turn's answer. If `/goal clear` fails, the failure
is logged and the turn continues.

## Install

```sh
claude plugin marketplace add cavi-ai/plugins
```

Then, in a session:

```text
/plugin install loop-killer@cavi-ai
```

## Uninstall

```text
/plugin uninstall loop-killer@cavi-ai
```

## License

MIT. See [LICENSE](LICENSE).
