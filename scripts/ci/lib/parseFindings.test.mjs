import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFindings, FindingsParseError } from './parseFindings.mjs';

test('parses a clean JSON array', () => {
  const raw = JSON.stringify([
    { file: 'a.js', line: 3, severity: 'high', summary: 'Bug', suggestion: 'Fix it' },
  ]);
  const result = parseFindings(raw);
  assert.deepEqual(result, [
    { file: 'a.js', line: 3, severity: 'high', summary: 'Bug', suggestion: 'Fix it' },
  ]);
});

test('parses JSON wrapped in a ```json code fence', () => {
  const raw = '```json\n[{"file":"a.js","line":1,"summary":"x"}]\n```';
  const result = parseFindings(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].file, 'a.js');
});

test('recovers a JSON array even with stray prose around it', () => {
  const raw = 'Here you go:\n[{"file":"a.js","line":1,"summary":"x"}]\nHope that helps!';
  const result = parseFindings(raw);
  assert.equal(result.length, 1);
});

test('returns an empty array for []', () => {
  assert.deepEqual(parseFindings('[]'), []);
});

test('drops malformed entries but keeps valid ones', () => {
  const raw = JSON.stringify([
    { file: 'a.js', line: 1, summary: 'valid' },
    { file: 'b.js', summary: 'missing line' },
    { line: 2, summary: 'missing file' },
    { file: 'c.js', line: 3 },
    'not an object',
  ]);
  const result = parseFindings(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].file, 'a.js');
});

test('defaults severity to medium when missing or invalid', () => {
  const raw = JSON.stringify([
    { file: 'a.js', line: 1, summary: 'x' },
    { file: 'b.js', line: 2, summary: 'y', severity: 'nonsense' },
  ]);
  const result = parseFindings(raw);
  assert.equal(result[0].severity, 'medium');
  assert.equal(result[1].severity, 'medium');
});

test('defaults suggestion to empty string when absent', () => {
  const raw = JSON.stringify([{ file: 'a.js', line: 1, summary: 'x' }]);
  assert.equal(parseFindings(raw)[0].suggestion, '');
});

test('caps results at maxFindings', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    file: `f${i}.js`,
    line: i + 1,
    summary: `issue ${i}`,
  }));
  const result = parseFindings(JSON.stringify(many), { maxFindings: 5 });
  assert.equal(result.length, 5);
});

test('throws FindingsParseError when no JSON array is recoverable', () => {
  assert.throws(() => parseFindings('not json at all'), FindingsParseError);
});

test('throws FindingsParseError when the JSON is not an array', () => {
  assert.throws(() => parseFindings('{"file":"a.js"}'), FindingsParseError);
});
