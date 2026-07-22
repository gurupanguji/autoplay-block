# Task 1 Report: Add exclusion-boundary validation

## Status

Implemented Task 1 only. Created `tests/test-exclusions.sh` as an executable shell test. `manifest.json` was not modified.

## Implementation

The test:

- Reads the manifest path from the first argument, defaulting to `manifest.json`.
- Parses the manifest with Node.js.
- Locates the content-script entry containing `content.js`.
- Requires both exact-host and subdomain patterns for all six required conferencing hosts, for twelve patterns total.
- Validates representative exact hosts and subdomains as excluded.
- Validates unrelated hosts and lookalike suffixes as not excluded, including `teams.microsoft.com.example.com`.

## Required failing test

Command:

```sh
chmod +x tests/test-exclusions.sh
./tests/test-exclusions.sh
```

Result: failed with exit code 1 as required. The failure was:

```text
Error: Missing exclusion: *://meet.google.com/*
```

This confirms the test fails because the manifest implementation is not present yet.

## Self-review

- The script matches the task brief exactly.
- The boundary check uses exact host equality or a hostname suffix beginning with `.`; it does not use unsafe substring matching.
- The negative cases cover unrelated hosts and attacker-controlled lookalike suffixes.
- `git diff --check` passed.
- `manifest.json` has no working-tree changes.
- The test file has executable permissions.

## Concerns

The test is expected to remain failing until the manifest implementation adds the twelve required `exclude_matches` patterns in Task 2.
