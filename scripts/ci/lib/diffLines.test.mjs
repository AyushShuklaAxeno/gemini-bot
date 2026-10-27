import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotateDiff, filterFindingsToDiff } from './diffLines.mjs';

const diff = [
  'diff --git a/src/a.js b/src/a.js',
  'index 111..222 100644',
  '--- a/src/a.js',
  '+++ b/src/a.js',
  '@@ -10,4 +10,5 @@ function x() {',
  ' ctx1',
  '-old',
  '+new1',
  '+new2',
  ' ctx2',
  'diff --git a/gone.js b/gone.js',
  'deleted file mode 100644',
  '--- a/gone.js',
  '+++ /dev/null',
  '@@ -1,1 +0,0 @@',
  '-bye',
].join('\n');

test('annotates new-side lines with real numbers and skips removed lines', () => {
  const { annotated, validLines } = annotateDiff(diff);
  assert.match(annotated, /L10   \| {1} ctx1/);
  assert.match(annotated, /L11   \| \+new1/);
  assert.match(annotated, /L12   \| \+new2/);
  assert.match(annotated, /L13   \| {1} ctx2/);
  assert.match(annotated, / {6}\| -old/);
  assert.deepEqual([...validLines.get('src/a.js')], [10, 11, 12, 13]);
  assert.ok(!validLines.has('gone.js'));
});

test('keeps valid findings, snaps near misses, drops the rest', () => {
  const { validLines } = annotateDiff(diff);
  const mk = (file, line) => ({ file, line, severity: 'high', summary: 's', suggestion: '' });
  const { kept, dropped } = filterFindingsToDiff(
    [mk('src/a.js', 11), mk('b/src/a.js', 15), mk('src/a.js', 99), mk('nope.js', 1), mk('gone.js', 1)],
    validLines,
  );
  assert.deepEqual(kept.map((f) => [f.file, f.line]), [['src/a.js', 11], ['src/a.js', 13]]);
  assert.equal(dropped.length, 3);
});
