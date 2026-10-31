# Installation

Loop Killer is published through the CAVI plugin catalog.

## Install

Add the catalog once:

```sh
claude plugin marketplace add cavi-ai/plugins
```

Then, in a Claude Code session:

```text
/plugin install loop-killer@cavi-ai
```

The plugin is active in every main session from then on. It needs no settings.

## Uninstall

```text
/plugin uninstall loop-killer@cavi-ai
```

## Develop

Load a working copy into a session; saving a file reloads the hooks module:

```sh
claude --plugin-dir /path/to/loop-killer
```
