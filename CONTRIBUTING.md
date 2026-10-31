# Contributing

The plugin is one hooks module, `hooks/register.ts`, loaded through
`hooks/hooks.json`.

## Develop

Load the working copy into a session; saving a file reloads the hooks module:

```sh
claude --plugin-dir /path/to/loop-killer
```

Check the manifest and the module, then run the tests:

```sh
claude plugin validate .
claude plugin test .
```

Tests live in `tests/*.test.ts` and use the kit from `claude-code/testing`. The
`.claude-plugin/types/` folder holds generated typings for the editor and is not
committed.

## Documentation

The cavi-ai.xyz documentation lives in `docs/loop-killer/source`. Check it, then
build and verify it locally:

```sh
node --test scripts/docs/*.test.mjs
node scripts/docs/build.mjs
node scripts/docs/verify.mjs
```

Publishing a GitHub release builds the same documentation from the release commit
and attaches it to the release.

## Pull requests

1. Branch from `main`.
2. Keep one change per pull request, with a test for any behavior change.
3. Make `claude plugin validate .` and `claude plugin test .` exit 0.
4. In the pull request, describe the behavior changed and the checks you ran.
5. Add a one-line entry to `CHANGELOG.md`.
