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

for (const [hostname, description] of [
  ['meet.google.com', 'exact meet.google.com host'],
  ['eu-west1.meet.google.com', 'meet.google.com subdomain'],
  ['teams.microsoft.com', 'exact teams.microsoft.com host'],
  ['foo.teams.microsoft.com', 'teams.microsoft.com subdomain'],
  ['teams.live.com', 'exact teams.live.com host'],
  ['foo.teams.live.com', 'teams.live.com subdomain'],
  ['teams.cloud.microsoft', 'exact teams.cloud.microsoft host'],
  ['foo.teams.cloud.microsoft', 'teams.cloud.microsoft subdomain'],
  ['zoom.us', 'exact zoom.us host'],
  ['us02web.zoom.us', 'zoom.us subdomain'],
  ['zoom.com', 'exact zoom.com host'],
  ['us02web.zoom.com', 'zoom.com subdomain']
]) {
  if (!isExcluded(hostname)) throw new Error(`Expected excluded host (${description}): ${hostname}`);
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
