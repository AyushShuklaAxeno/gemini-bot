import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractInvariantsSection } from './claudeMdExcerpt.mjs';

test('extracts text between the invariants heading and the next section', () => {
  const doc = [
    '# CLAUDE.md',
    '## Running it',
    'run stuff',
    '## Critical backend invariants (don\'t break these)',
    'Rule one.',
    'Rule two.',
    '## Migrations',
    'migration stuff',
  ].join('\n');
  const result = extractInvariantsSection(doc);
  assert.match(result, /Rule one\./);
  assert.match(result, /Rule two\./);
  assert.doesNotMatch(result, /migration stuff/);
  assert.doesNotMatch(result, /run stuff/);
});

test('extracts to end of file when there is no following Migrations heading', () => {
  const doc = [
    '## Critical backend invariants (don\'t break these)',
    'Only rule.',
  ].join('\n');
  const result = extractInvariantsSection(doc);
  assert.match(result, /Only rule\./);
});

test('falls back to the whole document when the heading is missing', () => {
  const doc = '# Some doc\nwith no matching heading at all';
  assert.equal(extractInvariantsSection(doc), doc);
});
