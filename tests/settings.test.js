import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EXCLUDED_HOSTS, normalizeHost, hostCovers, findCoveringEntry,
  isDefaultExcluded, buildExcludeMatches,
} from '../src/shared/settings.js';

test('normalizeHost handles URLs and host variations', () => {
  assert.equal(normalizeHost('HTTPS://WWW.Example.COM:443/path'), 'www.example.com');
  assert.equal(normalizeHost('*.Example.COM.'), 'example.com');
  assert.equal(normalizeHost('  example.com '), 'example.com');
  assert.equal(normalizeHost('exa mple.com'), null);
  assert.equal(normalizeHost('[::1]'), null);
  assert.equal(normalizeHost(''), null);
});

test('hostCovers matches only exact hosts and subdomains', () => {
  assert.equal(hostCovers('zoom.us', 'zoom.us'), true);
  assert.equal(hostCovers('zoom.us', 'meet.zoom.us'), true);
  assert.equal(hostCovers('zoom.us', 'evilzoom.us'), false);
  assert.equal(hostCovers('zoom.us', 'zoom.us.example.com'), false);
});

test('findCoveringEntry returns the first match', () => {
  assert.equal(findCoveringEntry('meet.zoom.us', ['zoom.us', 'us']), 'zoom.us');
  assert.equal(findCoveringEntry('example.com', ['zoom.us']), undefined);
});

test('default exclusions and match patterns are normalized and deduplicated', () => {
  assert.equal(isDefaultExcluded('meet.google.com'), true);
  assert.equal(isDefaultExcluded('evilmeet.google.com'), false);
  const patterns = buildExcludeMatches(['example.com', 'EXAMPLE.com', 'localhost', '127.0.0.1', 'bad host']);
  assert.ok(patterns.includes('*://*.meet.google.com/*'));
  assert.equal(patterns.filter((pattern) => pattern === '*://*.example.com/*').length, 1);
  assert.ok(patterns.includes('*://localhost/*'));
  assert.ok(patterns.includes('*://127.0.0.1/*'));
  assert.ok(!patterns.some((pattern) => pattern.includes('bad')));
  assert.equal(new Set(patterns).size, patterns.length);
  for (const host of DEFAULT_EXCLUDED_HOSTS) {
    assert.ok(patternsForHost(host));
  }
});

function patternsForHost(host) {
  return buildExcludeMatches([]).some((pattern) => pattern === `*://*.${host}/*` || pattern === `*://${host}/*`);
}

test('every default exclusion yields a valid-looking pattern', () => {
  for (const pattern of buildExcludeMatches([])) {
    assert.match(pattern, /^\*:\/\/(\*\.)?[a-z0-9.-]+\/\*$/);
  }
});
