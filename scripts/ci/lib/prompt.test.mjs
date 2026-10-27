import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './prompt.mjs';

test('includes instructions, CLAUDE.md excerpt, and diff in order', () => {
  const prompt = buildPrompt({
    instructions: 'REVIEW INSTRUCTIONS',
    claudeMdExcerpt: 'INVARIANT EXCERPT',
    diff: 'DIFF CONTENT',
    truncated: false,
  });
  const iIdx = prompt.indexOf('REVIEW INSTRUCTIONS');
  const eIdx = prompt.indexOf('INVARIANT EXCERPT');
  const dIdx = prompt.indexOf('DIFF CONTENT');
  assert.ok(iIdx >= 0 && eIdx > iIdx && dIdx > eIdx);
});

test('includes a truncation notice only when truncated is true', () => {
  const truncatedPrompt = buildPrompt({
    instructions: 'I',
    claudeMdExcerpt: 'E',
    diff: 'D',
    truncated: true,
  });
  assert.match(truncatedPrompt, /truncated/);

  const fullPrompt = buildPrompt({
    instructions: 'I',
    claudeMdExcerpt: 'E',
    diff: 'D',
    truncated: false,
  });
  assert.doesNotMatch(fullPrompt, /truncated/);
});
