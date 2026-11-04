# Changelog

## Unreleased

- Read re-prompts from the Messages API form, so a reply with thinking counts once and a long answer is never taken for a loop.
- Leave turns the person interrupted or an error ended alone, and clear a later loop without a 10-turn wait.
- Compare replies by words in any script; two replies with no words match only when their text is the same.

## 0.2.1

- Detect re-prompts that Claude Code keeps out of the conversation, so an active `/goal` loop is cleared.

## 0.2.0

- Notice names the rule that fired and reports a failed `/goal clear`.
- Documentation for cavi-ai.xyz in `docs/loop-killer/source`, published with each GitHub release.

## 0.1.0

- Clear the active goal after 3 similar or 6 any re-prompt turns with no tool work.
