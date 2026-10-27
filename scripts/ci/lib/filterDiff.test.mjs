import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXCLUDED_GLOBS, excludePathspecs } from './filterDiff.mjs';

test('EXCLUDED_GLOBS includes known noisy files', () => {
  assert.ok(EXCLUDED_GLOBS.includes('package-lock.json'));
  assert.ok(EXCLUDED_GLOBS.includes('*.png'));
});

test('excludePathspecs prefixes every glob with :(exclude)', () => {
  const result = excludePathspecs(['a.txt', '*.png']);
  assert.deepEqual(result, [':(exclude)a.txt', ':(exclude)*.png']);
});

test('excludePathspecs defaults to EXCLUDED_GLOBS', () => {
  const result = excludePathspecs();
  assert.equal(result.length, EXCLUDED_GLOBS.length);
  assert.ok(result.every((p) => p.startsWith(':(exclude)')));
});
