import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('generated content script parses as a standalone script', () => {
  const source = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
  assert.ok(source.includes('[autoplay-blocker]'));
  assert.ok(!source.includes('import '));
});
