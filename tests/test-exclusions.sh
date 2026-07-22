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
