# Exclude Conferencing Sites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the autoplay blocker from injecting into Google Meet, Microsoft Teams, and Zoom while preserving behavior on unrelated sites.

**Architecture:** Add `exclude_matches` to the existing Manifest V3 content-script declaration. Validate the JSON and exclusion boundaries with a standalone shell test because this repository has no test runner or dependency manifest.

**Tech Stack:** Chrome Manifest V3, JSON, POSIX shell utilities.

## Global Constraints

- Exclude only `meet.google.com`, `teams.microsoft.com`, `teams.live.com`, `teams.cloud.microsoft`, `zoom.us`, and `zoom.com`, including their subdomains.
- Do not modify `content.js`.
- Do not exclude parent domains or lookalike suffixes.
- Preserve the existing content-script settings.

---

### Task 1: Add exclusion-boundary validation

**Files:**
- Create: `tests/test-exclusions.sh`

**Interfaces:**
- Consumes: `manifest.json` and the ordered `exclude_matches` patterns.
- Produces: Exit code 0 only when required hosts are excluded and lookalike/unrelated hosts are not.

- [ ] **Step 1: Write the failing validation test**

Create a shell test that reads `manifest.json`, verifies the twelve required patterns are present, and checks representative URL hostnames using exact-host-or-subdomain matching. The test must reject a hostname such as `teams.microsoft.com.example.com` rather than using an unsafe substring match.

```json
#!/bin/sh
set -eu

manifest_file=${1:-manifest.json}

node - "$manifest_file" <<'NODE'
const fs = require('fs');
const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const script = manifest.content_scripts.find((entry) => entry.js.includes('content.js'));
const patterns = script && script.exclude_matches || [];
const requiredHosts = [
  'meet.google.com',
  'teams.microsoft.com',
  'teams.live.com',
  'teams.cloud.microsoft',
  'zoom.us',
  'zoom.com'
];

for (const host of requiredHosts) {
  for (const pattern of [`*://${host}/*`, `*://*.${host}/*`]) {
    if (!patterns.includes(pattern)) throw new Error(`Missing exclusion: ${pattern}`);
  }
}

function isExcluded(hostname) {
  return requiredHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

for (const hostname of [
  'meet.google.com',
  'eu-west1.meet.google.com',
  'teams.microsoft.com',
  'foo.teams.live.com',
  'teams.cloud.microsoft',
  'zoom.us',
  'us02web.zoom.us',
  'zoom.com'
]) {
  if (!isExcluded(hostname)) throw new Error(`Expected excluded host: ${hostname}`);
}

for (const hostname of [
  'www.google.com',
  'microsoft.com',
  'teams.microsoft.com.example.com',
  'zoom.us.example.com',
  'example.zoom.com.attacker.test'
]) {
  if (isExcluded(hostname)) throw new Error(`Unexpectedly excluded host: ${hostname}`);
}

console.log('conferencing exclusions: all checks passed');
NODE
```

- [ ] **Step 2: Run the test before implementation**

Run:

```bash
chmod +x tests/test-exclusions.sh
./tests/test-exclusions.sh
```

Expected: FAIL because `exclude_matches` has not yet been added to `manifest.json`.

### Task 2: Add manifest exclusions

**Files:**
- Modify: `manifest.json:6-15`

**Interfaces:**
- Consumes: Existing Manifest V3 `content_scripts` declaration.
- Produces: A valid `exclude_matches` array used by Chrome to skip `content.js` on the six conferencing host families.

- [ ] **Step 1: Add exact-host and subdomain match patterns**

Add the following property inside the existing content-script object, without changing its other properties:

```json
"exclude_matches": [
  "*://meet.google.com/*",
  "*://*.meet.google.com/*",
  "*://teams.microsoft.com/*",
  "*://*.teams.microsoft.com/*",
  "*://teams.live.com/*",
  "*://*.teams.live.com/*",
  "*://teams.cloud.microsoft/*",
  "*://*.teams.cloud.microsoft/*",
  "*://zoom.us/*",
  "*://*.zoom.us/*",
  "*://zoom.com/*",
  "*://*.zoom.com/*"
]
```

- [ ] **Step 2: Parse the manifest**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest.json: valid JSON')"
```

Expected output includes `manifest.json: valid JSON` and exit code 0.

- [ ] **Step 3: Run the validation test**

Run:

```bash
./tests/test-exclusions.sh
```

Expected output: `conferencing exclusions: all checks passed` and exit code 0.

- [ ] **Step 4: Inspect the diff**

Run:

```bash
git diff -- manifest.json
```

Expected: only the new `exclude_matches` property and the new validation test are present.

- [ ] **Step 5: Run final verification**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest.json: valid JSON')" && ./tests/test-exclusions.sh && git diff --check && git status --short
```

Expected: valid JSON, all exclusion checks passed, no whitespace errors, and only intended files changed.

- [ ] **Step 6: Commit the implementation**

```bash
git add manifest.json tests/test-exclusions.sh
git commit -m "fix: exclude conferencing sites from autoplay hooks"
```
