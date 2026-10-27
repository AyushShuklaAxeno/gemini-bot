import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truncateText } from './truncate.mjs';

test('returns text unchanged when under the byte cap', () => {
  const result = truncateText('hello', 100);
  assert.deepEqual(result, { text: 'hello', truncated: false });
});

test('truncates and appends notice when over the byte cap', () => {
  const result = truncateText('abcdefghij', 4, { notice: '[cut]' });
  assert.equal(result.truncated, true);
  assert.equal(result.text, 'abcd[cut]');
});

test('truncates with no notice when none is given', () => {
  const result = truncateText('abcdefghij', 4);
  assert.equal(result.truncated, true);
  assert.equal(result.text, 'abcd');
});

test('measures by UTF-8 byte length, not character count', () => {
  // '€' is 3 bytes in UTF-8 but 1 JS string character
  const result = truncateText('€€€€', 6, { notice: '' });
  assert.equal(result.truncated, true);
  assert.equal(result.text, '€€');
});

test('trims incomplete UTF-8 sequences without producing replacement chars', () => {
  // '€' is 3 bytes in UTF-8. Truncating to 4 bytes lands 1 byte into the second €.
  // Must trim the incomplete sequence and not produce U+FFFD (replacement char ' ').
  const result = truncateText('€€€€', 4, { notice: '' });
  assert.equal(result.truncated, true);
  assert.equal(result.text, '€'); // Only the complete first character
  assert.ok(!result.text.includes('\uFFFD'), 'should not contain replacement character');
});
